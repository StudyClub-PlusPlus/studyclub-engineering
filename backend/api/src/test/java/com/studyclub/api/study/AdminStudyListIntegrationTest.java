package com.studyclub.api.study;

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

/**
 * 픽스처 — 스터디 3건.
 *
 * <ul>
 *   <li>알고리즘 스터디: OPEN · ALGORITHM · STUDY 종류 · 정원 20
 *   <li>드래프트 스터디: DRAFT · SOFTWARE · STUDY 종류
 *   <li>클럽 스터디: OPEN · LANGUAGE · CLUB 종류 · 정원 15
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyListIntegrationTest {

    private static final Long ADMIN_ID = 9501L;
    private static final Long MEMBER_ID = 9502L;
    private static final Long STUDY_ID = 9601L;
    private static final Long DRAFT_STUDY_ID = 9602L;
    private static final Long CLUB_STUDY_ID = 9603L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seed() {
        Timestamp now = Timestamp.from(Instant.now());
        cleanSeedRows();
        insertAccount(ADMIN_ID, "admin-studylist@example.com", SystemRole.ADMIN, now);
        insertAccount(MEMBER_ID, "member-studylist@example.com", SystemRole.MEMBER, now);
        insertStudy(
                STUDY_ID,
                "al-open-algo",
                "알고리즘 스터디",
                "ALGORITHM",
                "STUDY",
                "OPEN",
                "{\"questions\":[{\"id\":\"reason\",\"label\":\"지원 사유\",\"type\":\"TEXT\",\"required\":true}]}",
                now);
        insertStudy(
                DRAFT_STUDY_ID,
                "al-draft-sw",
                "드래프트 스터디",
                "SOFTWARE",
                "STUDY",
                "DRAFT",
                "{\"questions\":[]}",
                now);
        insertStudy(
                CLUB_STUDY_ID,
                "al-open-club",
                "클럽 스터디",
                "LANGUAGE",
                "CLUB",
                "OPEN",
                "{\"questions\":[]}",
                now);
        insertRecruitment(STUDY_ID, 20, now);
        insertRecruitment(DRAFT_STUDY_ID, null, now);
        insertRecruitment(CLUB_STUDY_ID, 15, now);
    }

    @Test
    @DisplayName("성공 - ADMIN이 필터 없이 조회하면 DRAFT를 포함한 전체 스터디 목록을 반환한다")
    void adminGetsAllStudiesIncludingDraft() {
        var response =
                rest.exchange(
                        "/api/admin/studies",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Long> ids = studyIds(response.getBody());
        assertThat(ids).contains(STUDY_ID, DRAFT_STUDY_ID, CLUB_STUDY_ID);
    }

    @Test
    @DisplayName("성공 - 응답에 제목·상태·카테고리·종류·모집정원이 조립된다")
    void responseFieldsAreAssembled() {
        var response =
                rest.exchange(
                        "/api/admin/studies",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> study = itemById(response.getBody(), STUDY_ID);
        assertThat(study)
                .containsEntry("title", "알고리즘 스터디")
                .containsEntry("status", "OPEN")
                .containsEntry("category", "ALGORITHM")
                .containsEntry("studyKind", "STUDY")
                .containsEntry("recruitmentCapacity", 20)
                .containsEntry("hasApplicationForm", true)
                .containsKeys("recruitmentStartAt", "recruitDeadlineAt")
                .doesNotContainKey("leaderNickname");

        Map<String, Object> draft = itemById(response.getBody(), DRAFT_STUDY_ID);
        assertThat(draft).containsEntry("hasApplicationForm", false);
    }

    @Test
    @DisplayName("성공 - category 필터를 주면 해당 카테고리 스터디만 반환한다")
    void filterByCategory() {
        var response =
                rest.exchange(
                        "/api/admin/studies?category=ALGORITHM",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Long> ids = studyIds(response.getBody());
        assertThat(ids).contains(STUDY_ID);
        assertThat(ids).doesNotContain(CLUB_STUDY_ID, DRAFT_STUDY_ID);
    }

    @Test
    @DisplayName("성공 - studyKind 필터를 주면 해당 종류 스터디만 반환한다")
    void filterByStudyKind() {
        var response =
                rest.exchange(
                        "/api/admin/studies?studyKind=CLUB",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Long> ids = studyIds(response.getBody());
        assertThat(ids).contains(CLUB_STUDY_ID);
        assertThat(ids).doesNotContain(STUDY_ID, DRAFT_STUDY_ID);
    }

    @Test
    @DisplayName("성공 - status 필터를 주면 해당 상태의 스터디만 반환한다")
    void filterByStatus() {
        var response =
                rest.exchange(
                        "/api/admin/studies?status=DRAFT",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Long> ids = studyIds(response.getBody());
        // 다른 테스트 클래스가 같은 DB 에 DRAFT 스터디를 남길 수 있다 — 픽스처 포함 여부와 상태만 본다
        assertThat(ids).contains(DRAFT_STUDY_ID).doesNotContain(STUDY_ID, CLUB_STUDY_ID);
        assertThat(items(response.getBody()))
                .allSatisfy(item -> assertThat(item.get("status")).isEqualTo("DRAFT"));
    }

    @Test
    @DisplayName("성공 - 첫 번째 페이지 조회 시 limit 개수만큼 반환되고 total은 전체 수다")
    void paginationFirstPage() {
        var response =
                rest.exchange(
                        "/api/admin/studies?limit=2&offset=0",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = response.getBody();
        assertThat(items(body)).hasSize(2);
        assertThat(((Number) body.get("total")).longValue()).isEqualTo(studyRowCount());
    }

    @Test
    @DisplayName("성공 - 마지막 페이지 조회 시 남은 1건만 반환된다")
    void paginationLastPage() {
        long total = studyRowCount();
        var response =
                rest.exchange(
                        "/api/admin/studies?limit=2&offset=" + (total - 1),
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = response.getBody();
        assertThat(items(body)).hasSize(1);
        assertThat(((Number) body.get("total")).longValue()).isEqualTo(total);
    }

    @Test
    @DisplayName("성공 - 마지막 페이지를 넘긴 offset 은 빈 목록과 전체 수를 준다")
    void paginationPastLastPage() {
        long total = studyRowCount();
        var response =
                rest.exchange(
                        "/api/admin/studies?limit=2&offset=" + (total + 10),
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = response.getBody();
        assertThat(items(body)).isEmpty();
        assertThat(((Number) body.get("total")).longValue()).isEqualTo(total);
    }

    @Test
    @DisplayName("성공 - 필터 없이 조회하면 응답에 total·offset·limit이 포함된다")
    void responseIncludesTotalOffsetLimit() {
        var response =
                rest.exchange(
                        "/api/admin/studies",
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = response.getBody();
        assertThat(((Number) body.get("total")).longValue()).isEqualTo(studyRowCount());
        assertThat(((Number) body.get("offset")).intValue()).isEqualTo(0);
        assertThat(((Number) body.get("limit")).intValue()).isEqualTo(20);
    }

    @Test
    @DisplayName("실패 - 토큰 없이 조회하면 401 + errorCode UNAUTHORIZED")
    void rejectsUnauthenticatedRequest() {
        var response =
                rest.exchange("/api/admin/studies", HttpMethod.GET, HttpEntity.EMPTY, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - ADMIN 이 아닌 계정은 403 + errorCode FORBIDDEN")
    void rejectsNonAdmin() {
        var response =
                rest.exchange(
                        "/api/admin/studies",
                        HttpMethod.GET,
                        authenticatedRequest(MEMBER_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<?, ?> body) {
        return (List<Map<String, Object>>) body.get("items");
    }

    private static List<Long> studyIds(Map<?, ?> body) {
        return items(body).stream().map(i -> ((Number) i.get("studyId")).longValue()).toList();
    }

    private static Map<String, Object> itemById(Map<?, ?> body, Long studyId) {
        return items(body).stream()
                .filter(i -> ((Number) i.get("studyId")).longValue() == studyId)
                .findFirst()
                .orElseThrow();
    }

    private HttpEntity<Void> authenticatedRequest(Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(headers);
    }

    // 같은 DB 를 다른 테스트 클래스와 같이 쓴다 — 전체 수는 픽스처 3건이 아니라 실제 행 수와 비교한다
    private long studyRowCount() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM STUDY", Long.class);
    }

    private void cleanSeedRows() {
        jdbcTemplate.update(
                "DELETE FROM STUDY_RECRUITMENT WHERE STUDY_ID IN (?, ?, ?)",
                STUDY_ID,
                DRAFT_STUDY_ID,
                CLUB_STUDY_ID);
        jdbcTemplate.update(
                "DELETE FROM STUDY WHERE ID IN (?, ?, ?)", STUDY_ID, DRAFT_STUDY_ID, CLUB_STUDY_ID);
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID IN (?, ?)", ADMIN_ID, MEMBER_ID);
    }

    private void insertAccount(Long id, String email, SystemRole role, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                "studylist_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }

    private void insertStudy(
            Long id,
            String slug,
            String title,
            String category,
            String kind,
            String status,
            String applicationForm,
            Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY (ID, PROGRAM_ID, TITLE, SLUG, ONE_LINE_SUMMARY, CATEGORY,"
                        + " STUDY_KIND, STUDY_DELIVERY_FORMAT, STATUS, APPLICATION_FORM,"
                        + " CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)",
                id,
                id,
                title,
                slug,
                "한 줄 소개",
                category,
                kind,
                "ONLINE",
                status,
                applicationForm,
                now,
                now);
    }

    private void insertRecruitment(Long studyId, Integer capacity, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO STUDY_RECRUITMENT (STUDY_ID, TITLE, DESCRIPTION, START_AT,"
                        + " RECRUIT_DEADLINE_AT, RECRUITMENT_CAPACITY, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                studyId,
                "모집",
                "모집 설명",
                Timestamp.from(Instant.now().minusSeconds(3600)),
                Timestamp.from(Instant.now().plusSeconds(3600)),
                capacity,
                now,
                now);
    }
}
