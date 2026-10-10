package com.studyclub.api.account;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
import org.springframework.jdbc.core.JdbcTemplate;

/** 권한표는 POL-0001 과 같은 행·순서·허용이다 — 스터디 단위 5 · 사이트 전체 7. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class RolePermissionIntegrationTest {

    private static final long ADMIN_ID = 9931L;
    private static final long MEMBER_ID = 9932L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seed() {
        cleanSeedRows();
        Timestamp now = Timestamp.from(Instant.now());
        insertAccount(ADMIN_ID, SystemRole.ADMIN, now);
        insertAccount(MEMBER_ID, SystemRole.MEMBER, now);
    }

    @AfterEach
    void cleanUp() {
        cleanSeedRows();
    }

    @Test
    @DisplayName("성공 - 캡틴이 부르면 스터디 단위 → 사이트 전체 두 그룹을 POL-0001 순서대로 준다")
    @SuppressWarnings("unchecked")
    void returnsGroupsInPolicyOrder() {
        var response =
                rest.exchange(
                        "/api/admin/role-permissions",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> groups =
                (List<Map<String, Object>>) response.getBody().get("groups");
        assertThat(groups).hasSize(2);

        Map<String, Object> study = groups.get(0);
        assertThat(study).containsEntry("scope", "STUDY");
        assertThat(study.get("roles")).isEqualTo(List.of("ADMIN", "LEADER", "MEMBER"));
        assertThat(permissions(study))
                .containsExactly(
                        entry("CREW_VIEW", "스터디 크루 명단 열람", "ADMIN", "LEADER"),
                        entry("STUDY_EDIT", "스터디 정보 수정", "ADMIN", "LEADER"),
                        entry("ATTENDANCE_EDIT", "출석 현황 수정", "ADMIN", "LEADER"),
                        entry("MEETING_MANAGE", "회차 관리 (추가·수정·삭제) — 담당 반에 한해", "ADMIN", "LEADER"),
                        entry("NOTICE_STUDY", "스터디 공지 발행", "ADMIN", "LEADER"));

        Map<String, Object> site = groups.get(1);
        assertThat(site).containsEntry("scope", "SITE");
        assertThat(site.get("roles")).isEqualTo(List.of("ADMIN", "MEMBER"));
        assertThat(permissions(site))
                .containsExactly(
                        entry("STUDY_CREATE", "스터디 등록", "ADMIN"),
                        entry("STUDY_PUBLISH", "스터디 공개", "ADMIN"),
                        entry("CREW_MANAGE", "반 편성", "ADMIN"),
                        entry("EVENT_MANAGE", "행사 등록 및 수정", "ADMIN"),
                        entry("NOTICE_SITE", "사이트 공지 발행", "ADMIN"),
                        entry("USER_VIEW", "전체 유저 명단 열람", "ADMIN"),
                        entry("USER_ROLE", "유저 역할 수정", "ADMIN"));
    }

    @Test
    @DisplayName("성공 - 허용 역할은 항상 그 표의 열(roles)의 부분집합이다")
    @SuppressWarnings("unchecked")
    void allowedRolesAreSubsetOfColumns() {
        var response =
                rest.exchange(
                        "/api/admin/role-permissions",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        List<Map<String, Object>> groups =
                (List<Map<String, Object>>) response.getBody().get("groups");
        for (Map<String, Object> group : groups) {
            List<String> roles = (List<String>) group.get("roles");
            for (Map<String, Object> permission :
                    (List<Map<String, Object>>) group.get("permissions")) {
                assertThat(roles).containsAll((List<String>) permission.get("allowedRoles"));
            }
        }
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403 + errorCode FORBIDDEN")
    void nonAdminIs403() {
        var response =
                rest.exchange(
                        "/api/admin/role-permissions",
                        HttpMethod.GET,
                        authenticatedRequest(MEMBER_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 토큰 없이 부르면 401 + errorCode UNAUTHORIZED")
    void unauthenticatedIs401() {
        var response =
                rest.exchange(
                        "/api/admin/role-permissions", HttpMethod.GET, HttpEntity.EMPTY, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> permissions(Map<String, Object> group) {
        return ((List<Map<String, Object>>) group.get("permissions"))
                .stream()
                        .map(p -> (Map<String, Object>) new LinkedHashMap<String, Object>(p))
                        .toList();
    }

    private static Map<String, Object> entry(String key, String label, String... allowedRoles) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("label", label);
        m.put("allowedRoles", List.of(allowedRoles));
        return m;
    }

    private HttpEntity<Void> authenticatedRequest(long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(headers);
    }

    private void cleanSeedRows() {
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID IN (?, ?)", ADMIN_ID, MEMBER_ID);
    }

    private void insertAccount(long id, SystemRole role, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "roleperm-" + id + "@example.com",
                "roleperm_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
