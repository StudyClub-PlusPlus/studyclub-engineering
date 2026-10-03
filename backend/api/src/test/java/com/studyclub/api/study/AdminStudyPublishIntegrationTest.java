package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
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

/** 스터디 공개·공개 취소 ({@code POST /api/admin/studies/{id}/publish·unpublish}). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyPublishIntegrationTest {

    private static final Long ADMIN_ID = 8520L;
    private static final Long NAVIGATOR_ID = 8521L;
    private static final long MISSING_STUDY_ID = 999_999_998L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        Timestamp now = Timestamp.from(Instant.now());
        insertAccountIfAbsent(ADMIN_ID, "admin-publish@example.test", SystemRole.ADMIN, now);
        insertAccountIfAbsent(
                NAVIGATOR_ID, "navigator-publish@example.test", SystemRole.MEMBER, now);
        jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE ACCOUNT_ID = ?", NAVIGATOR_ID);
    }

    // ── publish 성공 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(publish) - DRAFT+폼 있음 → 204, STATUS=OPEN, 최신 회차 START_AT 채워짐")
    void publish_draftWithForm() {
        Long studyId = createStudy("공개 테스트");
        setApplicationFormJson(
                studyId, "{\"questions\":[{\"id\":\"q1\",\"label\":\"intro\",\"type\":\"TEXT\"}]}");

        var response = postNoBody("/api/admin/studies/" + studyId + "/publish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId).orElseThrow().getStatus())
                .isEqualTo(StudyStatus.OPEN);
        // 최신 모집 회차 START_AT 이 null 이 아니어야 한다
        Instant startAt =
                jdbcTemplate.queryForObject(
                        "SELECT START_AT FROM STUDY_RECRUITMENT WHERE STUDY_ID = ?"
                                + " ORDER BY ID DESC LIMIT 1",
                        Instant.class,
                        studyId);
        assertThat(startAt).isNotNull();
    }

    // ── publish 실패 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패(publish) - 토큰 없으면 401 UNAUTHORIZED")
    void publish_unauthenticated() {
        Long studyId = createStudy("401 공개");

        var response =
                rest.exchange(
                        "/api/admin/studies/" + studyId + "/publish",
                        HttpMethod.POST,
                        HttpEntity.EMPTY,
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패(publish) - 네비게이터는 403 FORBIDDEN")
    void publish_navigator() {
        Long studyId = createStudy("403 공개");
        insertParticipantIfAbsent(studyId, NAVIGATOR_ID, ParticipantRole.LEADER);

        var response = postNoBody("/api/admin/studies/" + studyId + "/publish", NAVIGATOR_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패(publish) - 없는 studyId 는 404 NOT_FOUND")
    void publish_notFound() {
        var response = postNoBody("/api/admin/studies/" + MISSING_STUDY_ID + "/publish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패(publish) - 이미 OPEN 이면 409 CONFLICT")
    void publish_alreadyOpen() {
        Long studyId = createStudy("OPEN 재공개");
        setApplicationFormJson(
                studyId, "{\"questions\":[{\"id\":\"q1\",\"label\":\"intro\",\"type\":\"TEXT\"}]}");
        postNoBody("/api/admin/studies/" + studyId + "/publish", ADMIN_ID);

        var response = postNoBody("/api/admin/studies/" + studyId + "/publish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
    }

    @Test
    @DisplayName("실패(publish) - 신청 폼 없으면 409 APPLICATION_FORM_REQUIRED")
    void publish_noApplicationForm() {
        Long studyId = createStudy("폼 없음 공개");

        var response = postNoBody("/api/admin/studies/" + studyId + "/publish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "APPLICATION_FORM_REQUIRED");
    }

    @Test
    @DisplayName("실패(publish) - questions 0개면 409 APPLICATION_FORM_REQUIRED")
    void publish_emptyQuestions() {
        Long studyId = createStudy("빈 질문 공개");
        setApplicationFormJson(studyId, "{\"questions\":[]}");

        var response = postNoBody("/api/admin/studies/" + studyId + "/publish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "APPLICATION_FORM_REQUIRED");
    }

    // ── unpublish 성공 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(unpublish) - OPEN → 204, STATUS=DRAFT (STUDY_RECRUITMENT 변경 없음)")
    void unpublish_openToDraft() {
        Long studyId = createStudy("공개 취소 테스트");
        setApplicationFormJson(
                studyId, "{\"questions\":[{\"id\":\"q1\",\"label\":\"intro\",\"type\":\"TEXT\"}]}");
        postNoBody("/api/admin/studies/" + studyId + "/publish", ADMIN_ID);

        // 모집 회차 START_AT 스냅샷
        Instant startAtBefore =
                jdbcTemplate.queryForObject(
                        "SELECT START_AT FROM STUDY_RECRUITMENT WHERE STUDY_ID = ?"
                                + " ORDER BY ID DESC LIMIT 1",
                        Instant.class,
                        studyId);

        var response = postNoBody("/api/admin/studies/" + studyId + "/unpublish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId).orElseThrow().getStatus())
                .isEqualTo(StudyStatus.DRAFT);

        // STUDY_RECRUITMENT 는 변경하지 않는다
        Instant startAtAfter =
                jdbcTemplate.queryForObject(
                        "SELECT START_AT FROM STUDY_RECRUITMENT WHERE STUDY_ID = ?"
                                + " ORDER BY ID DESC LIMIT 1",
                        Instant.class,
                        studyId);
        assertThat(startAtAfter).isEqualTo(startAtBefore);
    }

    // ── unpublish 실패 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패(unpublish) - 토큰 없으면 401 UNAUTHORIZED")
    void unpublish_unauthenticated() {
        Long studyId = createStudy("401 공개 취소");

        var response =
                rest.exchange(
                        "/api/admin/studies/" + studyId + "/unpublish",
                        HttpMethod.POST,
                        HttpEntity.EMPTY,
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패(unpublish) - 네비게이터는 403 FORBIDDEN")
    void unpublish_navigator() {
        Long studyId = createStudy("403 공개 취소");
        insertParticipantIfAbsent(studyId, NAVIGATOR_ID, ParticipantRole.LEADER);

        var response = postNoBody("/api/admin/studies/" + studyId + "/unpublish", NAVIGATOR_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패(unpublish) - 없는 studyId 는 404 NOT_FOUND")
    void unpublish_notFound() {
        var response =
                postNoBody("/api/admin/studies/" + MISSING_STUDY_ID + "/unpublish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패(unpublish) - DRAFT 에서 unpublish 는 409 CONFLICT")
    void unpublish_draft() {
        Long studyId = createStudy("DRAFT 공개 취소");

        var response = postNoBody("/api/admin/studies/" + studyId + "/unpublish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Long createStudy(String title) {
        var response =
                rest.postForEntity(
                        "/api/admin/studies",
                        authenticated(
                                ADMIN_ID,
                                Map.of("title", title, "oneLineSummary", "소개", "category", "DATA")),
                        Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
    }

    /**
     * 신청 폼을 직접 JDBC 로 주입한다. {@code PUT application-form} API 는 {@code START_AT <= now} 이면 잠겨서 호출 불가
     * — {@code create} 가 {@code START_AT=now} 으로 채우기 때문이다. H2 JSON 컬럼은 {@code CAST(? AS JSON)} 로
     * 저장해야 Hibernate 의 {@code @JdbcTypeCode(SqlTypes.JSON)} 가 올바르게 읽는다.
     */
    private void setApplicationFormJson(Long studyId, String formJson) {
        jdbcTemplate.update(
                "UPDATE STUDY SET APPLICATION_FORM = CAST(? AS JSON) WHERE ID = ?",
                formJson,
                studyId);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> postNoBody(String url, Long accountId) {
        return rest.exchange(url, HttpMethod.POST, authenticated(accountId, null), Map.class);
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
                "publish_test_" + id,
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
