package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountConsentRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.ConsentType;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.account.UserRegisteredEvent;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;

/**
 * POST /accounts/onboarding — 성공 1건 + 실패 코어 (testing-guide.md). 조합 폭발(닉네임 규칙 세부 등)은 {@link
 * NicknamePolicyTest} 가 단위로 덮는다.
 *
 * <p>{@code UserRegisteredEvent} 발행 검증에 Spring 의 {@code ApplicationEvents} 테스트 유틸을 쓰지 않는다 — 그건
 * "테스트를 실행한 스레드"에서 발행된 이벤트만 기록하는데, {@code TestRestTemplate}(RANDOM_PORT)은 실제 서블릿 컨테이너 스레드에서 요청을
 * 처리하므로 이벤트가 그 스레드에서 발행돼 기록되지 않는다. 대신 진짜 리스너 빈을 등록해 스레드와 무관하게 기록한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(AccountOnboardingIntegrationTest.RecordingConfig.class)
class AccountOnboardingIntegrationTest {

    @Autowired TestRestTemplate rest;

    @Autowired JwtService jwt;

    @Autowired AccountRepository accountRepository;

    @Autowired AccountConsentRepository accountConsentRepository;

    @Autowired RecordingUserRegisteredEventListener eventRecorder;

    @TestConfiguration
    static class RecordingConfig {
        @Bean
        RecordingUserRegisteredEventListener recordingUserRegisteredEventListener() {
            return new RecordingUserRegisteredEventListener();
        }
    }

    static class RecordingUserRegisteredEventListener {
        private final List<UserRegisteredEvent> received = new CopyOnWriteArrayList<>();

        @EventListener
        void on(UserRegisteredEvent event) {
            received.add(event);
        }

        List<UserRegisteredEvent> received() {
            return received;
        }
    }

    @BeforeEach
    void useModernHttpClient() {
        // ApiIntegrationTest 의 이유와 동일 — 바디 있는 POST 에 4xx 가 오면 레거시 클라이언트가 못 읽는다.
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    private Account seedUnonboardedAccount() {
        String email = "onboarding-" + UUID.randomUUID() + "@example.com";
        String tempNickname =
                "account_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return accountRepository.save(new Account(email, tempNickname, null, SystemRole.MEMBER));
    }

    /** 테스트마다 겹치지 않는 닉네임 — DB(H2)는 테스트 사이에 초기화되지 않으므로 리터럴을 공유하면 순서에 따라 409가 섞여 든다. */
    private String uniqueNickname() {
        return "n" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private HttpEntity<Map<String, Object>> authenticatedBody(
            Account account, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return new HttpEntity<>(body, headers);
    }

    private Map<String, Object> validRequest(String nickname) {
        return Map.of(
                "termsOfServiceAgreed", true,
                "privacyPolicyAgreed", true,
                "marketingAgreed", false,
                "nickname", nickname,
                "timeZone", "Asia/Seoul");
    }

    @Test
    @DisplayName("성공 - 유효한 요청은 닉네임·타임존·완료시각을 반영하고 동의 3행을 남기고 이벤트를 정확히 1회 낸다")
    void completesOnboarding() {
        Account account = seedUnonboardedAccount();
        String nickname = uniqueNickname();

        var response =
                rest.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticatedBody(account, validRequest(nickname)),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("name", nickname);
        assertThat(response.getBody()).containsEntry("timeZone", "Asia/Seoul");
        assertThat(response.getBody().get("onboardingCompletedAt")).isNotNull();

        var savedConsents = accountConsentRepository.findByAccountId(account.getId());
        assertThat(savedConsents).hasSize(3);
        assertThat(savedConsents)
                .anySatisfy(
                        c -> {
                            assertThat(c.getConsentType()).isEqualTo(ConsentType.MARKETING);
                            assertThat(c.isAgreed()).isFalse();
                        });
        assertThat(savedConsents)
                .allSatisfy(
                        c ->
                                assertThat(c.getConsentVersion())
                                        .isEqualTo(c.getConsentType().currentVersion()));

        assertThat(
                        eventRecorder.received().stream()
                                .filter(e -> e.accountId().equals(account.getId())))
                .hasSize(1);
    }

    @Test
    @DisplayName("실패 - 토큰 없이 온보딩을 완료하려 하면 401 + errorCode UNAUTHORIZED")
    void rejectsUnauthenticated() {
        var response =
                rest.postForEntity(
                        "/accounts/onboarding", validRequest(uniqueNickname()), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 약관 미동의는 400 + errorCode INVALID_INPUT, 어느 필드인지 메시지에 담긴다")
    void rejectsWithoutTermsAgreement() {
        Account account = seedUnonboardedAccount();
        Map<String, Object> body = new HashMap<>(validRequest(uniqueNickname()));
        body.put("termsOfServiceAgreed", false);

        var response =
                rest.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticatedBody(account, body),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage"))
                .asString()
                .contains("termsOfServiceAgreed");
    }

    @Test
    @DisplayName("실패 - 닉네임이 1자면 400 + errorCode INVALID_INPUT")
    void rejectsTooShortNickname() {
        Account account = seedUnonboardedAccount();

        var response =
                rest.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticatedBody(account, validRequest("a")),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage")).asString().contains("nickname");
    }

    @Test
    @DisplayName("실패 - 유효하지 않은 타임존은 400 + errorCode INVALID_INPUT")
    void rejectsInvalidTimeZone() {
        Account account = seedUnonboardedAccount();
        Map<String, Object> body = new HashMap<>(validRequest(uniqueNickname()));
        body.put("timeZone", "Not/AZone");

        var response =
                rest.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticatedBody(account, body),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage")).asString().contains("timeZone");
    }

    @Test
    @DisplayName("실패 - 이미 다른 계정이 쓰는 닉네임(대소문자 무시)이면 409 + errorCode CONFLICT")
    void rejectsDuplicateNicknameIgnoringCase() {
        String baseNickname = uniqueNickname();
        Account taken = seedUnonboardedAccount();
        taken.completeOnboarding(
                baseNickname.toUpperCase(java.util.Locale.ROOT), "Asia/Seoul", Instant.now());
        accountRepository.save(taken);

        Account account = seedUnonboardedAccount();

        var response =
                rest.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticatedBody(account, validRequest(baseNickname)),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
    }

    @Test
    @DisplayName("멱등 - 이미 완료된 계정이 다시 호출하면 요청 바디를 무시하고 현재 상태 그대로 200")
    void idempotentOnSecondCall() {
        Account account = seedUnonboardedAccount();
        String originalNickname = uniqueNickname();
        rest.exchange(
                "/accounts/onboarding",
                HttpMethod.POST,
                authenticatedBody(account, validRequest(originalNickname)),
                Map.class);

        // 이미 완료됐으니 다른 사람이 쓰는 닉네임이라도 검증·중복 체크 없이 그대로 통과해야 한다.
        String takenByOther = uniqueNickname();
        Account other = seedUnonboardedAccount();
        other.completeOnboarding(takenByOther, "UTC", Instant.now());
        accountRepository.save(other);

        var response =
                rest.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticatedBody(account, validRequest(takenByOther)),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("name", originalNickname);

        assertThat(accountConsentRepository.findByAccountId(account.getId())).hasSize(3);
    }

    @Test
    @DisplayName(
            "멱등 - 이미 완료된 계정은 요청 바디가 형식적으로 틀려도(약관 미동의 등) 검증 없이 그대로 200 "
                    + "— 로컬 기능 테스트에서 실제로 걸렸던 회귀: 컨트롤러의 @Valid 가 서비스의 멱등 체크보다 먼저 돌면 "
                    + "이미 완료된 계정도 400 을 받는다")
    void idempotentEvenWithInvalidBody() {
        Account account = seedUnonboardedAccount();
        String originalNickname = uniqueNickname();
        rest.exchange(
                "/accounts/onboarding",
                HttpMethod.POST,
                authenticatedBody(account, validRequest(originalNickname)),
                Map.class);

        Map<String, Object> invalidBody = new HashMap<>(validRequest("a"));
        invalidBody.put("termsOfServiceAgreed", false);
        invalidBody.put("privacyPolicyAgreed", false);
        invalidBody.put("timeZone", "Not/AZone");

        var response =
                rest.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticatedBody(account, invalidBody),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("name", originalNickname);
    }

    @Test
    @DisplayName(
            "동시성 - 같은 계정에 동시에 완료 요청이 들어와도 한쪽만 실제로 저장되고 나머지는 그 결과를 그대로 받는다 "
                    + "— 리뷰에서 지적된 회귀: 락 없는 findByEmail 을 먼저 부르면 Hibernate 1차 캐시가 이후의 "
                    + "findByEmailForUpdate 결과를 무시해 두 요청 다 '미완료'로 착각하고 409 로 충돌한다")
    void concurrentCompletionRequestsAreConsistent() throws Exception {
        Account account = seedUnonboardedAccount();
        String nickname = uniqueNickname();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<ResponseEntity<Map>> callOnboarding =
                () -> {
                    barrier.await(5, TimeUnit.SECONDS);
                    return rest.exchange(
                            "/accounts/onboarding",
                            HttpMethod.POST,
                            authenticatedBody(account, validRequest(nickname)),
                            Map.class);
                };

        try {
            List<Future<ResponseEntity<Map>>> futures =
                    pool.invokeAll(List.of(callOnboarding, callOnboarding));
            List<ResponseEntity<Map>> responses = new ArrayList<>();
            for (Future<ResponseEntity<Map>> future : futures) {
                responses.add(future.get(10, TimeUnit.SECONDS));
            }

            assertThat(responses)
                    .allSatisfy(r -> assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK));
            assertThat(responses)
                    .allSatisfy(r -> assertThat(r.getBody()).containsEntry("name", nickname));
        } finally {
            pool.shutdown();
        }

        assertThat(accountConsentRepository.findByAccountId(account.getId())).hasSize(3);
        assertThat(
                        eventRecorder.received().stream()
                                .filter(e -> e.accountId().equals(account.getId())))
                .hasSize(1);
    }
}
