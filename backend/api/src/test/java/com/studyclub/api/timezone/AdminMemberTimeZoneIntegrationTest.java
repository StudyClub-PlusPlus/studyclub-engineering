package com.studyclub.api.timezone;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
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

/**
 * GET /api/admin/member-time-zones — specs/timezone/spec.md §6 · §10. H2 는 테스트 사이에 비워지지 않아 다른 테스트가
 * 잘 쓰지 않는 지역으로 센다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminMemberTimeZoneIntegrationTest {

    private static final String CHATHAM = "Pacific/Chatham";
    private static final String TROLL = "Antarctica/Troll";
    private static final String MACQUARIE = "Antarctica/Macquarie";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired MemberTimeZoneCandidateService candidates;

    private Account admin;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        accountRepository.findAll().stream()
                .filter(
                        account ->
                                List.of(CHATHAM, TROLL, MACQUARIE, "+09:00")
                                        .contains(account.getTimeZone()))
                .forEach(accountRepository::delete);
        admin = onboarded(SystemRole.ADMIN, "Asia/Seoul");
        candidates.invalidate();
    }

    @Test
    @DisplayName("성공 - 온보딩을 마친 계정만 지역별로 세고, 미온보딩 · 무효 값은 빼고, 인원 내림차순 · 동률 IANA 순")
    void countsOnboardedAccounts() {
        onboarded(SystemRole.MEMBER, CHATHAM);
        onboarded(SystemRole.MEMBER, CHATHAM);
        onboarded(SystemRole.MEMBER, TROLL);
        onboarded(SystemRole.MEMBER, "+09:00");
        unonboarded(CHATHAM);

        var response = get(admin);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsKey("asOf");
        List<Map<String, Object>> items = items(response);
        assertThat(count(items, CHATHAM)).isEqualTo(2);
        assertThat(count(items, TROLL)).isEqualTo(1);
        assertThat(items).noneMatch(item -> "+09:00".equals(item.get("timeZone")));
        assertThat(items)
                .isSortedAccordingTo(
                        Comparator.<Map<String, Object>>comparingInt(
                                        item -> -((Number) item.get("memberCount")).intValue())
                                .thenComparing(item -> (String) item.get("timeZone")));
    }

    @Test
    @DisplayName("성공 - 60초 캐시: 이벤트 없이 바뀐 값은 바로 안 보이고, 프로필 PATCH 가 커밋되면 다음 GET 에 반영된다")
    void profileChangeInvalidatesCache() {
        Account crew = onboarded(SystemRole.MEMBER, CHATHAM);
        assertThat(count(items(get(admin)), CHATHAM)).isEqualTo(1);

        // 저장소로 바로 넣은 계정은 이벤트가 없어 캐시가 그대로다
        onboarded(SystemRole.MEMBER, CHATHAM);
        assertThat(count(items(get(admin)), CHATHAM)).isEqualTo(1);

        var patch = patchProfile(crew, TROLL);
        assertThat(patch.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<Map<String, Object>> after = items(get(admin));
        assertThat(count(after, CHATHAM)).isEqualTo(1);
        assertThat(count(after, TROLL)).isEqualTo(1);
    }

    @Test
    @DisplayName("성공 - 온보딩 완료와 회원 탈퇴도 커밋 뒤 캐시를 비운다. 마지막 회원이 떠난 지역은 후보에서 빠진다")
    void onboardingAndDeletionInvalidateCache() {
        Account newcomer = unonboarded(null);
        assertThat(count(items(get(admin)), MACQUARIE)).isZero();

        var onboarding =
                rest.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticated(
                                newcomer,
                                Map.of(
                                        "age14Confirmed", true,
                                        "termsOfServiceAgreed", true,
                                        "privacyPolicyAgreed", true,
                                        "marketingAgreed", false,
                                        "nickname", nickname(),
                                        "timeZone", MACQUARIE)),
                        Map.class);
        assertThat(onboarding.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(count(items(get(admin)), MACQUARIE)).isEqualTo(1);

        var deletion =
                rest.exchange(
                        "/api/me",
                        HttpMethod.DELETE,
                        authenticated(newcomer, Map.of("reason", "NO_DESIRED_STUDY")),
                        Void.class);
        assertThat(deletion.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(count(items(get(admin)), MACQUARIE)).isZero();
    }

    @Test
    @DisplayName("성공 - deprecated 링크로 들어온 프로필은 정본 지역으로 저장 · 집계된다")
    void aliasIsStoredCanonical() {
        Account crew = onboarded(SystemRole.MEMBER, "Asia/Seoul");

        assertThat(patchProfile(crew, "US/Pacific").getBody())
                .containsEntry("timeZone", "America/Los_Angeles");
        assertThat(accountRepository.findById(crew.getId()).orElseThrow().getTimeZone())
                .isEqualTo("America/Los_Angeles");
    }

    @Test
    @DisplayName("실패 - 토큰이 없으면 401, ADMIN 이 아니면 403")
    void requiresAdmin() {
        assertThat(rest.getForEntity("/api/admin/member-time-zones", Map.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get(onboarded(SystemRole.MEMBER, "Asia/Seoul")).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> get(Account account) {
        return rest.exchange(
                "/api/admin/member-time-zones",
                HttpMethod.GET,
                authenticated(account, null),
                Map.class);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> patchProfile(Account account, String timeZone) {
        return rest.exchange(
                "/api/me",
                HttpMethod.PATCH,
                authenticated(
                        account,
                        Map.of(
                                "nickname",
                                accountRepository
                                        .findById(account.getId())
                                        .orElseThrow()
                                        .getNickname(),
                                "timeZone",
                                timeZone)),
                Map.class);
    }

    private HttpEntity<Map<String, Object>> authenticated(
            Account account, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return new HttpEntity<>(body, headers);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static List<Map<String, Object>> items(ResponseEntity<Map> response) {
        return (List<Map<String, Object>>) response.getBody().get("items");
    }

    private static long count(List<Map<String, Object>> items, String zone) {
        return items.stream()
                .filter(item -> zone.equals(item.get("timeZone")))
                .mapToLong(item -> ((Number) item.get("memberCount")).longValue())
                .findFirst()
                .orElse(0);
    }

    private Account onboarded(SystemRole role, String timeZone) {
        Account account = account(role);
        account.completeOnboarding(nickname(), timeZone, Instant.now());
        return accountRepository.save(account);
    }

    private Account unonboarded(String timeZone) {
        Account account = account(SystemRole.MEMBER);
        if (timeZone != null) {
            account.updateProfile(account.getNickname(), timeZone);
            account = accountRepository.save(account);
        }
        return account;
    }

    private Account account(SystemRole role) {
        return accountRepository.save(
                new Account("tz-" + UUID.randomUUID() + "@example.com", nickname(), null, role));
    }

    private static String nickname() {
        return "tz" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }
}
