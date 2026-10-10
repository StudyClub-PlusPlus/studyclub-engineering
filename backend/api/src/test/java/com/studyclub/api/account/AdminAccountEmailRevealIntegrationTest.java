package com.studyclub.api.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** 이메일 보기 — 원본은 감사 로그와 한 몸이다. 기록이 안 남으면 이메일도 안 나간다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminAccountEmailRevealIntegrationTest {

    private static final long ADMIN_ID = 9911L;
    private static final long MEMBER_ID = 9912L;
    private static final long TARGET_ID = 9913L;
    private static final List<Long> ACCOUNT_IDS = List.of(ADMIN_ID, MEMBER_ID, TARGET_ID);
    private static final String TARGET_EMAIL = "reveal-target-9913@example.com";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @MockitoSpyBean AdminAuditLogRepository adminAuditLogRepository;
    @PersistenceContext EntityManager entityManager;

    @BeforeEach
    void seed() {
        cleanSeedRows();
        Timestamp now = Timestamp.from(Instant.now());
        insertAccount(ADMIN_ID, SystemRole.ADMIN, now);
        insertAccount(MEMBER_ID, SystemRole.MEMBER, now);
        insertAccount(TARGET_ID, SystemRole.MEMBER, now);
    }

    @AfterEach
    void cleanUp() {
        cleanSeedRows();
    }

    @Test
    @DisplayName("성공 - 원본 이메일을 주고 no-store 헤더를 달며 감사 로그 EMAIL_REVEAL 한 행을 남긴다")
    void revealsEmailAndWritesAuditLog() {
        var response = post(TARGET_ID, ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Spring Security 의 기본값(no-cache, no-store, max-age=0, must-revalidate)이 아니라 정확히 no-store
        // 여야 한다
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getHeaders().get(HttpHeaders.CACHE_CONTROL))
                .containsExactly("no-store");
        assertThat(response.getBody())
                .containsEntry("id", (int) TARGET_ID)
                .containsEntry("email", TARGET_EMAIL);
        List<Map<String, Object>> rows = auditRows();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0))
                .containsEntry("ACTION", "EMAIL_REVEAL")
                .containsEntry("ACTOR_ACCOUNT_ID", ADMIN_ID)
                .containsEntry("TARGET_ACCOUNT_ID", TARGET_ID)
                .containsEntry("BEFORE_VALUE", null)
                .containsEntry("AFTER_VALUE", null);
    }

    @Test
    @DisplayName("성공 - 볼 때마다 기록한다 (횟수 제한 없음)")
    void recordsEveryReveal() {
        post(TARGET_ID, ADMIN_ID);
        post(TARGET_ID, ADMIN_ID);

        assertThat(auditRows()).hasSize(2);
    }

    @Test
    @DisplayName("성공 - 본인 이메일을 보는 것도 막지 않고 똑같이 기록한다")
    void ownEmailIsRecordedToo() {
        var response = post(ADMIN_ID, ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> rows = auditRows();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0))
                .containsEntry("ACTOR_ACCOUNT_ID", ADMIN_ID)
                .containsEntry("TARGET_ACCOUNT_ID", ADMIN_ID);
    }

    @Test
    @DisplayName("실패 - 없는 계정은 404 + errorCode NOT_FOUND, 감사 기록 0행")
    void unknownAccountIs404WithoutAuditLog() {
        var response = post(999_999_999L, ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
        assertThat(auditRows()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403 + errorCode FORBIDDEN, 감사 기록 0행, 이메일 없음")
    void nonAdminIs403WithoutAuditLog() {
        var response =
                rest.exchange(
                        "/api/admin/users/" + TARGET_ID + "/email-reveals",
                        HttpMethod.POST,
                        authenticatedRequest(MEMBER_ID),
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).contains("FORBIDDEN").doesNotContain(TARGET_EMAIL);
        assertThat(auditRows()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 토큰 없이 부르면 401 + errorCode UNAUTHORIZED")
    void unauthenticatedIs401() {
        var response =
                rest.exchange(
                        "/api/admin/users/" + TARGET_ID + "/email-reveals",
                        HttpMethod.POST,
                        HttpEntity.EMPTY,
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        assertThat(auditRows()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 감사 행을 넣은 직후 실패해도 이메일은 나가지 않고 행도 롤백된다 (500 INTERNAL_ERROR, 기록 0행)")
    void noEmailWhenAuditLogFails() {
        // 진짜 INSERT 가 일어난 뒤에 실패시킨다. 스파이는 인터페이스 프록시라 callRealMethod 가 안 되므로(abstract real method),
        // 같은 트랜잭션에 묶인 EntityManager 로 직접 넣고 flush 한 뒤 던진다 — 감사 행이 이미 들어갔어도 같이 롤백되는지 본다
        AtomicReference<Object> inserted = new AtomicReference<>();
        doAnswer(
                        inv -> {
                            AdminAuditLog log = inv.getArgument(0);
                            entityManager.persist(log);
                            entityManager.flush();
                            inserted.set(log);
                            throw new IllegalStateException("boom");
                        })
                .when(adminAuditLogRepository)
                .save(any());

        var response =
                rest.exchange(
                        "/api/admin/users/" + TARGET_ID + "/email-reveals",
                        HttpMethod.POST,
                        authenticatedRequest(ADMIN_ID),
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).contains("INTERNAL_ERROR").doesNotContain(TARGET_EMAIL);
        // 진짜 INSERT 가 일어났다는 증거 — IDENTITY 키가 이미 채워져 있다
        assertThat(((AdminAuditLog) inserted.get()).getId()).isNotNull();
        assertThat(auditRows()).isEmpty();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private ResponseEntity<Map> post(long targetId, long requesterId) {
        return rest.exchange(
                "/api/admin/users/" + targetId + "/email-reveals",
                HttpMethod.POST,
                authenticatedRequest(requesterId),
                Map.class);
    }

    private HttpEntity<Void> authenticatedRequest(long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(headers);
    }

    /** 이 테스트의 계정이 행위자이거나 대상인 감사 행. */
    private List<Map<String, Object>> auditRows() {
        return jdbcTemplate.queryForList(
                "SELECT ACTION, ACTOR_ACCOUNT_ID, TARGET_ACCOUNT_ID, BEFORE_VALUE, AFTER_VALUE"
                        + " FROM ADMIN_AUDIT_LOG WHERE ACTOR_ACCOUNT_ID IN (?, ?, ?)"
                        + " OR TARGET_ACCOUNT_ID IN (?, ?, ?, ?) ORDER BY ID",
                ADMIN_ID,
                MEMBER_ID,
                TARGET_ID,
                ADMIN_ID,
                MEMBER_ID,
                TARGET_ID,
                999_999_999L);
    }

    private void cleanSeedRows() {
        jdbcTemplate.update(
                "DELETE FROM ADMIN_AUDIT_LOG WHERE ACTOR_ACCOUNT_ID IN (?, ?, ?)"
                        + " OR TARGET_ACCOUNT_ID IN (?, ?, ?, ?)",
                ADMIN_ID,
                MEMBER_ID,
                TARGET_ID,
                ADMIN_ID,
                MEMBER_ID,
                TARGET_ID,
                999_999_999L);
        jdbcTemplate.update(
                "DELETE FROM ACCOUNT WHERE ID IN (?, ?, ?)", ADMIN_ID, MEMBER_ID, TARGET_ID);
    }

    private void insertAccount(long id, SystemRole role, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "reveal-target-" + id + "@example.com",
                "reveal_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
