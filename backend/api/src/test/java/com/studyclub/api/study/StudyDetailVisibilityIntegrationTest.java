package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
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
 * 스터디 상세({@code GET /api/studies/{id}})가 호출자에 따라 공개 전(DRAFT) 스터디를 보여 주는지. 사용자 사이트와 운영 콘솔이 같은 경로를
 * 쓰므로, 캡틴·그 스터디의 네비게이터에게는 DRAFT 가 보이고 그 밖에는 없는 것처럼 404 여야 한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyDetailVisibilityIntegrationTest {

    private static final Long ADMIN_ID = 8520L;
    private static final Long MEMBER_ID = 8521L;
    private static final Long NAVIGATOR_ID = 8522L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        Timestamp now = Timestamp.from(Instant.now());
        insertAccountIfAbsent(ADMIN_ID, "admin-detail-vis@example.test", SystemRole.ADMIN, now);
        insertAccountIfAbsent(MEMBER_ID, "member-detail-vis@example.test", SystemRole.MEMBER, now);
        insertAccountIfAbsent(
                NAVIGATOR_ID, "navigator-detail-vis@example.test", SystemRole.MEMBER, now);
        // STUDY_PARTICIPANT 는 (ACCOUNT_ID, STUDY_GROUP_ID) 가 유니크다. 테스트마다 다른 스터디의 네비게이터로 세우므로
        // 앞 테스트가 남긴 행을 지운다 — 이 계정은 이 테스트 전용이다
        jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE ACCOUNT_ID = ?", NAVIGATOR_ID);
    }

    @Test
    @DisplayName("성공 - 캡틴은 DRAFT 스터디를 200 으로 본다 (운영 콘솔)")
    void captainSeesDraft() {
        Long studyId = createDraftStudy("캡틴이 보는 DRAFT");

        var response = get(studyId, ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("title", "캡틴이 보는 DRAFT")
                .containsEntry("status", "DRAFT");
    }

    @Test
    @DisplayName("성공 - 그 스터디의 네비게이터는 DRAFT 스터디를 200 으로 본다")
    void navigatorSeesOwnDraft() {
        Long studyId = createDraftStudy("네비게이터가 보는 DRAFT");
        insertParticipantIfAbsent(studyId, NAVIGATOR_ID, ParticipantRole.LEADER);

        var response = get(studyId, NAVIGATOR_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "DRAFT");
    }

    @Test
    @DisplayName("실패 - 다른 스터디의 네비게이터에게는 DRAFT 가 404")
    void navigatorOfAnotherStudyGets404() {
        Long ownStudyId = createDraftStudy("내 스터디");
        insertParticipantIfAbsent(ownStudyId, NAVIGATOR_ID, ParticipantRole.LEADER);
        Long otherStudyId = createDraftStudy("남의 DRAFT");

        var response = get(otherStudyId, NAVIGATOR_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 일반 회원에게는 DRAFT 가 403 이 아니라 404")
    void memberGets404() {
        Long studyId = createDraftStudy("회원에게 안 보이는 DRAFT");

        var response = get(studyId, MEMBER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 비로그인에게는 DRAFT 가 401 이 아니라 404")
    void anonymousGets404() {
        Long studyId = createDraftStudy("비로그인에게 안 보이는 DRAFT");

        var response = rest.getForEntity("/api/studies/" + studyId, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> get(Long studyId, Long accountId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(tokenFor(accountId));
        return rest.exchange(
                "/api/studies/" + studyId, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    // 등록하면 항상 DRAFT 다
    private Long createDraftStudy(String title) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(tokenFor(ADMIN_ID));
        Map<String, Object> body =
                Map.of("title", title, "oneLineSummary", "소개", "category", "DATA");
        var response =
                rest.postForEntity(
                        "/api/admin/studies", new HttpEntity<>(body, headers), Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
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
                "detail_vis_" + id,
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
