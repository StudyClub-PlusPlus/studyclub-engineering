package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.studyclub.api.auth.GoogleOAuthClient.GoogleUser;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountIdentity;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.Issuer;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import com.studyclub.domain.account.AccountRepository;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** 소셜 로그인 — 사람을 찾는 키는 (ISSUER, sub) 다. 구글 왕복만 가짜로 바꾸고 나머지는 진짜로 돈다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class SocialLoginIntegrationTest {

    private static final String SUB = "google-sub-1";
    /** 구글이 준 원본. 대소문자가 섞여 있어야 정규화(ACCOUNT.EMAIL)와 원본 보관(PROVIDER_EMAIL)이 구분된다 */
    private static final String RAW_EMAIL = "User1@Example.com";
    private static final String EMAIL = "user1@example.com";

    @Autowired TestRestTemplate rest;               // 이 테스트가 "프론트" 역할 — HTTP 를 실제로 쏜다
    @Autowired AccountRepository accounts;          // DB 에 행이 생겼는지 직접 본다
    @Autowired AccountIdentityRepository identities;

    @MockitoBean GoogleOAuthClient google;          // 구글 왕복만 가짜. 파이썬의 mock.patch 와 같다

    @BeforeEach
    void setUp() {
        // 기존 ApiIntegrationTest 와 같은 이유 — 레거시 HttpURLConnection 은 바디 있는 POST 의 4xx 를 못 읽는다
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        identities.deleteAll();   // FK 때문에 자식 먼저
        accounts.deleteAll();
    }

    /** "구글이 이런 사람이라고 답했다" 를 세팅. 기본은 검증된 이메일 */
    private void googleReturns(String sub, String email, String name) {
        googleReturns(sub, email, true, name);
    }

    private void googleReturns(String sub, String email, boolean emailVerified, String name) {
        when(google.exchange(anyString(), any()))
                .thenReturn(new GoogleUser(sub, email, emailVerified, name, "https://img/pic.png"));
    }

    /** 로그인 API 를 실제로 쏜다 */
    @SuppressWarnings("unchecked")
    private ResponseEntity<Map> login() {
        return rest.postForEntity("/auth/social-login",
                Map.of("code", "dummy", "provider", "google", "platform", "CORE"), Map.class);
    }

    @Test
    @DisplayName("성공 - 처음 온 사람은 ACCOUNT + ACCOUNT_IDENTITY 가 같이 생기고, 온보딩 미완료로 내려간다")
    void firstLoginRegisters() {
        // given — 구글이 "sub=google-sub-1, 이메일 User1@Example.com, 이름 홍길동" 이라고 답한다
        googleReturns(SUB, RAW_EMAIL, "홍길동");

        // when
        var response = login();

        // then ① HTTP 200 + 토큰
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsKey("accessToken").containsKey("refreshToken");

        // then ② 회원 정보 (키 user→account, name→nickname 개명은 프론트 동반 수정이 필요해 별도 PR)
        //         ACCOUNT.EMAIL 은 소문자 정규화
        assertThat(body).containsKey("user");
        Map<String, Object> account = (Map<String, Object>) body.get("user");
        assertThat(account.get("email")).isEqualTo(EMAIL);

        // then ③ 닉네임은 임시값 account_<12hex> (총 20자). 구글 name 은 DB 에 안 넣는다
        assertThat(account.get("name")).asString().startsWith("account_").hasSize(20);

        // then ④ 온보딩 안 한 사람 → null. 프론트가 이걸 보고 온보딩 화면으로 보낸다
        assertThat(account.get("onboardingCompletedAt")).isNull();
        assertThat(account).containsKey("timeZone");

        // then ⑤ 구글 name 은 온보딩 입력칸 초기값용으로 응답에만 실린다
        assertThat(body.get("suggestedNickname")).isEqualTo("홍길동");

        // then ⑥ DB: ACCOUNT 1행, ACCOUNT_IDENTITY 1행 — 그리고 identity 는 (GOOGLE, sub) 로 찾아진다
        assertThat(accounts.count()).isEqualTo(1);
        AccountIdentity identity = identities.findByIssuerAndProviderAccountId(Issuer.GOOGLE, SUB).orElseThrow();
        assertThat(identity.getAccountId()).isEqualTo(((Number) account.get("id")).longValue());
        assertThat(identity.getProviderEmail()).isEqualTo(RAW_EMAIL);   // PROVIDER_EMAIL 은 제공자 원본 그대로
        assertThat(identity.getLastLoginAt()).isNotNull();
    }

    @Test
    @DisplayName("성공 - 같은 sub 로 다시 오면 새 행 없이 같은 계정, LAST_LOGIN_AT 만 갱신")
    void secondLoginReusesAccount() {
        // given — 한 번 가입해 둔다
        googleReturns(SUB, EMAIL, "홍길동");
        login();
        Instant firstLogin = identities.findByIssuerAndProviderAccountId(Issuer.GOOGLE, SUB).orElseThrow().getLastLoginAt();

        // when — 같은 sub, 그런데 이메일은 바뀐 채로 다시 로그인. sub 가 같으면 같은 사람이어야 한다
        googleReturns(SUB, "changed@example.com", "홍길동");
        var response = login();

        // then — 행이 늘지 않고, 마지막 로그인 시각만 앞으로 간다
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accounts.count()).isEqualTo(1);
        assertThat(identities.count()).isEqualTo(1);
        Instant secondLogin = identities.findByIssuerAndProviderAccountId(Issuer.GOOGLE, SUB).orElseThrow().getLastLoginAt();
        assertThat(secondLogin).isAfterOrEqualTo(firstLogin);
    }

    @Test
    @DisplayName("실패 - 처음 보는 sub 인데 같은 이메일 계정이 있으면 409 ACCOUNT_LINK_REQUIRED, 아무것도 만들지 않는다")
    void unknownSubWithExistingEmailIsConflict() {
        // given — 그 이메일로 이미 가입된 계정 (identity 없이 ACCOUNT 만 있는 레거시 계정도 같은 케이스)
        accounts.save(new Account(EMAIL, "account_existing000", null, SystemRole.MEMBER));
        googleReturns("another-sub", EMAIL, "홍길동");

        // when
        var response = login();

        // then — 409 + 전용 코드, 토큰 없음, 행 수 그대로
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "ACCOUNT_LINK_REQUIRED");
        assertThat(response.getBody()).doesNotContainKey("accessToken");
        assertThat(accounts.count()).isEqualTo(1);
        assertThat(identities.count()).isZero();
    }

    @Test
    @DisplayName("실패 - 구글이 이메일 소유를 확인하지 않았으면 400 SOCIAL_LOGIN_EMAIL_REQUIRED, 아무것도 만들지 않는다")
    void unverifiedEmailIsRejected() {
        // given — 외부 이메일로 만든 구글 계정 등, email_verified=false 로 온 경우
        googleReturns(SUB, RAW_EMAIL, false, "홍길동");

        // when
        var response = login();

        // then — 400 + 전용 코드 (프론트가 일반 400 과 다른 안내 화면으로 분기), 토큰 없음, DB 비어 있음
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "SOCIAL_LOGIN_EMAIL_REQUIRED");
        assertThat(response.getBody()).doesNotContainKey("accessToken");
        assertThat(accounts.count()).isZero();
        assertThat(identities.count()).isZero();
    }
}
