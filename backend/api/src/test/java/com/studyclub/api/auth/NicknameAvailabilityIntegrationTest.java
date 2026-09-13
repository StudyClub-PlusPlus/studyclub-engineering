package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountConsentRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class NicknameAvailabilityIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accounts;
    @Autowired AccountConsentRepository consents;

    @BeforeEach
    void useModernHttpClient() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    private Account seedAccount() {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        return accounts.save(
                new Account(
                        "availability-" + suffix + "@example.com",
                        "account_" + suffix.substring(0, 12),
                        null,
                        SystemRole.MEMBER));
    }

    private HttpEntity<Void> authorized(Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return new HttpEntity<>(headers);
    }

    private ResponseEntity<Map> check(Account account, String value) {
        return rest.exchange(
                "/api/nicknames/availability?value={value}",
                HttpMethod.GET,
                authorized(account),
                Map.class,
                value);
    }

    @Test
    @DisplayName("성공 - 온보딩 미완료도 조회 가능하고 계정·동의 기록을 변경하지 않는다")
    void allowsUnonboardedAccountWithoutWrites() {
        Account account = seedAccount();
        String originalNickname = account.getNickname();
        String candidate = "n" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);

        var response = check(account, candidate);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of("available", true));
        Account saved = accounts.findById(account.getId()).orElseThrow();
        assertThat(saved.getNickname()).isEqualTo(originalNickname);
        assertThat(saved.getOnboardingCompletedAt()).isNull();
        assertThat(consents.findByAccountId(account.getId())).isEmpty();
    }

    @Test
    @DisplayName("성공 - 대소문자·앞뒤 공백이 달라도 실제 DB의 사용 중인 닉네임을 찾는다")
    void reportsTakenNicknameIgnoringCaseAndOuterSpaces() {
        Account owner = seedAccount();
        String nickname = "Name" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        owner.completeOnboarding(nickname, "Asia/Seoul", Instant.now());
        accounts.save(owner);

        var response = check(seedAccount(), "  " + nickname.toLowerCase(Locale.ROOT) + "  ");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of("available", false));
    }

    @Test
    @DisplayName("성공 - 한글 쿼리도 DB의 닉네임과 비교한다")
    void acceptsEncodedKoreanNickname() {
        Account owner = seedAccount();
        String nickname = "크루" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        owner.completeOnboarding(nickname, "Asia/Seoul", Instant.now());
        accounts.save(owner);

        assertThat(check(seedAccount(), nickname).getBody()).isEqualTo(Map.of("available", false));
    }

    @Test
    @DisplayName("실패 - 닉네임을 생략하면 400과 공통 오류 형식을 반환한다")
    void rejectsMissingValue() {
        var response =
                rest.exchange(
                        "/api/nicknames/availability",
                        HttpMethod.GET,
                        authorized(seedAccount()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패 - 형식 오류는 사용 불가 응답 대신 400과 필드 사유를 반환한다")
    void rejectsInvalidValue() {
        var response = check(seedAccount(), "name!");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage")).asString().startsWith("value: ");
        assertThat(response.getBody()).doesNotContainKey("available");
    }

    @Test
    @DisplayName("실패 - 토큰 없이 닉네임을 조회하면 401과 공통 오류 형식을 반환한다")
    void rejectsUnauthenticated() {
        var response = rest.getForEntity("/api/nicknames/availability?value=Journey", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 무효한 토큰으로도 닉네임을 조회할 수 없다")
    void rejectsInvalidToken() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("invalid-token");

        var response =
                rest.exchange(
                        "/api/nicknames/availability?value=Journey",
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }
}
