package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyUpdateIntegrationTest {

    private static final Long ADMIN_ID = 8010L;
    private static final Long LEADER_ID = 8011L;
    private static final Long CO_LEADER_ID = 8012L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyRecruitmentRepository recruitmentRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        Timestamp now = Timestamp.from(Instant.now());
        insertAccountIfAbsent(ADMIN_ID, "admin-update-study@example.test", SystemRole.ADMIN, now);
        insertAccountIfAbsent(
                LEADER_ID, "leader-update-study@example.test", SystemRole.MEMBER, now);
        insertAccountIfAbsent(
                CO_LEADER_ID, "co-leader-update-study@example.test", SystemRole.MEMBER, now);
    }

    @Test
    @DisplayName("성공 - ADMIN 이 전체 필드를 수정하면 204 + DB 값이 변경된다")
    void adminUpdatesAllFields() {
        Long studyId = createStudy("수정 전 제목", "수정 전 소개", "SOFTWARE");
        String futureDeadline =
                Instant.now().plusSeconds(86400).truncatedTo(ChronoUnit.MICROS).toString();

        Map<String, Object> body =
                Map.of(
                        "title", "수정 후 제목",
                        "oneLineSummary", "수정 후 소개",
                        "description", "상세 설명",
                        "category", "AI_ML",
                        "schedule", "매주 월 20:00",
                        "recruitDeadline", futureDeadline);

        var response =
                rest.exchange(
                        "/api/studies/" + studyId,
                        HttpMethod.PATCH,
                        authenticated(ADMIN_ID, body),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        var study = studyRepository.findById(studyId).orElseThrow();
        assertThat(study.getTitle()).isEqualTo("수정 후 제목");
        assertThat(study.getOneLineSummary()).isEqualTo("수정 후 소개");
        assertThat(study.getDescription()).isEqualTo("상세 설명");
        assertThat(study.getCategory()).isEqualTo(StudyCategory.AI_ML);
        assertThat(study.getSchedule()).isEqualTo("매주 월 20:00");

        var recruitment = recruitmentRepository.findFirstByStudyIdOrderByIdDesc(studyId);
        assertThat(recruitment).isPresent();
        assertThat(recruitment.get().getRecruitDeadlineAt())
                .isEqualTo(Instant.parse(futureDeadline));
    }

    @Test
    @DisplayName("성공 - 일부 필드만 전송하면 나머지 필드는 기존 값을 유지한다")
    void adminUpdatesPartialFields() {
        Long studyId = createStudy("원래 제목", "원래 소개", "ALGORITHM");

        Map<String, Object> body = Map.of("title", "바뀐 제목", "oneLineSummary", "원래 소개");

        var response =
                rest.exchange(
                        "/api/studies/" + studyId,
                        HttpMethod.PATCH,
                        authenticated(ADMIN_ID, body),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        var study = studyRepository.findById(studyId).orElseThrow();
        assertThat(study.getTitle()).isEqualTo("바뀐 제목");
        assertThat(study.getCategory()).isEqualTo(StudyCategory.ALGORITHM);
    }

    @Test
    @DisplayName("성공 - LEADER 도 수정 가능하다")
    void leaderCanUpdate() {
        Long studyId = createStudy("리더 수정 전", "소개", "SOFTWARE");
        insertParticipantIfAbsent(studyId, LEADER_ID, ParticipantRole.LEADER);

        Map<String, Object> body = Map.of("title", "리더 수정 후", "oneLineSummary", "소개");

        var response =
                rest.exchange(
                        "/api/studies/" + studyId,
                        HttpMethod.PATCH,
                        authenticated(LEADER_ID, body),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId).orElseThrow().getTitle()).isEqualTo("리더 수정 후");
    }

    @Test
    @DisplayName("성공 - CO_LEADER 도 수정 가능하다")
    void coLeaderCanUpdate() {
        Long studyId = createStudy("코리더 수정 전", "소개", "FRONTEND");
        insertParticipantIfAbsent(studyId, CO_LEADER_ID, ParticipantRole.CO_LEADER);

        Map<String, Object> body = Map.of("title", "코리더 수정 후", "oneLineSummary", "소개");

        var response =
                rest.exchange(
                        "/api/studies/" + studyId,
                        HttpMethod.PATCH,
                        authenticated(CO_LEADER_ID, body),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId).orElseThrow().getTitle())
                .isEqualTo("코리더 수정 후");
    }

    @Test
    @DisplayName("성공 - recruitDeadline 을 수정하면 STUDY_RECRUITMENT 행이 업데이트된다")
    void adminUpdatesRecruitDeadline() {
        Long studyId = createStudy("마감일 수정", "소개", "DATA");
        String newDeadline =
                Instant.now().plusSeconds(172800).truncatedTo(ChronoUnit.MICROS).toString();

        Map<String, Object> body =
                Map.of(
                        "title", "마감일 수정",
                        "oneLineSummary", "소개",
                        "recruitDeadline", newDeadline);

        var response =
                rest.exchange(
                        "/api/studies/" + studyId,
                        HttpMethod.PATCH,
                        authenticated(ADMIN_ID, body),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        var recruitment = recruitmentRepository.findFirstByStudyIdOrderByIdDesc(studyId);
        assertThat(recruitment).isPresent();
        assertThat(recruitment.get().getRecruitDeadlineAt()).isEqualTo(Instant.parse(newDeadline));
    }

    private Long createStudy(String title, String oneLineSummary, String category) {
        Map<String, Object> body =
                Map.of("title", title, "oneLineSummary", oneLineSummary, "category", category);
        var response =
                rest.postForEntity("/api/studies", authenticated(ADMIN_ID, body), Void.class);
        String path = response.getHeaders().getLocation().getPath();
        return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
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
                "update_study_" + id,
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
