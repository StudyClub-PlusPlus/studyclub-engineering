package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.study.StudyRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
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
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 백오피스 스터디 등록·수정·삭제({@code /api/admin/studies}). 핵심은 <b>네비게이터가 이 경로에서는 403</b> 이라는 것 — 네비게이터는 사용자
 * 사이트 경로({@code PATCH /api/studies/{id}}, {@link StudyUpdateIntegrationTest})로만 수정한다. 상세는 경로가 하나라
 * {@link StudyDetailVisibilityIntegrationTest} 가 덮는다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyCrudIntegrationTest {

    private static final Long ADMIN_ID = 8510L;
    private static final Long MEMBER_ID = 8511L;
    private static final Long NAVIGATOR_ID = 8512L;
    private static final long MISSING_STUDY_ID = 999_999_999L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        Timestamp now = Timestamp.from(Instant.now());
        insertAccountIfAbsent(ADMIN_ID, "admin-admin-study@example.test", SystemRole.ADMIN, now);
        insertAccountIfAbsent(MEMBER_ID, "member-admin-study@example.test", SystemRole.MEMBER, now);
        insertAccountIfAbsent(
                NAVIGATOR_ID, "navigator-admin-study@example.test", SystemRole.MEMBER, now);
        // STUDY_PARTICIPANT 는 (ACCOUNT_ID, STUDY_GROUP_ID) 가 유니크다. 테스트마다 다른 스터디의 네비게이터로 세우므로
        // 앞 테스트가 남긴 행을 지운다 — 이 계정은 이 테스트 전용이다
        jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE ACCOUNT_ID = ?", NAVIGATOR_ID);
    }

    // ── 등록 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(등록) - ADMIN 이 등록하면 201 + Location 헤더")
    void adminCreates() {
        var response =
                rest.postForEntity(
                        "/api/admin/studies",
                        authenticated(ADMIN_ID, createBody("백오피스 등록")),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        assertThat(path).startsWith("/api/admin/studies/");
        Long studyId = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        assertThat(studyRepository.findById(studyId)).isPresent();
    }

    @Test
    @DisplayName("실패(등록) - 제목이 없으면 400 + errorCode INVALID_INPUT")
    void createRejectsMissingTitle() {
        Map<String, Object> body = Map.of("oneLineSummary", "소개", "category", "DATA");

        var response = exchange(HttpMethod.POST, "/api/admin/studies", ADMIN_ID, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패(등록) - ADMIN 이 아닌 계정은 403 + errorCode FORBIDDEN")
    void createRejectsMember() {
        var response =
                exchange(HttpMethod.POST, "/api/admin/studies", MEMBER_ID, createBody("회원 등록"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    // ── 수정 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(수정) - ADMIN 이 수정하면 204 + DB 값이 바뀐다")
    void adminUpdates() {
        Long studyId = createStudy("수정 전");

        var response =
                exchange(
                        HttpMethod.PATCH,
                        "/api/admin/studies/" + studyId,
                        ADMIN_ID,
                        Map.of("title", "수정 후"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId).orElseThrow().getTitle()).isEqualTo("수정 후");
    }

    @Test
    @DisplayName("실패(수정) - 그 스터디의 네비게이터도 백오피스 경로에서는 403, 값은 그대로다")
    void updateRejectsNavigator() {
        Long studyId = createStudy("네비게이터 수정 전");
        insertParticipantIfAbsent(studyId, NAVIGATOR_ID, ParticipantRole.LEADER);

        var response =
                exchange(
                        HttpMethod.PATCH,
                        "/api/admin/studies/" + studyId,
                        NAVIGATOR_ID,
                        Map.of("title", "바꿈"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
        assertThat(studyRepository.findById(studyId).orElseThrow().getTitle())
                .isEqualTo("네비게이터 수정 전");
    }

    @Test
    @DisplayName("실패(수정) - 제목을 빈 문자열로 보내면 400 + errorCode INVALID_INPUT")
    void updateRejectsBlankTitle() {
        Long studyId = createStudy("빈 제목");

        var response =
                exchange(
                        HttpMethod.PATCH,
                        "/api/admin/studies/" + studyId,
                        ADMIN_ID,
                        Map.of("title", "  "));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패(수정) - 없는 스터디는 404 + errorCode NOT_FOUND")
    void updateNotFound() {
        var response =
                exchange(
                        HttpMethod.PATCH,
                        "/api/admin/studies/" + MISSING_STUDY_ID,
                        ADMIN_ID,
                        Map.of("title", "없음"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    // ── 삭제 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(삭제) - ADMIN 이 삭제하면 204 + STUDY 행이 사라진다")
    void adminDeletes() {
        Long studyId = createStudy("삭제 대상");

        var response = exchange(HttpMethod.DELETE, "/api/admin/studies/" + studyId, ADMIN_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId)).isEmpty();
    }

    @Test
    @DisplayName("실패(삭제) - ADMIN 이 아닌 계정은 403, 스터디는 남는다")
    void deleteRejectsMember() {
        Long studyId = createStudy("삭제 403");

        var response =
                exchange(HttpMethod.DELETE, "/api/admin/studies/" + studyId, MEMBER_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(studyRepository.findById(studyId)).isPresent();
    }

    @Test
    @DisplayName("실패(삭제) - 없는 스터디는 404 + errorCode NOT_FOUND")
    void deleteNotFound() {
        var response =
                exchange(
                        HttpMethod.DELETE,
                        "/api/admin/studies/" + MISSING_STUDY_ID,
                        ADMIN_ID,
                        null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Long createStudy(String title) {
        var response =
                rest.postForEntity(
                        "/api/admin/studies",
                        authenticated(ADMIN_ID, createBody(title)),
                        Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
    }

    private static Map<String, Object> createBody(String title) {
        return Map.of("title", title, "oneLineSummary", "소개", "category", "DATA");
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> exchange(
            HttpMethod method, String url, Long accountId, Map<String, Object> body) {
        return rest.exchange(url, method, authenticated(accountId, body), Map.class);
    }

    private HttpEntity<Map<String, Object>> authenticated(
            Long accountId, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(tokenFor(accountId));
        return new HttpEntity<>(body, headers);
    }

    private String tokenFor(Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        return jwtService.issueAccess(String.valueOf(accountId), email);
    }

    private void insertAccountIfAbsent(Long id, String email, SystemRole role, Timestamp now) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                "admin_study_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }

    private void insertParticipantIfAbsent(Long studyId, Long accountId, ParticipantRole role) {
        int count =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM STUDY_PARTICIPANT WHERE STUDY_ID = ? AND ACCOUNT_ID = ?",
                        Integer.class,
                        studyId,
                        accountId);
        if (count > 0) {
            return;
        }
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT (ACCOUNT_ID, STUDY_GROUP_ID, STUDY_ID, STATUS,"
                        + " PARTICIPANT_ROLE, JOINED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                accountId,
                0L,
                studyId,
                ParticipantStatus.ACTIVE.name(),
                role.name(),
                now,
                now,
                now);
    }
}
