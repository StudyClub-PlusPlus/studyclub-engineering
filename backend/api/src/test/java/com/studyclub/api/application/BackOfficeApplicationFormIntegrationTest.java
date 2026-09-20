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
class BackOfficeApplicationFormIntegrationTest {

    private static final Long LEADER_ID = 9601L;
    private static final Long MEMBER_ID = 9602L;
    private static final Long APPLICANT_ID = 9603L;
    private static final Long PUBLIC_STUDY_ID = 9701L;
    private static final Long EDITABLE_STUDY_ID = 9702L;
    private static final Long DRAFT_STUDY_ID = 9703L;
    private static final Long LOCKED_STUDY_ID = 9704L;
    private static final Long PUBLIC_RECRUITMENT_ID = 9801L;
    private static final Long EDITABLE_RECRUITMENT_ID = 9802L;
    private static final Long LOCKED_RECRUITMENT_ID = 9804L;

    @Autowired TestRestTemplate rest;

    @Autowired JwtService jwtService;

    @Autowired AccountRepository accountRepository;

    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seed() {
        Timestamp now = Timestamp.from(Instant.now());
        cleanSeedRows();
        insertAccount(LEADER_ID, "application-form-leader@example.com", SystemRole.MEMBER, now);
        insertAccount(MEMBER_ID, "application-form-member@example.com", SystemRole.MEMBER, now);
        insertAccount(
                APPLICANT_ID, "application-form-applicant@example.com", SystemRole.MEMBER, now);
        insertStudy(
                PUBLIC_STUDY_ID,
                "application-form-public",
                "OPEN",
                false,
                """
                {"title":"저장된 신청 제목","description":"저장된 설명","questions":[{"id":"reason","label":"지원 사유","type":"TEXT","required":true,"placeholder":"내 답변","description":null}]}
                """,
                now);
        insertStudy(EDITABLE_STUDY_ID, "application-form-editable", "OPEN", false, null, now);
        insertStudy(DRAFT_STUDY_ID, "application-form-draft", "DRAFT", false, null, now);
        insertStudy(LOCKED_STUDY_ID, "application-form-locked", "OPEN", false, null, now);
        insertRecruitment(
                PUBLIC_RECRUITMENT_ID,
                PUBLIC_STUDY_ID,
                Instant.now().minusSeconds(3600),
                Instant.now().plusSeconds(3600),
                now);
        insertRecruitment(
                EDITABLE_RECRUITMENT_ID,
                EDITABLE_STUDY_ID,
                Instant.now().plusSeconds(3600),
                Instant.now().plusSeconds(7200),
                now);
        insertRecruitment(
                LOCKED_RECRUITMENT_ID,
                LOCKED_STUDY_ID,
                Instant.now().plusSeconds(3600),
                Instant.now().plusSeconds(7200),
                now);
        insertParticipant(LEADER_ID, EDITABLE_STUDY_ID, "LEADER", now);
        insertParticipant(LEADER_ID, DRAFT_STUDY_ID, "LEADER", now);
        insertParticipant(LEADER_ID, LOCKED_STUDY_ID, "LEADER", now);
        insertApplication(LOCKED_RECRUITMENT_ID, now);
    }

