package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountConsent;
import com.studyclub.domain.account.AccountConsentRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.ConsentType;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;

/**
 * GET·PUT /api/me/marketing-consent — 성공 + 실패 코어 (specs/profile-edit/spec.md). "값이 같으면 시각을 그대로 둔다"
 * 의 세부는 {@link AccountConsentTest} 가 단위로 덮는다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AccountMarketingConsentIntegrationTest {

    private static final String PATH = "/api/me/marketing-consent";
    private static final Instant ONBOARDED_AT = Instant.parse("2026-01-01T00:00:00Z");

    @Autowired TestRestTemplate rest;

    @Autowired JwtService jwt;

    @Autowired AccountRepository accountRepository;

    @Autowired AccountConsentRepository accountConsentRepository;

    @BeforeEach
    void useModernHttpClient() {
        // 레거시 클라이언트는 바디 있는 요청의 4xx 응답을 못 읽는다.
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    private Account seedUnonboardedAccount() {
        String email = "consent-" + UUID.randomUUID() + "@example.com";
        String tempNickname =
                "account_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return accountRepository.save(new Account(email, tempNickname, null, SystemRole.MEMBER));
    }

    /** 온보딩만 끝내고 동의 행은 없는 계정. */
    private Account seedOnboardedAccount() {
        Account account = seedUnonboardedAccount();
        String nickname = "n" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        account.completeOnboarding(nickname, "Asia/Seoul", ONBOARDED_AT);
        return accountRepository.save(account);
    }

    /** 온보딩이 남기는 동의 3행까지 있는 계정. */
    private Account seedOnboardedAccountWithConsents(boolean marketingAgreed) {
        Account account = seedOnboardedAccount();
        accountConsentRepository.saveAll(
                List.of(
                        consent(account, ConsentType.TERMS_OF_SERVICE, true),
                        consent(account, ConsentType.PRIVACY_POLICY, true),
                        consent(account, ConsentType.MARKETING, marketingAgreed)));
        return account;
    }

    private AccountConsent consent(Account account, ConsentType type, boolean agreed) {
        return new AccountConsent(
                account.getId(), type, agreed, ONBOARDED_AT, type.currentVersion());
    }

    private AccountConsent savedConsent(Account account, ConsentType type) {
        return accountConsentRepository.findByAccountId(account.getId()).stream()
                .filter(c -> c.getConsentType() == type)
                .findFirst()
                .orElseThrow();
    }

    private HttpHeaders bearer(Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return headers;
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> getConsent(Account account) {
        return rest.exchange(PATH, HttpMethod.GET, new HttpEntity<>(bearer(account)), Map.class);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> putConsent(Account account, Map<String, Object> body) {
        return rest.exchange(
                PATH, HttpMethod.PUT, new HttpEntity<>(body, bearer(account)), Map.class);
    }

    @Test
    @DisplayName("조회 성공 - 온보딩 때 저장한 값과 그 시각을 돌려준다")
    void returnsSavedConsent() {
        Account account = seedOnboardedAccountWithConsents(true);

        var response = getConsent(account);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("agreed", true);
        assertThat(Instant.parse((String) response.getBody().get("agreedAt")))
                .isEqualTo(ONBOARDED_AT);
    }

    @Test
    @DisplayName("조회 성공 - 동의 행이 없으면 미동의이고 시각은 null")
    void returnsNotAgreedWhenNoRow() {
        Account account = seedOnboardedAccount();

        var response = getConsent(account);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("agreed", false);
        assertThat(response.getBody().get("agreedAt")).isNull();
    }

    @Test
    @DisplayName("변경 성공 - 마케팅 행을 덮어쓰고 시각을 새로 찍는다. 행을 새로 쌓지 않고 다른 동의는 그대로다")
    void overwritesMarketingRowOnly() {
        Account account = seedOnboardedAccountWithConsents(true);

        var response = putConsent(account, Map.of("agreed", false));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("agreed", false);

        assertThat(accountConsentRepository.findByAccountId(account.getId())).hasSize(3);
        AccountConsent marketing = savedConsent(account, ConsentType.MARKETING);
        assertThat(marketing.isAgreed()).isFalse();
        assertThat(marketing.getAgreedAt()).isAfter(ONBOARDED_AT);
        Instant respondedAt = Instant.parse((String) response.getBody().get("agreedAt"));
        assertThat(respondedAt).isEqualTo(marketing.getAgreedAt());
        // 운영 DB 의 AGREED_AT 은 초 단위다. 응답도 초 단위여야 나중에 조회한 값과 같다.
        assertThat(respondedAt.getNano()).isZero();

        AccountConsent terms = savedConsent(account, ConsentType.TERMS_OF_SERVICE);
        assertThat(terms.isAgreed()).isTrue();
        assertThat(terms.getAgreedAt()).isEqualTo(ONBOARDED_AT);
    }

    @Test
    @DisplayName("변경 성공 - 값이 지금과 같으면 200 이고 시각도 그대로다")
    void keepsAgreedAtWhenValueIsSame() {
        Account account = seedOnboardedAccountWithConsents(true);

        var response = putConsent(account, Map.of("agreed", true));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("agreed", true);
        assertThat(Instant.parse((String) response.getBody().get("agreedAt")))
                .isEqualTo(ONBOARDED_AT);
        assertThat(savedConsent(account, ConsentType.MARKETING).getAgreedAt())
                .isEqualTo(ONBOARDED_AT);
    }

    @Test
    @DisplayName("변경 성공 - 동의 행이 없는 계정이 동의하면 현재 약관 버전으로 행을 만든다")
    void createsRowWhenMissing() {
        Account account = seedOnboardedAccount();

        var response = putConsent(account, Map.of("agreed", true));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("agreed", true);

        assertThat(accountConsentRepository.findByAccountId(account.getId())).hasSize(1);
        AccountConsent marketing = savedConsent(account, ConsentType.MARKETING);
        assertThat(marketing.isAgreed()).isTrue();
        assertThat(marketing.getConsentVersion()).isEqualTo(ConsentType.MARKETING.currentVersion());
    }

    @Test
    @DisplayName("변경 성공 - 동의 행이 없는 계정이 미동의를 보내면 미동의 행을 만들고 시각을 찍는다")
    void createsNotAgreedRowWhenMissing() {
        Account account = seedOnboardedAccount();

        var response = putConsent(account, Map.of("agreed", false));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("agreed", false);
        assertThat(response.getBody().get("agreedAt")).isNotNull();

        assertThat(accountConsentRepository.findByAccountId(account.getId())).hasSize(1);
        AccountConsent marketing = savedConsent(account, ConsentType.MARKETING);
        assertThat(marketing.isAgreed()).isFalse();
        assertThat(marketing.getConsentVersion()).isEqualTo(ConsentType.MARKETING.currentVersion());
    }

    @Test
    @DisplayName("실패 - agreed 를 빼고 보내면 400 INVALID_INPUT 이고 값은 안 바뀐다")
    void rejectsMissingAgreed() {
        Account account = seedOnboardedAccountWithConsents(true);

        var response = putConsent(account, Map.of());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(savedConsent(account, ConsentType.MARKETING).isAgreed()).isTrue();
    }

    @Test
    @DisplayName("실패 - agreed 를 null 로 보내도 400 INVALID_INPUT 이고 값은 안 바뀐다")
    void rejectsNullAgreed() {
        Account account = seedOnboardedAccountWithConsents(true);
        Map<String, Object> body = new HashMap<>();
        body.put("agreed", null);

        var response = putConsent(account, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(savedConsent(account, ConsentType.MARKETING).isAgreed()).isTrue();
    }

    @Test
    @DisplayName("동시성 - 동의 행이 없는 계정에 변경 요청이 동시에 와도 둘 다 200 이고 행은 하나다")
    @SuppressWarnings("rawtypes")
    void concurrentChangesCreateSingleRow() throws Exception {
        Account account = seedOnboardedAccount();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<ResponseEntity<Map>> change =
                () -> {
                    barrier.await(5, TimeUnit.SECONDS);
                    return putConsent(account, Map.of("agreed", true));
                };

        try {
            for (Future<ResponseEntity<Map>> future : pool.invokeAll(List.of(change, change))) {
                assertThat(future.get(10, TimeUnit.SECONDS).getStatusCode())
                        .isEqualTo(HttpStatus.OK);
            }
        } finally {
            pool.shutdown();
        }

        assertThat(accountConsentRepository.findByAccountId(account.getId())).hasSize(1);
    }

    @Test
    @DisplayName("실패 - 온보딩 미완료 계정은 조회도 변경도 403 ONBOARDING_REQUIRED")
    void rejectsUnonboardedAccount() {
        Account account = seedUnonboardedAccount();

        var getResponse = getConsent(account);
        var putResponse = putConsent(account, Map.of("agreed", true));

        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(getResponse.getBody()).containsEntry("errorCode", "ONBOARDING_REQUIRED");
        assertThat(putResponse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(putResponse.getBody()).containsEntry("errorCode", "ONBOARDING_REQUIRED");
    }

    @Test
    @DisplayName("실패 - 토큰 없이 부르면 조회도 변경도 401 UNAUTHORIZED")
    void rejectsUnauthenticated() {
        Map<String, Object> body = Map.of("agreed", true);

        var getResponse = rest.exchange(PATH, HttpMethod.GET, HttpEntity.EMPTY, Map.class);
        var putResponse = rest.exchange(PATH, HttpMethod.PUT, new HttpEntity<>(body), Map.class);

        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(putResponse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(putResponse.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }
}
