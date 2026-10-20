package com.studyclub.api.stats;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

/** 대시보드 stats API — 권한·핵심 집계·모집 보드 신청서 수 기준. specs/dashboard/spec.md */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStatsIntegrationTest {

    private static final Long ADMIN_ID = 9701L;
    private static final Long MEMBER_ID = 9702L;
    private static final Long CREW_A = 9703L;
    private static final Long CREW_B = 9704L;
    private static final Long ONGOING_STUDY = 9801L;
    private static final Long OPEN_STUDY = 9802L;
    private static final Long GROUP_ID = 9811L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seed() {
        Timestamp now = Timestamp.from(Instant.now());
        clean();
        insertAccount(ADMIN_ID, "admin-dash@example.com", SystemRole.ADMIN, "Asia/Seoul", now);
        insertAccount(MEMBER_ID, "member-dash@example.com", SystemRole.MEMBER, "Asia/Seoul", now);
        insertAccount(CREW_A, "crew-a@example.com", SystemRole.MEMBER, "Asia/Seoul", now);
        insertAccount(CREW_B, "crew-b@example.com", SystemRole.MEMBER, "America/New_York", now);

        // 제목을 AAA 로 시작해 보드 미리보기(최대 4건) 정렬에서 항상 앞에 오게 한다
        insertStudy(ONGOING_STUDY, "AAA 대시보드 진행중", "ALGORITHM", "ONGOING", now);
        insertStudy(OPEN_STUDY, "AAA 대시보드 모집중", "SOFTWARE", "OPEN", now);
        insertGroup(GROUP_ID, ONGOING_STUDY, now);
        insertParticipant(CREW_A, ONGOING_STUDY, GROUP_ID, ParticipantStatus.ACTIVE, now);
        insertParticipant(CREW_B, ONGOING_STUDY, GROUP_ID, ParticipantStatus.ACTIVE, now);
        insertRecruitment(OPEN_STUDY, 1, Instant.now().plus(2, ChronoUnit.DAYS), now);
        insertApplication(CREW_A, latestRecruitmentId(OPEN_STUDY), now);
    }

    @Test
    @DisplayName("실패 - MEMBER 는 403 FORBIDDEN")
    void memberForbidden() {
        var response =
                rest.exchange(
                        "/api/admin/stats/summary", HttpMethod.GET, auth(MEMBER_ID), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 잘못된 timeZone 은 400 INVALID_INPUT")
    void invalidTimeZone() {
        var response =
                rest.exchange(
                        "/api/admin/stats/summary?timeZone=Not/AZone",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("성공 - summary 활성 크루·커뮤니티·errors 빈 객체")
    void summaryHappyPath() {
        var response =
                rest.exchange(
                        "/api/admin/stats/summary?timeZone=Asia/Seoul",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = response.getBody();
        assertThat(body)
                .containsEntry("timeZone", "Asia/Seoul")
                .containsKey("communityMembers")
                .containsKey("asOf")
                .containsKey("errors");
        // 공유 DB — 다른 테스트의 ONGOING ACTIVE 가 섞일 수 있어 하한만 본다
        assertThat(((Number) body.get("activeCrew")).longValue()).isGreaterThanOrEqualTo(2);
        assertThat(((Number) body.get("activeEnrollments")).longValue()).isGreaterThanOrEqualTo(2);
        assertThat(((Map<?, ?>) body.get("errors"))).isEmpty();
        assertThat(((Number) body.get("communityMembers")).longValue()).isGreaterThanOrEqualTo(4);
    }

    @Test
    @DisplayName("성공 - study-board ONGOING 은 제목순·모집 필드 null")
    void ongoingBoard() {
        var response =
                rest.exchange(
                        "/api/admin/stats/study-board?view=ONGOING",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("view", "ONGOING");
        assertThat(((Number) body.get("total")).longValue()).isGreaterThanOrEqualTo(1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        Map<String, Object> ours =
                items.stream()
                        .filter(i -> ((Number) i.get("studyId")).longValue() == ONGOING_STUDY)
                        .findFirst()
                        .orElseThrow();
        assertThat(ours).containsEntry("title", "AAA 대시보드 진행중");
        assertThat(ours)
                .containsEntry("recruitStatus", null)
                .containsEntry("recruitDeadlineAt", null)
                .containsEntry("deadlineBadge", null);
    }

    @Test
    @DisplayName("성공 - 진행중 보드는 전체 목록의 첫 최대 4건과 같은 DB 정렬을 쓴다")
    void ongoingBoardMatchesAdminListOrder() {
        var board =
                rest.exchange(
                        "/api/admin/stats/study-board?view=ONGOING",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        var list =
                rest.exchange(
                        "/api/admin/studies?status=ONGOING&sort=TITLE_ASC&offset=0&limit=20",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);

        assertThat(board.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(list.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyIds(board.getBody()))
                .isEqualTo(studyIds(list.getBody()).stream().limit(4).toList());
        assertThat(((Number) board.getBody().get("total")).longValue())
                .isEqualTo(((Number) list.getBody().get("total")).longValue());
    }

    @Test
    @DisplayName("성공 - study-board RECRUITMENT 는 신청서 수로 정원 마감·CLOSING_SOON")
    void recruitmentBoardCapacityAndClosingSoon() {
        var response =
                rest.exchange(
                        "/api/admin/stats/study-board?view=RECRUITMENT&timeZone=Asia/Seoul",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items =
                (List<Map<String, Object>>) response.getBody().get("items");
        Map<String, Object> ours =
                items.stream()
                        .filter(i -> ((Number) i.get("studyId")).longValue() == OPEN_STUDY)
                        .findFirst()
                        .orElseThrow();
        assertThat(ours)
                .containsEntry("recruitStatus", "RECRUIT_CLOSED")
                .containsEntry("deadlineBadge", "CAPACITY_FULL");
    }

    @Test
    @DisplayName("성공 - crew-timezones 는 KST·ET 인원을 나눈다")
    void crewTimezones() {
        var response =
                rest.exchange(
                        "/api/admin/stats/crew-timezones",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((Number) response.getBody().get("totalCrew")).longValue())
                .isGreaterThanOrEqualTo(2);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> groups =
                (List<Map<String, Object>>) response.getBody().get("timeZoneGroups");
        assertThat(groups).hasSize(4);
        assertThat(groupCount(groups, "KST")).isGreaterThanOrEqualTo(1);
        assertThat(groupCount(groups, "ET")).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("성공 - studies-by-category 와 attendance-trend 12점")
    void categoryAndTrend() {
        var categories =
                rest.exchange(
                        "/api/admin/stats/studies-by-category",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        assertThat(categories.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(categories.getBody()).containsKey("categories");

        var trend =
                rest.exchange(
                        "/api/admin/stats/attendance-trend?weeks=12&timeZone=UTC",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        assertThat(trend.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        List<?> points = (List<?>) trend.getBody().get("points");
        assertThat(points).hasSize(12);
        assertThat(trend.getBody()).containsEntry("timeZone", "UTC");
    }

    @Test
    @DisplayName("실패 - weeks 가 12가 아니면 400")
    void weeksMustBeTwelve() {
        var response =
                rest.exchange(
                        "/api/admin/stats/attendance-trend?weeks=8",
                        HttpMethod.GET,
                        auth(ADMIN_ID),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private static long groupCount(List<Map<String, Object>> groups, String code) {
        return groups.stream()
                .filter(g -> code.equals(g.get("code")))
                .map(g -> ((Number) g.get("count")).longValue())
                .findFirst()
                .orElse(0L);
    }

    @SuppressWarnings("unchecked")
    private static List<Long> studyIds(Map<?, ?> body) {
        return ((List<Map<String, Object>>) body.get("items"))
                .stream().map(item -> ((Number) item.get("studyId")).longValue()).toList();
    }

    private HttpEntity<Void> auth(Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(headers);
    }

    private void clean() {
        jdbcTemplate.update(
                "DELETE FROM STUDY_APPLICATION WHERE ACCOUNT_ID IN (?, ?, ?, ?)",
                ADMIN_ID,
                MEMBER_ID,
                CREW_A,
                CREW_B);
        jdbcTemplate.update(
                "DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID IN (?, ?)",
                ONGOING_STUDY,
                OPEN_STUDY);
        jdbcTemplate.update("DELETE FROM STUDY_MEETING WHERE STUDY_GROUP_ID = ?", GROUP_ID);
        jdbcTemplate.update("DELETE FROM STUDY_GROUP WHERE ID = ?", GROUP_ID);
        jdbcTemplate.update(
                "DELETE FROM STUDY_RECRUITMENT WHERE STUDY_ID IN (?, ?)",
                ONGOING_STUDY,
                OPEN_STUDY);
        jdbcTemplate.update("DELETE FROM STUDY WHERE ID IN (?, ?)", ONGOING_STUDY, OPEN_STUDY);
        jdbcTemplate.update(
                "DELETE FROM STUDY_PROGRAM WHERE ID IN (?, ?)", ONGOING_STUDY, OPEN_STUDY);
        jdbcTemplate.update(
                "DELETE FROM ACCOUNT WHERE ID IN (?, ?, ?, ?)",
                ADMIN_ID,
                MEMBER_ID,
                CREW_A,
                CREW_B);
    }

    private void insertAccount(
            Long id, String email, SystemRole role, String timeZone, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                "dash_" + id,
                role.name(),
                timeZone,
                now,
                now,
                now);
    }

    private void insertStudy(Long id, String title, String category, String status, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_PROGRAM (ID, TITLE, STUDY_KIND, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, 'STUDY', ?, ?)",
                id,
                title,
                now,
                now);
        jdbcTemplate.update(
                "INSERT INTO STUDY (ID, PROGRAM_ID, TITLE, ONE_LINE_SUMMARY, CATEGORY, STATUS,"
                        + " CREATED_AT, UPDATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                id,
                title,
                "요약",
                category,
                status,
                now,
                now);
    }

    private void insertGroup(Long id, Long studyId, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_GROUP (ID, STUDY_ID, NAME, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?)",
                id,
                studyId,
                "A반",
                now,
                now);
    }

    private void insertParticipant(
            Long accountId, Long studyId, Long groupId, ParticipantStatus status, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT (ACCOUNT_ID, STUDY_GROUP_ID, STUDY_ID, STATUS,"
                        + " PARTICIPANT_ROLE, JOINED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                accountId,
                groupId,
                studyId,
                status.name(),
                ParticipantRole.MEMBER.name(),
                now,
                now,
                now);
    }

    private void insertRecruitment(
            Long studyId, Integer capacity, Instant deadline, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_RECRUITMENT (STUDY_ID, TITLE, DESCRIPTION, START_AT,"
                        + " RECRUIT_DEADLINE_AT, RECRUITMENT_CAPACITY, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                studyId,
                "모집",
                "설명",
                Timestamp.from(Instant.now().minusSeconds(3600)),
                Timestamp.from(deadline),
                capacity,
                now,
                now);
    }

    private long latestRecruitmentId(Long studyId) {
        return jdbcTemplate.queryForObject(
                "SELECT MAX(ID) FROM STUDY_RECRUITMENT WHERE STUDY_ID = ?", Long.class, studyId);
    }

    private void insertApplication(Long accountId, long recruitmentId, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_APPLICATION (ACCOUNT_ID, RECRUITMENT_ID, FORM_ANSWER,"
                        + " CREATED_AT, UPDATED_AT) VALUES (?, ?, CAST(? AS JSON), ?, ?)",
                accountId,
                recruitmentId,
                "{\"discordNickname\":\"n\"}",
                now,
                now);
    }
}