    @Test
    @DisplayName("성공 - 공개 스터디 신청 폼은 토큰 없이 조회한다")
    void publicFormIsReadableWithoutToken() {
        var response =
                rest.getForEntity(
                        "/api/studies/" + PUBLIC_STUDY_ID + "/application-form", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("studyId", PUBLIC_STUDY_ID.intValue());
        assertThat(response.getBody()).containsEntry("title", "저장된 신청 제목");
        assertThat(response.getBody()).containsEntry("description", "저장된 설명");
        assertThat(response.getBody()).containsEntry("category", "BACKEND");
        assertThat(response.getBody()).containsKey("recruitDeadline");
        assertThat(response.getBody().get("questions")).asList().hasSize(1);
    }

    @Test
    @DisplayName("성공 - 캡틴은 신청 폼을 저장하고 정규화된 폼을 다시 받는다")
    void captainReplacesForm() {
        var response =
                rest.exchange(
                        "/api/studies/" + EDITABLE_STUDY_ID + "/application-form",
                        HttpMethod.PATCH,
                        authenticatedJsonRequest(LEADER_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("title", "새 신청 폼");
        assertThat(response.getBody()).containsEntry("description", "마크다운 **원문**");
        List<?> questions = (List<?>) response.getBody().get("questions");
        assertThat(questions).hasSize(1);
        @SuppressWarnings("unchecked")
        Map<String, Object> question = (Map<String, Object>) questions.get(0);
        assertThat(question).containsEntry("id", "motivation");
        assertThat(question).containsEntry("label", "지원 동기");
        assertThat(question).containsEntry("type", "TEXTAREA");
        assertThat(question).containsEntry("required", true);
        assertThat(question).containsEntry("placeholder", "자유롭게 적어주세요");
        assertThat(question).containsEntry("options", null);
        assertThat(question).containsEntry("allowOther", null);
    }

    @Test
    @DisplayName("실패 - DRAFT 스터디 신청 폼은 미로그인 사용자가 조회할 수 없다")
    void draftFormRequiresAuthentication() {
        var response =
                rest.getForEntity(
                        "/api/studies/" + DRAFT_STUDY_ID + "/application-form", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 신청 폼을 저장할 수 없다")
    void rejectsNonCaptain() {
        var response =
                rest.exchange(
                        "/api/studies/" + EDITABLE_STUDY_ID + "/application-form",
                        HttpMethod.PATCH,
                        authenticatedJsonRequest(MEMBER_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 이미 신청서가 들어온 스터디는 신청 폼을 수정할 수 없다")
    void rejectsLockedForm() {
        var response =
                rest.exchange(
                        "/api/studies/" + LOCKED_STUDY_ID + "/application-form",
                        HttpMethod.PATCH,
                        authenticatedJsonRequest(LEADER_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
    }

    @Test
    @DisplayName("실패 - 플랫폼 기본 문항 id를 추가 질문에 넣으면 INVALID_INPUT이다")
    void rejectsReservedQuestionId() {
        Map<String, Object> request =
                Map.of(
                        "title",
                        "새 신청 폼",
                        "description",
                        "설명",
                        "questions",
                        List.of(
                                Map.of(
                                        "id",
                                        "discord",
                                        "label",
                                        "디스코드 서버 별명",
                                        "type",
                                        "TEXT",
                                        "required",
                                        true)));

        var response =
                rest.exchange(
                        "/api/studies/" + EDITABLE_STUDY_ID + "/application-form",
                        HttpMethod.PATCH,
                        authenticatedJsonRequest(LEADER_ID, request),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    private Map<String, Object> validRequest() {
        return Map.of(
                "title",
                "새 신청\n폼",
                "description",
                "마크다운 **원문**",
                "questions",
                List.of(
                        Map.of(
                                "id",
                                "motivation",
                                "label",
                                "지원 동기",
                                "type",
                                "TEXTAREA",
                                "required",
                                true,
                                "placeholder",
                                "자유롭게 적어주세요",
                                "description",
                                "여러 줄 설명")));
    }

    private HttpEntity<Map<String, Object>> authenticatedJsonRequest(
            Long accountId, Map<String, Object> body) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(body, headers);
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
                "form_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }

    private void cleanSeedRows() {
        jdbcTemplate.update(
                "DELETE FROM STUDY_APPLICATION WHERE RECRUITMENT_ID IN (?, ?, ?)",
                PUBLIC_RECRUITMENT_ID,
                EDITABLE_RECRUITMENT_ID,
                LOCKED_RECRUITMENT_ID);
        jdbcTemplate.update(
                "DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID IN (?, ?, ?, ?)",
                PUBLIC_STUDY_ID,
                EDITABLE_STUDY_ID,
                DRAFT_STUDY_ID,
                LOCKED_STUDY_ID);
        jdbcTemplate.update(
                "DELETE FROM STUDY_RECRUITMENT WHERE ID IN (?, ?, ?)",
                PUBLIC_RECRUITMENT_ID,
                EDITABLE_RECRUITMENT_ID,
                LOCKED_RECRUITMENT_ID);
        jdbcTemplate.update(
                "DELETE FROM STUDY WHERE ID IN (?, ?, ?, ?)",
                PUBLIC_STUDY_ID,
                EDITABLE_STUDY_ID,
                DRAFT_STUDY_ID,
                LOCKED_STUDY_ID);
    }

    private void insertStudy(
            Long id,
            String slug,
            String status,
            boolean hidden,
            String applicationForm,
            Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY (ID, PROGRAM_ID, TITLE, SLUG, ONE_LINE_SUMMARY, DESCRIPTION,"
                        + " CATEGORY, STUDY_KIND, IS_HIDDEN, STUDY_DELIVERY_FORMAT, STATUS,"
                        + " APPLICATION_FORM, SCHEDULE, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)",
                id,
                id,
                "신청 폼 스터디",
                slug,
                "신청 폼 한 줄 소개",
                "신청 폼 상세 소개",
                "BACKEND",
                "STUDY",
                hidden,
                "ONLINE",
                status,
                applicationForm,
                "매주 목 20:00",
                now,
                now);
    }

    private void insertRecruitment(
            Long id, Long studyId, Instant startAt, Instant recruitDeadlineAt, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_RECRUITMENT (ID, STUDY_ID, TITLE, DESCRIPTION, START_AT,"
                        + " RECRUIT_DEADLINE_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                studyId,
                "1차 모집",
                "모집 설명",
                Timestamp.from(startAt),
                Timestamp.from(recruitDeadlineAt),
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

    private void insertApplication(Long recruitmentId, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_APPLICATION (ACCOUNT_ID, RECRUITMENT_ID, FORM_ANSWER,"
                        + " CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, CAST(? AS JSON), ?, ?)",
                APPLICANT_ID,
                recruitmentId,
                "{\"discordNickname\":\"홍길동/SWE/서울/백엔드\",\"answers\":{}}",
                now,
                now);
    }
}
