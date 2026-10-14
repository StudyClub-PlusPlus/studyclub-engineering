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
    @DisplayName("성공 - 분반 배정 전 신청서 수는 모집 정원을 초과할 수 있다")
    void applicationsCanExceedCapacityBeforeAssignment() {
        for (long accountId = 10_650L; accountId < 10_653L; accountId++) {
            insertAccount(
                    accountId,
                    "capacity-" + accountId + "@example.com",
                    "discord-" + accountId,
                    Timestamp.from(Instant.now()));
            var response =
                    rest.postForEntity(
                            "/api/studies/" + STUDY_ID + "/applications",
                            authenticatedRequest(accountId, validRequest()),
                            Void.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        }
        assertThat(applicationCount()).isEqualTo(3L);
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM STUDY_PARTICIPANT WHERE STUDY_ID = ?",
                                Long.class,
                                STUDY_ID))
                .isZero();
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
    @DisplayName("실패 - 저장 후 모집이 마감돼도 재시도는 이미 신청한 것으로 응답한다")
    void retryAfterDeadlineReportsExistingApplication() {
        var first =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Void.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        jdbcTemplate.update(
                "UPDATE STUDY_RECRUITMENT SET RECRUIT_DEADLINE_AT = ? WHERE ID = ?",
                Timestamp.from(Instant.now().minusSeconds(60)),
                RECRUITMENT_ID);

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
        jdbcTemplate.update(
                "UPDATE STUDY_RECRUITMENT SET RECRUITMENT_CAPACITY = 1 WHERE ID = ?",
                RECRUITMENT_ID);
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
    @DisplayName("성공 - 일시중지 명부는 모집 정원 인원에 포함하지 않는다")
    void excludesPausedParticipantFromCapacity() {
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "UPDATE STUDY_RECRUITMENT SET RECRUITMENT_CAPACITY = 1 WHERE ID = ?",
                RECRUITMENT_ID);
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT (ACCOUNT_ID, STUDY_GROUP_ID, STUDY_ID, STATUS,"
                        + " PARTICIPANT_ROLE, JOINED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                UNLINKED_ACCOUNT_ID,
                GROUP_ID,
                STUDY_ID,
                "PAUSED",
                "MEMBER",
                now,
                now,
                now);

        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(applicationCount()).isEqualTo(1L);
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

    @Test
    @DisplayName("실패 - 모든 비공개 상태는 404로 응답하고 신청을 저장하지 않는다")
    void rejectsNonOpenStudies() {
        for (String status : List.of("DRAFT", "ONGOING", "ENDED", "CLOSED")) {
            jdbcTemplate.update("UPDATE STUDY SET STATUS = ? WHERE ID = ?", status, STUDY_ID);
            var response =
                    rest.postForEntity(
                            "/api/studies/" + STUDY_ID + "/applications",
                            authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                            Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(applicationCount()).isZero();
        }
    }

    @Test
    @DisplayName("실패 - ACTIVE와 PAUSED 명부 참여자는 마감 후에도 참여 중으로 응답한다")
    void rejectsExistingRosterBeforeDeadlineCheck() {
        jdbcTemplate.update(
                "UPDATE STUDY_RECRUITMENT SET RECRUIT_DEADLINE_AT = ? WHERE ID = ?",
                Timestamp.from(Instant.now().minusSeconds(60)),
                RECRUITMENT_ID);
        for (String status : List.of("ACTIVE", "PAUSED")) {
            jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID = ?", STUDY_ID);
            insertParticipant(LINKED_ACCOUNT_ID, status, "MEMBER");
            var response =
                    rest.postForEntity(
                            "/api/studies/" + STUDY_ID + "/applications",
                            authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                            Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).containsEntry("errorMessage", "이미 참여 중인 스터디입니다.");
            assertThat(applicationCount()).isZero();
            assertThat(
                            accountRepository
                                    .findById(LINKED_ACCOUNT_ID)
                                    .orElseThrow()
                                    .getDiscordNickname())
                    .isNull();
        }
    }

    @Test
    @DisplayName("성공 - 명부에서 빠진 참여자는 기존 신청이 없으면 제출할 수 있다")
    void acceptsFormerParticipantWithoutApplication() {
        for (String status : List.of("WITHDRAWN", "COMPLETED", "DELETED")) {
            jdbcTemplate.update(
                    "DELETE FROM STUDY_APPLICATION WHERE RECRUITMENT_ID = ?", RECRUITMENT_ID);
            jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID = ?", STUDY_ID);
            insertParticipant(LINKED_ACCOUNT_ID, status, "MEMBER");
            var response =
                    rest.postForEntity(
                            "/api/studies/" + STUDY_ID + "/applications",
                            authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                            Void.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(applicationCount()).isEqualTo(1L);
        }
    }

    @Test
    @DisplayName("실패 - 정원 집계에는 ACTIVE MEMBER와 네비게이터를 포함한다")
    void countsNavigatorsInCapacity() {
        jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID = ?", STUDY_ID);
        insertParticipant(UNLINKED_ACCOUNT_ID, "ACTIVE", "MEMBER");
        insertParticipant(10650L, "ACTIVE", "LEADER");
        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorMessage", "정원이 가득 찼습니다.");
        assertThat(applicationCount()).isZero();
    }

    @Test
    @DisplayName("실패 - 과거 모집 회차에 신청했으면 현재 회차에도 신청할 수 없다")
    void rejectsApplicationFromEarlierRecruitment() {
        var first =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Void.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long currentRecruitmentId = RECRUITMENT_ID + 1;
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "UPDATE STUDY_RECRUITMENT SET RECRUIT_DEADLINE_AT = ? WHERE ID = ?",
                Timestamp.from(Instant.now().minusSeconds(60)),
                RECRUITMENT_ID);
        jdbcTemplate.update(
                "INSERT INTO STUDY_RECRUITMENT (ID, STUDY_ID, TITLE, DESCRIPTION, START_AT, RECRUIT_DEADLINE_AT, RECRUITMENT_CAPACITY, CREATED_AT, UPDATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                currentRecruitmentId,
                STUDY_ID,
                "추가 모집",
                "모집 설명",
                now,
                Timestamp.from(Instant.now().plusSeconds(3600)),
                2,
                now,
                now);
        try {
            var response =
                    rest.postForEntity(
                            "/api/studies/" + STUDY_ID + "/applications",
                            authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                            Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).containsEntry("errorMessage", "이미 신청한 스터디입니다.");
            assertThat(applicationCount()).isEqualTo(1L);
            assertThat(
                            jdbcTemplate.queryForObject(
                                    "SELECT COUNT(*) FROM STUDY_APPLICATION WHERE RECRUITMENT_ID = ?",
                                    Long.class,
                                    currentRecruitmentId))
                    .isZero();
        } finally {
            jdbcTemplate.update("DELETE FROM STUDY_RECRUITMENT WHERE ID = ?", currentRecruitmentId);
        }
    }

    @Test
    @DisplayName("성공 - 두 질문 답변은 질문 순서로 직렬화한다")
    void serializesAnswersInQuestionOrder() {
        jdbcTemplate.update(
                "UPDATE STUDY SET APPLICATION_FORM = CAST(? AS JSON) WHERE ID = ?",
                "{\"questions\":[{\"id\":\"second\",\"type\":\"TEXT\",\"required\":true},{\"id\":\"first\",\"type\":\"TEXT\",\"required\":true}]}",
                STUDY_ID);
        Map<String, Object> body = new java.util.HashMap<>(validRequest());
        body.put("answers", Map.of("first", "하나", "second", "둘"));
        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, body),
                        Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String stored =
                jdbcTemplate.queryForObject(
                        "SELECT FORM_ANSWER FROM STUDY_APPLICATION WHERE RECRUITMENT_ID = ?",
                        String.class,
                        RECRUITMENT_ID);
        assertThat(stored.indexOf("\"second\""))
                .isGreaterThanOrEqualTo(0)
                .isLessThan(stored.indexOf("\"first\""));
    }

    @Test
    @DisplayName("동일 계정의 동시 제출은 하나만 저장하고 나머지는 이미 신청으로 응답한다")
    void serializesConcurrentSubmissionsForAccount() throws Exception {
        var request = authenticatedRequest(LINKED_ACCOUNT_ID, validRequest());
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<org.springframework.http.ResponseEntity<Map>> submit =
                    () -> {
                        start.await();
                        return rest.postForEntity(
                                "/api/studies/" + STUDY_ID + "/applications", request, Map.class);
                    };
            var first = executor.submit(submit);
            var second = executor.submit(submit);
            start.countDown();
            var responses =
                    List.of(
                            first.get(15, java.util.concurrent.TimeUnit.SECONDS),
                            second.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertThat(
                            responses.stream()
                                    .map(org.springframework.http.ResponseEntity::getStatusCode)
                                    .toList())
                    .containsExactlyInAnyOrder(HttpStatus.CREATED, HttpStatus.CONFLICT);
            var rejected =
                    responses.stream()
                            .filter(
                                    response ->
                                            response.getStatusCode().equals(HttpStatus.CONFLICT))
                            .findFirst()
                            .orElseThrow();
            assertThat(rejected.getBody()).containsEntry("errorMessage", "이미 신청한 스터디입니다.");
            assertThat(applicationCount()).isEqualTo(1L);
        }
    }

    private void insertParticipant(Long accountId, String status, String role) {
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT (ACCOUNT_ID, STUDY_GROUP_ID, STUDY_ID, STATUS, PARTICIPANT_ROLE, JOINED_AT, CREATED_AT, UPDATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                accountId,
                GROUP_ID,
                STUDY_ID,
                status,
                role,
                now,
                now,
                now);
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

    @Test
    @DisplayName("실패 - 필수값 누락과 요일 상한 및 null 항목도 도메인 사유 코드로 응답한다")
    void usesConsistentDomainValidationMessages() {
        List<Map<String, Object>> invalidBodies = new java.util.ArrayList<>();
        List<String> errors =
                List.of(
                        "discordNickname: empty",
                        "availableDays: empty",
                        "answers: empty",
                        "availableDays: max",
                        "availableDays: enum");
        for (String missing : List.of("discordNickname", "availableDays", "answers")) {
            Map<String, Object> body = new java.util.HashMap<>(validRequest());
            body.remove(missing);
            invalidBodies.add(body);
        }
        Map<String, Object> tooMany = new java.util.HashMap<>(validRequest());
        tooMany.put("availableDays", java.util.Collections.nCopies(8, "mon"));
        invalidBodies.add(tooMany);
        Map<String, Object> nullDay = new java.util.HashMap<>(validRequest());
        nullDay.put("availableDays", java.util.Arrays.asList("mon", null));
        invalidBodies.add(nullDay);
        for (int i = 0; i < invalidBodies.size(); i++) {
            var response =
                    rest.postForEntity(
                            "/api/studies/" + STUDY_ID + "/applications",
                            authenticatedRequest(LINKED_ACCOUNT_ID, invalidBodies.get(i)),
                            Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody())
                    .containsEntry("errorCode", "INVALID_INPUT")
                    .containsEntry("errorMessage", errors.get(i));
        }
        assertThat(applicationCount()).isZero();
    }

    @Test
    @DisplayName("성공 - 일정 없는 폼의 false 동의값은 답변 JSON에 저장하지 않는다")
    void omitsFalseAgreementWithoutSchedule() {
        jdbcTemplate.update("UPDATE STUDY SET SCHEDULE = NULL WHERE ID = ?", STUDY_ID);
        Map<String, Object> body = new java.util.HashMap<>(validRequest());
        body.put("scheduleAgreed", false);
        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, body),
                        Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String stored =
                jdbcTemplate.queryForObject(
                        "SELECT FORM_ANSWER FROM STUDY_APPLICATION WHERE RECRUITMENT_ID = ? AND ACCOUNT_ID = ?",
                        String.class,
                        RECRUITMENT_ID,
                        LINKED_ACCOUNT_ID);
        assertThat(stored).doesNotContain("scheduleAgreed");
    }

    @Test
    @DisplayName("성공 - 본인 계정 조회는 제출한 서버 별명을 반환한다")
    void ownAccountReturnsSubmittedNickname() {
        var submitted =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Void.class);
        assertThat(submitted.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        var response =
                rest.exchange(
                        "/auth/me",
                        org.springframework.http.HttpMethod.GET,
                        authenticatedRequest(LINKED_ACCOUNT_ID, Map.of()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("discordNickname", "새 별명");

        var other =
                rest.exchange(
                        "/auth/me",
                        org.springframework.http.HttpMethod.GET,
                        authenticatedRequest(UNLINKED_ACCOUNT_ID, Map.of()),
                        Map.class);
        assertThat(other.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(other.getBody()).containsEntry("discordNickname", null);
    }

    @Test
    @DisplayName("실패 - 잘못 저장된 질문 배열은 질문 없는 폼으로 취급하지 않는다")
    void rejectsMalformedStoredForm() {
        jdbcTemplate.update(
                "UPDATE STUDY SET APPLICATION_FORM = CAST(? AS JSON) WHERE ID = ?",
                "{\"questions\":\"invalid\"}",
                STUDY_ID);

        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, validRequest()),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(applicationCount()).isZero();
    }

    @Test
    @DisplayName("성공 - 정상적으로 비어 있는 질문 배열에는 기본 답변만 제출한다")
    void acceptsEmptyQuestionArray() {
        jdbcTemplate.update(
                "UPDATE STUDY SET APPLICATION_FORM = CAST(? AS JSON) WHERE ID = ?",
                "{\"questions\":[]}",
                STUDY_ID);
        Map<String, Object> body = new java.util.HashMap<>(validRequest());
        body.put("answers", Map.of());

        var response =
                rest.postForEntity(
                        "/api/studies/" + STUDY_ID + "/applications",
                        authenticatedRequest(LINKED_ACCOUNT_ID, body),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
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
                "INSERT INTO STUDY_PROGRAM (ID, TITLE, STUDY_KIND, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, 'STUDY', ?, ?)",
                STUDY_ID,
                "신청 저장 프로그램",
                now,
                now);

        if (hasStudyColumn("IS_HIDDEN")) {
            insertStudyWithLegacyColumns(now);
            return;
        }

        jdbcTemplate.update(
                "INSERT INTO STUDY (ID, PROGRAM_ID, TITLE, ONE_LINE_SUMMARY, DESCRIPTION,"
                        + " CATEGORY, STATUS,"
                        + " APPLICATION_FORM, SCHEDULE, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)",
                STUDY_ID,
                STUDY_ID,
                "신청 저장 스터디",
                "한 줄 소개",
                "상세 소개",
                "SOFTWARE",
                "OPEN",
                """
                {"title":"신청","description":null,"questions":[{"id":"reason","label":"지원 사유","type":"TEXTAREA","required":true,"options":null,"allowOther":null}]}
                """,
                "매주 수 20:00",
                now,
                now);
    }

    private boolean hasStudyColumn(String columnName) {
        Integer count =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS"
                                + " WHERE TABLE_NAME = 'STUDY' AND COLUMN_NAME = ?",
                        Integer.class,
                        columnName);
        return count != null && count > 0;
    }

    private void insertStudyWithLegacyColumns(Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY (ID, PROGRAM_ID, TITLE, SLUG, ONE_LINE_SUMMARY, DESCRIPTION,"
                        + " CATEGORY, IS_HIDDEN, STUDY_DELIVERY_FORMAT, STATUS,"
                        + " APPLICATION_FORM, SCHEDULE, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)",
                STUDY_ID,
                STUDY_ID,
                "신청 저장 스터디",
                "application-submission-test",
                "한 줄 소개",
                "상세 소개",
                "SOFTWARE",
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
        jdbcTemplate.update("DELETE FROM STUDY_PROGRAM WHERE ID = ?", STUDY_ID);
        jdbcTemplate.update(
                "DELETE FROM ACCOUNT WHERE ID IN (?, ?, 10650, 10651, 10652)",
                LINKED_ACCOUNT_ID,
                UNLINKED_ACCOUNT_ID);
    }
}
