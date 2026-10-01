package com.studyclub.api.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyApplicationSubmissionIntegrationTest {

    private static final Long LINKED_ACCOUNT_ID = 10_600L;
    private static final Long UNLINKED_ACCOUNT_ID = 10_601L;
    private static final Long STUDY_ID = 10_610L;
    private static final Long RECRUITMENT_ID = 10_620L;
    private static final Long GROUP_ID = 10_630L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seed() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        clean();
        Timestamp now = Timestamp.from(Instant.now());
        insertAccount(LINKED_ACCOUNT_ID, "submit-linked@example.com", "discord-linked", now);
        insertAccount(UNLINKED_ACCOUNT_ID, "submit-unlinked@example.com", null, now);
        insertStudy(now);
        insertRecruitment(now);
        insertGroup(now);
    }

    @Test
    @DisplayName("성공 - 신청 제출은 신청서와 계정 별명을 저장하고 명부는 만들지 않는다")
    void submitsApplicationWithoutAssigningGroup() {
        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation().toString())
                .startsWith("/api/studies/" + STUDY_ID + "/applications/");
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM STUDY_APPLICATION WHERE RECRUITMENT_ID = ? AND ACCOUNT_ID = ?",
                                Long.class,
                                RECRUITMENT_ID,
                                LINKED_ACCOUNT_ID))
                .isEqualTo(1L);
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT DISCORD_NICKNAME FROM ACCOUNT WHERE ID = ?",
                                String.class,
                                LINKED_ACCOUNT_ID))
                .isEqualTo("새 별명");
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM STUDY_PARTICIPANT WHERE STUDY_ID = ? AND ACCOUNT_ID = ?",
                                Long.class,
                                STUDY_ID,
                                LINKED_ACCOUNT_ID))
                .isZero();
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT FORM_ANSWER FROM STUDY_APPLICATION WHERE RECRUITMENT_ID = ? AND ACCOUNT_ID = ?",
                                String.class,
                                RECRUITMENT_ID,
                                LINKED_ACCOUNT_ID))
                .contains("\"discordNickname\":\"새 별명\"")
                .contains("\"availableDays\":[\"mon\",\"wed\"]")
                .contains("\"scheduleAgreed\":true")
                .contains("\"reason\":\"함께 읽고 싶습니다.\"");
    }

    @Test
    @DisplayName("실패 - 토큰 없이 신청하면 시큐리티도 401 + UNAUTHORIZED 계약을 지킨다")
    void rejectsUnauthenticatedApplicant() {
        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications", validRequest(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 디스코드를 연동하지 않은 회원은 화면을 우회해도 403이다")
    void rejectsUnlinkedDiscordAccount() {
        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(UNLINKED_ACCOUNT_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
        assertThat(applicationCount()).isZero();
    }

    @Test
    @DisplayName("실패 - 없는 스터디에 신청하면 404이고 신청 행을 만들지 않는다")
    void rejectsUnknownStudy() {
        var response =
                rest.postForEntity(
                        "/api/studies/999999/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
        assertThat(applicationCount()).isZero();
    }

    @Test
    @DisplayName("실패 - 필수 추가 질문이 비면 400이고 어떤 답도 저장하지 않는다")
    void rejectsEmptyRequiredAnswer() {
        Map<String, Object> request =
                Map.of(
                        "discordNickname",
                        "새 별명",
                        "availableDays",
                        List.of("mon"),
                        "scheduleAgreed",
                        true,
                        "answers",
                        Map.of());

        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, request),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage").toString())
                .contains("answers.reason")
                .doesNotContain("함께 읽고 싶습니다");
        assertThat(applicationCount()).isZero();
    }

    @Test
    @DisplayName("실패 - 같은 모집 회차에 다시 신청하면 기존 신청을 덮지 않고 409이다")
    void rejectsDuplicateApplication() {
        rest.postForEntity(
                "/api/studies/" + STUDY_ID + "/applications",
                authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                Void.class);

        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorMessage", "이미 신청한 스터디입니다.");
        assertThat(applicationCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("실패 - 모집 정원이 찼으면 신청서와 별명을 바꾸지 않는다")
    void rejectsFullRecruitmentWithoutSideEffects() {
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO STUDY_APPLICATION (ACCOUNT_ID, RECRUITMENT_ID, FORM_ANSWER, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, CAST(? AS JSON), ?, ?)",
                UNLINKED_ACCOUNT_ID,
                RECRUITMENT_ID,
                "{\"discordNickname\":\"기존 신청자\",\"availableDays\":[\"mon\"],\"scheduleAgreed\":true,\"answers\":{\"reason\":\"기존\"}}",
                now,
                now);
        jdbcTemplate.update("UPDATE STUDY SET CAPACITY = 1 WHERE ID = ?", STUDY_ID);
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT (ACCOUNT_ID, STUDY_GROUP_ID, STUDY_ID, STATUS,"
                        + " PARTICIPANT_ROLE, JOINED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                UNLINKED_ACCOUNT_ID,
                GROUP_ID,
                STUDY_ID,
                "ACTIVE",
                "MEMBER",
                now,
                now,
                now);

        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorMessage", "정원이 가득 찼습니다.");
        assertThat(applicationCount()).isEqualTo(1L);
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT DISCORD_NICKNAME FROM ACCOUNT WHERE ID = ?",
                                String.class,
                                LINKED_ACCOUNT_ID))
                .isNull();
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM STUDY_PARTICIPANT WHERE STUDY_ID = ? AND ACCOUNT_ID = ?",
                                Long.class,
                                STUDY_ID,
                                LINKED_ACCOUNT_ID))
                .isZero();
    }

    @Test
    @DisplayName("실패 - 모집 기한이 지나면 409이고 신청 행을 만들지 않는다")
    void rejectsClosedRecruitment() {
        jdbcTemplate.update(
                "UPDATE STUDY_RECRUITMENT SET RECRUIT_DEADLINE_AT = ? WHERE ID = ?",
                Timestamp.from(Instant.now().minusSeconds(1)),
                RECRUITMENT_ID);

        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorMessage", "모집이 마감되었습니다.");
        assertThat(applicationCount()).isZero();
    }

    @Test
    @DisplayName("실패 - 모집 마감일이 없는 옛 데이터에는 신청할 수 없다")
    void rejectsRecruitmentWithoutDeadline() {
        jdbcTemplate.update(
                "UPDATE STUDY_RECRUITMENT SET RECRUIT_DEADLINE_AT = NULL WHERE ID = ?",
                RECRUITMENT_ID);

        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorMessage", "모집이 마감되었습니다.");
        assertThat(applicationCount()).isZero();
    }

    private Map<String, Object> validRequest() {
        return Map.of(
                "discordNickname",
                " 새\n별명 ",
                "availableDays",
                List.of("mon", "wed"),
                "scheduleAgreed",
                true,
                "answers",
                Map.of("reason", " 함께 읽고 싶습니다. "));
    }

    private HttpEntity<Map<String, Object>> authenticatedRequest(
            Long accountId, Map<String, Object> body) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(body, headers);
    }

    private long applicationCount() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM STUDY_APPLICATION WHERE RECRUITMENT_ID = ?",
                Long.class,
                RECRUITMENT_ID);
    }

    private void insertAccount(Long id, String email, String discordId, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE, DISCORD_ID,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                "submit_" + id,
                "MEMBER",
                "Asia/Seoul",
                discordId,
                now,
                now,
                now);
    }

    private void insertStudy(Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY (ID, PROGRAM_ID, TITLE, SLUG, ONE_LINE_SUMMARY, DESCRIPTION,"
                        + " CATEGORY, STUDY_KIND, IS_HIDDEN, STUDY_DELIVERY_FORMAT, STATUS,"
                        + " APPLICATION_FORM, SCHEDULE, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)",
                STUDY_ID,
                STUDY_ID,
                "신청 저장 스터디",
                "application-submit-study",
                "한 줄 소개",
                "상세 소개",
                "SOFTWARE",
                "STUDY",
                false,
                "ONLINE",
                "OPEN",
                """
                {"title":"신청","description":null,"questions":[{"id":"reason","label":"지원 사유","type":"TEXTAREA","required":true,"options":null,"allowOther":null}]}
                """,
                "매주 수 20:00",
                now,
                now);
    }

    private void insertRecruitment(Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_RECRUITMENT (ID, STUDY_ID, TITLE, DESCRIPTION, START_AT,"
                        + " RECRUIT_DEADLINE_AT, RECRUITMENT_CAPACITY, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                RECRUITMENT_ID,
                STUDY_ID,
                "1차 모집",
                "모집 설명",
                Timestamp.from(Instant.now().minusSeconds(60)),
                Timestamp.from(Instant.now().plusSeconds(3600)),
                2,
                now,
                now);
    }

    private void insertGroup(Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_GROUP (ID, STUDY_ID, NAME, START_AT, TIMEZONE, CAPACITY,"
                        + " CREATED_AT, UPDATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                GROUP_ID,
                STUDY_ID,
                "기본 분반",
                null,
                "Asia/Seoul",
                null,
                now,
                now);
    }

    private void clean() {
        jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID = ?", STUDY_ID);
        jdbcTemplate.update(
                "DELETE FROM STUDY_APPLICATION WHERE RECRUITMENT_ID = ?", RECRUITMENT_ID);
        jdbcTemplate.update("DELETE FROM STUDY_GROUP WHERE STUDY_ID = ?", STUDY_ID);
        jdbcTemplate.update("DELETE FROM STUDY_RECRUITMENT WHERE STUDY_ID = ?", STUDY_ID);
        jdbcTemplate.update("DELETE FROM STUDY WHERE ID = ?", STUDY_ID);
        jdbcTemplate.update(
                "DELETE FROM ACCOUNT WHERE ID IN (?, ?)", LINKED_ACCOUNT_ID, UNLINKED_ACCOUNT_ID);
    }
}
