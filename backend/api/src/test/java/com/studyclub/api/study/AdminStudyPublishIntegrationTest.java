package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
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
    @DisplayName("성공(unpublish) - OPEN → 204, STATUS=DRAFT, 최신 회차 START_AT 을 비운다")
    void unpublish_openToDraft() {
        Long studyId = createStudy("공개 취소 테스트");
        setApplicationFormJson(
                studyId, "{\"questions\":[{\"id\":\"q1\",\"label\":\"intro\",\"type\":\"TEXT\"}]}");
        postNoBody("/api/admin/studies/" + studyId + "/publish", ADMIN_ID);
        assertThat(latestStartAt(studyId)).isNotNull();

        var response = postNoBody("/api/admin/studies/" + studyId + "/unpublish", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId).orElseThrow().getStatus())
                .isEqualTo(StudyStatus.DRAFT);
        // 모집 시작 전으로 돌아간다 — 신청서가 없으면 신청 폼을 다시 고칠 수 있다
        assertThat(latestStartAt(studyId)).isNull();
    }

    // ── unpublish 실패 ────────────────────────────────────────────────────────

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

    private Instant latestStartAt(Long studyId) {
        return jdbcTemplate.queryForObject(
                "SELECT START_AT FROM STUDY_RECRUITMENT WHERE STUDY_ID = ? ORDER BY ID DESC LIMIT 1",
                Instant.class,
                studyId);
    }

    /**
     * 신청 폼을 직접 JDBC 로 주입한다 — 폼 문항 검증과 상관없이 공개 조건만 보려고. H2 JSON 컬럼은 {@code CAST(? AS JSON)} 로 저장해야
     * Hibernate 의 {@code @JdbcTypeCode(SqlTypes.JSON)} 가 올바르게 읽는다.
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
}
