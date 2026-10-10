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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * 계정 권한 변경. 요청자(9921)와 다른 캡틴(9925)이 있어 ADMIN 이 늘 둘 이상이다 — 「마지막 캡틴」 거절은 HTTP 로 만들 수 없어 {@link
 * AdminAccountRoleServiceTest} 가 맡는다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminAccountRoleIntegrationTest {

    private static final long ADMIN_ID = 9921L;
    private static final long MEMBER_REQUESTER_ID = 9922L;
    private static final long TARGET_MEMBER_ID = 9923L;
    private static final long OTHER_ADMIN_ID = 9925L;
    private static final List<Long> ACCOUNT_IDS =
            List.of(ADMIN_ID, MEMBER_REQUESTER_ID, TARGET_MEMBER_ID, OTHER_ADMIN_ID);

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
        insertAccount(MEMBER_REQUESTER_ID, SystemRole.MEMBER, now);
        insertAccount(TARGET_MEMBER_ID, SystemRole.MEMBER, now);
        insertAccount(OTHER_ADMIN_ID, SystemRole.ADMIN, now);
    }

    @AfterEach
    void cleanUp() {
        cleanSeedRows();
    }

    @Test
    @DisplayName("성공 - 크루를 캡틴으로 올리면 200, DB 에 반영되고 감사 로그 ROLE_CHANGE(MEMBER → ADMIN) 한 행")
    void promotesMemberToAdmin() {
        var response = patch(TARGET_MEMBER_ID, ADMIN_ID, "ADMIN");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("id", (int) TARGET_MEMBER_ID)
                .containsEntry("systemRole", "ADMIN");
        assertThat(roleOf(TARGET_MEMBER_ID)).isEqualTo("ADMIN");
        List<Map<String, Object>> rows = auditRows();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0))
                .containsEntry("ACTION", "ROLE_CHANGE")
                .containsEntry("ACTOR_ACCOUNT_ID", ADMIN_ID)
                .containsEntry("TARGET_ACCOUNT_ID", TARGET_MEMBER_ID)
                .containsEntry("BEFORE_VALUE", "MEMBER")
                .containsEntry("AFTER_VALUE", "ADMIN");
    }

    @Test
    @DisplayName("성공 - 다른 캡틴을 크루로 내리면 200, 감사 로그는 ADMIN → MEMBER")
    void demotesOtherAdmin() {
        var response = patch(OTHER_ADMIN_ID, ADMIN_ID, "MEMBER");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("systemRole", "MEMBER");
        assertThat(roleOf(OTHER_ADMIN_ID)).isEqualTo("MEMBER");
        assertThat(auditRows())
                .singleElement()
                .satisfies(
                        row ->
                                assertThat(row)
                                        .containsEntry("BEFORE_VALUE", "ADMIN")
                                        .containsEntry("AFTER_VALUE", "MEMBER"));
    }

    @Test
    @DisplayName("성공 - 같은 값이면 아무것도 바꾸지 않고 200, 감사 기록 0행 (중복 클릭·재시도에 안전)")
    void sameValueIsNoop() {
        var response = patch(TARGET_MEMBER_ID, ADMIN_ID, "MEMBER");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("systemRole", "MEMBER");
        assertThat(roleOf(TARGET_MEMBER_ID)).isEqualTo("MEMBER");
        assertThat(auditRows()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 본인이면 409 + errorCode CANNOT_CHANGE_OWN_ROLE, 값이 같아도 막고 기록 0행")
    void cannotChangeOwnRole() {
        var demote = patch(ADMIN_ID, ADMIN_ID, "MEMBER");
        var sameValue = patch(ADMIN_ID, ADMIN_ID, "ADMIN");

        assertThat(demote.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(demote.getBody()).containsEntry("errorCode", "CANNOT_CHANGE_OWN_ROLE");
        assertThat(sameValue.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(sameValue.getBody()).containsEntry("errorCode", "CANNOT_CHANGE_OWN_ROLE");
        assertThat(roleOf(ADMIN_ID)).isEqualTo("ADMIN");
        assertThat(auditRows()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 없는 계정은 404 + errorCode NOT_FOUND, 감사 기록 0행")
    void unknownAccountIs404() {
        var response = patch(999_999_999L, ADMIN_ID, "ADMIN");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
        assertThat(auditRows()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403 + errorCode FORBIDDEN, 값은 그대로이고 기록 0행")
    void nonAdminIs403() {
        var response = patch(TARGET_MEMBER_ID, MEMBER_REQUESTER_ID, "ADMIN");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
        assertThat(roleOf(TARGET_MEMBER_ID)).isEqualTo("MEMBER");
        assertThat(auditRows()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 토큰 없이 부르면 401 + errorCode UNAUTHORIZED")
    void unauthenticatedIs401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var response =
                rest.exchange(
                        "/api/admin/users/" + TARGET_MEMBER_ID + "/system-role",
                        HttpMethod.PATCH,
                        new HttpEntity<>("{\"systemRole\":\"ADMIN\"}", headers),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - systemRole 이 LEADER 이거나 없거나 null 이면 400 + errorCode INVALID_INPUT")
    void invalidBodyIs400() {
        for (String body :
                List.of(
                        "{\"systemRole\":\"LEADER\"}",
                        "{\"systemRole\":\"admin\"}",
                        "{}",
                        "{\"systemRole\":null}")) {
            var response = patchRaw(TARGET_MEMBER_ID, ADMIN_ID, body);

            assertThat(response.getStatusCode()).as(body).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).as(body).containsEntry("errorCode", "INVALID_INPUT");
        }
        assertThat(roleOf(TARGET_MEMBER_ID)).isEqualTo("MEMBER");
        assertThat(auditRows()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 감사 행을 넣은 직후 실패해도 권한은 그대로이고 행도 롤백된다 (500 INTERNAL_ERROR, 기록 0행)")
    void roleIsNotChangedWhenAuditLogFails() {
        // 진짜 INSERT 가 일어난 뒤에 실패시킨다. 스파이는 인터페이스 프록시라 callRealMethod 가 안 되므로(abstract real method),
        // 같은 트랜잭션에 묶인 EntityManager 로 직접 넣고 flush 한 뒤 던진다 — 감사 행과 권한 변경이 함께 롤백되는지 본다
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

        var response = patch(TARGET_MEMBER_ID, ADMIN_ID, "ADMIN");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).containsEntry("errorCode", "INTERNAL_ERROR");
        assertThat(roleOf(TARGET_MEMBER_ID)).isEqualTo("MEMBER");
        // 진짜 INSERT 가 일어났다는 증거 — IDENTITY 키가 이미 채워져 있다
        assertThat(((AdminAuditLog) inserted.get()).getId()).isNotNull();
        assertThat(auditRows()).isEmpty();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private ResponseEntity<Map> patch(long targetId, long requesterId, String systemRole) {
        return patchRaw(targetId, requesterId, "{\"systemRole\":\"" + systemRole + "\"}");
    }

    private ResponseEntity<Map> patchRaw(long targetId, long requesterId, String json) {
        String email = accountRepository.findById(requesterId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(requesterId), email));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                "/api/admin/users/" + targetId + "/system-role",
                HttpMethod.PATCH,
                new HttpEntity<>(json, headers),
                Map.class);
    }

    private String roleOf(long accountId) {
        return jdbcTemplate.queryForObject(
                "SELECT SYSTEM_ROLE FROM ACCOUNT WHERE ID = ?", String.class, accountId);
    }

    /** 이 테스트의 계정이 행위자이거나 대상인 감사 행. */
    private List<Map<String, Object>> auditRows() {
        return jdbcTemplate.queryForList(
                "SELECT ACTION, ACTOR_ACCOUNT_ID, TARGET_ACCOUNT_ID, BEFORE_VALUE, AFTER_VALUE"
                        + " FROM ADMIN_AUDIT_LOG WHERE ACTOR_ACCOUNT_ID IN (?, ?, ?, ?, ?)"
                        + " OR TARGET_ACCOUNT_ID IN (?, ?, ?, ?, ?) ORDER BY ID",
                ACCOUNT_IDS.get(0),
                ACCOUNT_IDS.get(1),
                ACCOUNT_IDS.get(2),
                ACCOUNT_IDS.get(3),
                999_999_999L,
                ACCOUNT_IDS.get(0),
                ACCOUNT_IDS.get(1),
                ACCOUNT_IDS.get(2),
                ACCOUNT_IDS.get(3),
                999_999_999L);
    }

    private void cleanSeedRows() {
        jdbcTemplate.update(
                "DELETE FROM ADMIN_AUDIT_LOG WHERE ACTOR_ACCOUNT_ID IN (?, ?, ?, ?, ?)"
                        + " OR TARGET_ACCOUNT_ID IN (?, ?, ?, ?, ?)",
                ACCOUNT_IDS.get(0),
                ACCOUNT_IDS.get(1),
                ACCOUNT_IDS.get(2),
                ACCOUNT_IDS.get(3),
                999_999_999L,
                ACCOUNT_IDS.get(0),
                ACCOUNT_IDS.get(1),
                ACCOUNT_IDS.get(2),
                ACCOUNT_IDS.get(3),
                999_999_999L);
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID IN (?, ?, ?, ?)", ACCOUNT_IDS.toArray());
    }

    private void insertAccount(long id, SystemRole role, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "rolechange-" + id + "@example.com",
                "rolechg_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
