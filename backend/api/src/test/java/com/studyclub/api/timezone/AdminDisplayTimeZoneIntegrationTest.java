package com.studyclub.api.timezone;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
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

/** GET · PATCH /api/admin/me/display-time-zone — specs/timezone/spec.md §7 · §10. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminDisplayTimeZoneIntegrationTest {

    private static final String URL = "/api/admin/me/display-time-zone";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;

    private Account admin;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        admin = account(SystemRole.ADMIN, "Asia/Seoul");
    }

    @Test
    @DisplayName("성공 - 저장한 헤더가 없으면 timeZone 은 null, 적용 결과는 프로필")
    void getWithoutStoredHeader() {
        var response = exchange(HttpMethod.GET, admin, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("timeZone", null)
                .containsEntry("profileTimeZone", "Asia/Seoul")
                .containsEntry("effectiveDisplayTimeZone", "Asia/Seoul");
    }

    @Test
    @DisplayName("성공 - PATCH 는 헤더만 저장하고 프로필 시간대는 그대로 둔다. deprecated 링크는 정본으로 저장한다")
    void patchStoresHeaderOnly() {
        var response = exchange(HttpMethod.PATCH, admin, Map.of("timeZone", "America/Toronto"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("timeZone", "America/Toronto")
                .containsEntry("profileTimeZone", "Asia/Seoul")
                .containsEntry("effectiveDisplayTimeZone", "America/Toronto");
        Account saved = accountRepository.findById(admin.getId()).orElseThrow();
        assertThat(saved.getTimeZone()).isEqualTo("Asia/Seoul");
        assertThat(exchange(HttpMethod.GET, admin, null).getBody())
                .containsEntry("timeZone", "America/Toronto");

        exchange(HttpMethod.PATCH, admin, Map.of("timeZone", "US/Eastern"));
        assertThat(
                        accountRepository
                                .findById(admin.getId())
                                .orElseThrow()
                                .getAdminDisplayTimeZone())
                .isEqualTo("America/New_York");
    }

    @Test
    @DisplayName("성공 - 헤더를 바꿔도 저장된 모집 마감 UTC 는 그대로다. 표시만 새 헤더로 바뀐다")
    @SuppressWarnings("unchecked")
    void patchDoesNotMoveDeadline() {
        Instant deadline = Instant.now().plus(10, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Map<String, Object> body = new HashMap<>();
        body.put("title", "헤더 마감 확인");
        body.put("oneLineSummary", "소개");
        body.put("category", "DATA");
        body.put("recruitDeadline", deadline.toString());
        var created =
                rest.exchange(
                        "/api/admin/studies",
                        HttpMethod.POST,
                        authenticated(admin, body),
                        Void.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String studyUrl = created.getHeaders().getLocation().getPath();

        exchange(HttpMethod.PATCH, admin, Map.of("timeZone", "America/Los_Angeles"));

        var detail =
                rest.exchange(studyUrl, HttpMethod.GET, authenticated(admin, null), Map.class)
                        .getBody();
        assertThat(Instant.parse((String) detail.get("recruitDeadlineAt"))).isEqualTo(deadline);
        var formatted = (Map<String, Object>) detail.get("recruitDeadlineFormatted");
        assertThat(formatted)
                .containsEntry("instant", deadline.toString())
                .containsEntry("displayTimeZone", "America/Los_Angeles");
        assertThat(detail).containsEntry("displayTimeZone", "America/Los_Angeles");

        var thisTab =
                rest.exchange(
                                studyUrl + "?displayTimeZone=Asia/Seoul",
                                HttpMethod.GET,
                                authenticated(admin, null),
                                Map.class)
                        .getBody();
        assertThat(thisTab).containsEntry("displayTimeZone", "Asia/Seoul");
    }

    @Test
    @DisplayName("실패 - 오프셋 · 모르는 값 · 빈 값 · 누락은 400 INVALID_INPUT, 저장값은 그대로")
    void rejectsInvalid() {
        Map<String, Object> missing = new HashMap<>();
        for (Map<String, Object> body :
                java.util.List.of(
                        Map.<String, Object>of("timeZone", "+09:00"),
                        Map.<String, Object>of("timeZone", "GMT+9"),
                        Map.<String, Object>of("timeZone", "Mars/Olympus"),
                        Map.<String, Object>of("timeZone", ""),
                        missing)) {
            var response = exchange(HttpMethod.PATCH, admin, body);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
        assertThat(
                        accountRepository
                                .findById(admin.getId())
                                .orElseThrow()
                                .getAdminDisplayTimeZone())
                .isNull();
    }

    @Test
    @DisplayName("실패 - 토큰이 없으면 401, ADMIN 이 아니면 403")
    void requiresAdmin() {
        assertThat(rest.getForEntity(URL, Map.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        Account member = account(SystemRole.MEMBER, "Asia/Seoul");
        assertThat(exchange(HttpMethod.GET, member, null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(
                        exchange(HttpMethod.PATCH, member, Map.of("timeZone", "Asia/Seoul"))
                                .getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> exchange(
            HttpMethod method, Account account, Map<String, Object> body) {
        return rest.exchange(URL, method, authenticated(account, body), Map.class);
    }

    private HttpEntity<Map<String, Object>> authenticated(
            Account account, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return new HttpEntity<>(body, headers);
    }

    private Account account(SystemRole role, String timeZone) {
        Account account =
                new Account(
                        "display-" + UUID.randomUUID() + "@example.com",
                        "dz" + UUID.randomUUID().toString().replace("-", "").substring(0, 10),
                        null,
                        role);
        account.completeOnboarding(account.getNickname(), timeZone, Instant.now());
        return accountRepository.save(account);
    }
}
