package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountIdentity;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.EmailSignupCodeRepository;
import com.studyclub.domain.account.Issuer;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.notification.mail.MailCategory;
import com.studyclub.notification.mail.MailClient;
import java.time.Instant;
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

/** stage 테스트 로그인 (specs/stage-email-login) — 코드는 stage 사본(code-copy)으로 읽는다. 에이전트와 같은 길. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"stage-login.enabled=true", "stage-login.code-copy=true"})
@AutoConfigureTestRestTemplate
class StageEmailLoginIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired EmailSignupCodeRepository codes;
    @Autowired AccountRepository accounts;
    @Autowired AccountIdentityRepository identities;
    @MockitoBean MailClient mail; // SES 왕복만 가짜

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    private ResponseEntity<Map> post(String path, Map<String, String> body) {
        return rest.postForEntity("/auth/email" + path, body, Map.class);
    }

    private String latestCode(String email) {
        return codes.findFirstByEmailOrderByIdDesc(email).orElseThrow().getCodeCopy();
    }

    @Test
    @DisplayName("성공 - 코드 받기 → 코드 확인 → 비밀번호 로그인, 코드는 해시 + stage 사본")
    void signupThenLogin() {
        String email = "tester+seller1@example.test";
        assertThat(post("/signup", Map.of("email", "Tester+Seller1@Example.test")).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        var row = codes.findFirstByEmailOrderByIdDesc(email).orElseThrow();
        assertThat(row.getCodeHash()).hasSize(64).isNotEqualTo(row.getCodeCopy());
        String code = latestCode(email);
        assertThat(code).matches("\\d{6}");

        var verify =
                post("/verify", Map.of("email", email, "code", code, "password", "stagepass1"));
        assertThat(verify.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // 한 번만
        var again = post("/verify", Map.of("email", email, "code", code, "password", "stagepass1"));
        assertThat(again.getBody()).containsEntry("errorCode", "EMAIL_CODE_EXPIRED");

        assertThat(post("/login", Map.of("email", email, "password", "nope12345")).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        var login = post("/login", Map.of("email", email, "password", "stagepass1"));
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login.getBody()).containsKey("accessToken").containsKey("account");

        AccountIdentity identity =
                identities.findByIssuerAndProviderAccountId(Issuer.EMAIL, email).orElseThrow();
        assertThat(identity.getPasswordHash()).startsWith("{bcrypt}");
    }

    @Test
    @DisplayName("실패 - 틀리면 남은 횟수, 5번째에 만료")
    void wrongCodeLocksAtFive() {
        String email = "tester+wrong@example.test";
        post("/signup", Map.of("email", email));
        String code = latestCode(email);
        String wrong = code.equals("000000") ? "111111" : "000000";
        var body = Map.of("email", email, "code", wrong, "password", "stagepass1");

        var first = post("/verify", body);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(first.getBody()).containsEntry("errorCode", "EMAIL_CODE_WRONG");
        assertThat((String) first.getBody().get("errorMessage")).contains("4번");
        for (int i = 0; i < 3; i++) post("/verify", body);
        assertThat(post("/verify", body).getBody())
                .containsEntry("errorCode", "EMAIL_CODE_EXPIRED");
        // 맞는 코드도 이제 안 된다
        assertThat(
                        post(
                                        "/verify",
                                        Map.of(
                                                "email",
                                                email,
                                                "code",
                                                code,
                                                "password",
                                                "stagepass1"))
                                .getBody())
                .containsEntry("errorCode", "EMAIL_CODE_EXPIRED");
    }

    @Test
    @DisplayName("실패 - 60초 안에 다시 받으면 429")
    void resendTooSoon() {
        String email = "tester+soon@example.test";
        post("/signup", Map.of("email", email));
        assertThat(post("/signup", Map.of("email", email)).getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("실패 - 구글로 가입한 주소는 409, 코드를 만들지 않는다")
    void socialAccountConflicts() {
        String email = "google-user@example.test";
        Account account =
                accounts.save(new Account(email, "account_stagegoogle1", null, SystemRole.MEMBER));
        identities.save(
                new AccountIdentity(
                        account.getId(), Issuer.GOOGLE, "g-sub-stage", email, Instant.now()));

        var res = post("/signup", Map.of("email", email));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(res.getBody()).containsEntry("errorCode", "ACCOUNT_LINK_REQUIRED");
        assertThat(codes.findFirstByEmailOrderByIdDesc(email)).isEmpty();
    }

    @Test
    @DisplayName("메일 - 실제 도메인은 NOTIFY 로 보내고, 예약 도메인(.test)은 보내지 않는다")
    void mailsRealDomainsOnly() {
        post("/signup", Map.of("email", "tester+mail@example.test"));
        verify(mail, never()).send(any(), any(), any(), any());

        post("/signup", Map.of("email", "tester@studyclub-test.com"));
        verify(mail).send(eq(MailCategory.NOTIFY), eq("tester@studyclub-test.com"), any(), any());
    }

    @Test
    @DisplayName("스위치 - 꺼져 있으면 404, 운영에서 사본 스위치를 켜면 뜨지 않는다")
    void switches() {
        assertThatThrownBy(() -> service(false, false, "production").requestCode("a@example.test"))
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        assertThatThrownBy(() -> service(false, false, "stage").login("a@example.test", "x"))
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        assertThatThrownBy(() -> service(true, true, "production").refuseCodeCopyInProduction())
                .isInstanceOf(IllegalStateException.class);
        // 운영도 스위치로 연다 — 사본만 막는다
        service(true, false, "production").refuseCodeCopyInProduction();
    }

    private StageEmailLoginService service(boolean enabled, boolean copy, String env) {
        return new StageEmailLoginService(
                mock(EmailSignupCodeRepository.class),
                mock(AccountIdentityRepository.class),
                mock(AccountRepository.class),
                mock(AccountRegistrar.class),
                mock(AuthService.class),
                mock(MailClient.class),
                enabled,
                copy,
                env,
                "test-only-secret");
    }
}
