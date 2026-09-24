package com.studyclub.api.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
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
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminApplicationIntegrationTest {

    private static final Long ADMIN_ID = 9101L;
    private static final Long LEADER_ID = 9102L;
    private static final Long MEMBER_ID = 9103L;
    private static final Long APPLICANT_ID = 9104L;
    private static final Long OTHER_STUDY_ID = 9202L;
    private static final Long STUDY_ID = 9201L;
    private static final Long RECRUITMENT_ID = 9301L;
    private static final Long OTHER_RECRUITMENT_ID = 9302L;
    private static final Long PREVIOUS_COMPLETED_STUDY_ID = 9401L;
    private static final Long PREVIOUS_WITHDRAWN_STUDY_ID = 9402L;

    @Autowired TestRestTemplate rest;

    @Autowired JwtService jwtService;

    @Autowired AccountRepository accountRepository;

    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seed() {
        Timestamp now = Timestamp.from(Instant.now());
        cleanSeedRows();
        insertAccount(ADMIN_ID, "admin-applications@example.com", SystemRole.ADMIN, now);
        insertAccount(LEADER_ID, "leader-applications@example.com", SystemRole.MEMBER, now);
        insertAccount(MEMBER_ID, "member-applications@example.com", SystemRole.MEMBER, now);
        insertAccount(APPLICANT_ID, "applicant@example.com", SystemRole.MEMBER, now);
        insertStudy(STUDY_ID, "applications-study", now);
        insertStudy(OTHER_STUDY_ID, "other-applications-study", now);
        insertRecruitment(RECRUITMENT_ID, STUDY_ID, now);
        insertRecruitment(OTHER_RECRUITMENT_ID, OTHER_STUDY_ID, now);
        insertParticipant(LEADER_ID, STUDY_ID, "LEADER", now);
        insertParticipantHistory(APPLICANT_ID, PREVIOUS_COMPLETED_STUDY_ID, "COMPLETED", now);
        insertParticipantHistory(APPLICANT_ID, PREVIOUS_WITHDRAWN_STUDY_ID, "WITHDRAWN", now);
        insertApplication(now);
    }

    @Test
    @DisplayName("성공 - 캡틴은 신청자 목록과 신청서 답변을 조회한다")
    void captainReadsApplications() {
        var response =
                rest.exchange(
                        "/api/admin/studies/" + STUDY_ID + "/applications",
                        HttpMethod.GET,
                        authenticatedRequest(LEADER_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("respondentCount", 1);
        assertThat(response.getBody().get("questions")).asList().hasSize(1);
        assertThat(response.getBody().get("applications")).asList().hasSize(1);

        List<?> applications = (List<?>) response.getBody().get("applications");
        @SuppressWarnings("unchecked")
        Map<String, Object> application = (Map<String, Object>) applications.get(0);
        assertThat(application).containsEntry("email", "applicant@example.com");
        assertThat(application).containsEntry("applicantName", "application_" + APPLICANT_ID);
        assertThat(application).containsEntry("discordNickname", "홍길동/SWE/서울/백엔드");
        assertThat(application).containsEntry("previousParticipationCount", 2);
        assertThat(application).containsEntry("completionRate", 50);
        assertThat(application).containsKey("submittedAt");
        assertThat(application.get("availableDays")).asList().containsExactly("mon", "wed");
        @SuppressWarnings("unchecked")
        Map<String, Object> answers = (Map<String, Object>) application.get("answers");
        assertThat(answers).containsEntry("reason", "같이 공부하고 싶습니다.");
    }

    @Test
    @DisplayName("성공 - 시스템 관리자는 스터디 내부 역할이 없어도 신청 결과를 조회한다")
    void adminReadsApplications() {
        var response =
                rest.exchange(
                        "/api/admin/studies/" + STUDY_ID + "/applications",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("respondentCount", 1);
    }

    @Test
    @DisplayName("실패 - 토큰 없이 신청 결과를 조회하면 401 + errorCode UNAUTHORIZED를 반환한다")
    void rejectsUnauthenticatedRequest() {
        var response =
                rest.exchange(
                        "/api/admin/studies/" + STUDY_ID + "/applications",
                        HttpMethod.GET,
                        HttpEntity.EMPTY,
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 신청 결과를 볼 수 없다")
    void rejectsNonCaptain() {
        var response =
                rest.exchange(
                        "/api/admin/studies/" + STUDY_ID + "/applications",
                        HttpMethod.GET,
                        authenticatedRequest(MEMBER_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 다른 스터디의 모집 회차를 지정하면 거절한다")
    void rejectsRecruitmentOfAnotherStudy() {
        var response =
                rest.exchange(
                        "/api/admin/studies/"
                                + STUDY_ID
                                + "/applications?recruitmentId="
                                + OTHER_RECRUITMENT_ID,
                        HttpMethod.GET,
                        authenticatedRequest(LEADER_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    private void insertAccount(Long id, String email, SystemRole role, Timestamp now) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                "application_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }

    private void cleanSeedRows() {
        jdbcTemplate.update(
                "DELETE FROM STUDY_APPLICATION WHERE RECRUITMENT_ID IN (?, ?)",
                RECRUITMENT_ID,
                OTHER_RECRUITMENT_ID);
        jdbcTemplate.update(
                "DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID IN (?, ?, ?, ?)",
                STUDY_ID,
                OTHER_STUDY_ID,
                PREVIOUS_COMPLETED_STUDY_ID,
                PREVIOUS_WITHDRAWN_STUDY_ID);
        jdbcTemplate.update(
                "DELETE FROM STUDY_RECRUITMENT WHERE ID IN (?, ?)",
                RECRUITMENT_ID,
                OTHER_RECRUITMENT_ID);
        jdbcTemplate.update("DELETE FROM STUDY WHERE ID IN (?, ?)", STUDY_ID, OTHER_STUDY_ID);
    }

    private void insertStudy(Long id, String slug, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY (ID, PROGRAM_ID, TITLE, SLUG, ONE_LINE_SUMMARY, CATEGORY,"
                        + " STUDY_KIND, IS_HIDDEN, STUDY_DELIVERY_FORMAT, STATUS, APPLICATION_FORM,"
                        + " CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)",
                id,
                id,
                "신청 조회 스터디",
                slug,
                "한 줄 소개",
                "SOFTWARE",
                "STUDY",
                false,
                "ONLINE",
                "OPEN",
                "{\"questions\":[{\"id\":\"reason\",\"label\":\"지원 사유\",\"type\":\"TEXT\",\"required\":true}]}",
                now,
                now);
    }

    private void insertRecruitment(Long id, Long studyId, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_RECRUITMENT (ID, STUDY_ID, TITLE, DESCRIPTION, START_AT,"
                        + " RECRUIT_DEADLINE_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                studyId,
                "1차 모집",
                "모집 설명",
                Timestamp.from(Instant.now().minusSeconds(3600)),
                Timestamp.from(Instant.now().plusSeconds(3600)),
                now,
                now);
    }

    private void insertParticipant(Long accountId, Long studyId, String role, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT (ACCOUNT_ID, STUDY_GROUP_ID, STUDY_ID, STATUS,"
                        + " PARTICIPANT_ROLE, JOINED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                accountId,
                studyId,
                studyId,
                "ACTIVE",
                role,
                now,
                now,
                now);
    }

    private void insertParticipantHistory(
            Long accountId, Long studyId, String status, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT (ACCOUNT_ID, STUDY_GROUP_ID, STUDY_ID, STATUS,"
                        + " PARTICIPANT_ROLE, JOINED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                accountId,
                studyId,
                studyId,
                status,
                "MEMBER",
                now,
                now,
                now);
    }

    private void insertApplication(Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_APPLICATION (ACCOUNT_ID, RECRUITMENT_ID, FORM_ANSWER,"
                        + " CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, CAST(? AS JSON), ?, ?)",
                APPLICANT_ID,
                RECRUITMENT_ID,
                "{\"discordNickname\":\"홍길동/SWE/서울/백엔드\","
                        + "\"availableDays\":[\"mon\",\"wed\"],"
                        + "\"scheduleAgreed\":true,"
                        + "\"answers\":{\"reason\":\"같이 공부하고 싶습니다.\"}}",
                now,
                now);
    }

    private HttpEntity<Void> authenticatedRequest(Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(headers);
    }
}
