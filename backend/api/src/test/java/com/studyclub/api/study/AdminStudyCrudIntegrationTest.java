package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.study.StudyRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 백오피스 스터디 상세·등록·수정·삭제({@code /api/admin/studies}). 핵심은 <b>네비게이터가 이 경로에서는 403</b> 이라는 것 — 네비게이터는
 * 사용자 사이트 경로({@code GET·PATCH /api/studies/{id}}, {@link
 * StudyDetailVisibilityIntegrationTest}·{@link StudyUpdateIntegrationTest})를 쓴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyCrudIntegrationTest {

    private static final Long ADMIN_ID = 8510L;
    private static final Long MEMBER_ID = 8511L;
    private static final Long NAVIGATOR_ID = 8512L;
    private static final long MISSING_STUDY_ID = 999_999_999L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired StudyDiscordLinkRepository studyDiscordLinkRepository;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        Timestamp now = Timestamp.from(Instant.now());
        insertAccountIfAbsent(ADMIN_ID, "admin-admin-study@example.test", SystemRole.ADMIN, now);
        insertAccountIfAbsent(MEMBER_ID, "member-admin-study@example.test", SystemRole.MEMBER, now);
        insertAccountIfAbsent(
                NAVIGATOR_ID, "navigator-admin-study@example.test", SystemRole.MEMBER, now);
        // STUDY_PARTICIPANT 는 (ACCOUNT_ID, STUDY_GROUP_ID) 가 유니크다. 테스트마다 다른 스터디의 네비게이터로 세우므로
        // 앞 테스트가 남긴 행을 지운다 — 이 계정은 이 테스트 전용이다
        jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE ACCOUNT_ID = ?", NAVIGATOR_ID);
    }

    // ── 상세 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(상세) - ADMIN 은 DRAFT 스터디도 200 으로 조회한다")
    void adminGetsDraftDetail() {
        Long studyId = createStudy("백오피스 상세");

        var response = exchange(HttpMethod.GET, "/api/admin/studies/" + studyId, ADMIN_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("title", "백오피스 상세")
                .containsEntry("status", "DRAFT");
    }

    @Test
    @DisplayName("상세의 연결 여부는 URL 입력 여부가 아닌 저장된 디스코드 연결을 따른다")
    void detailReflectsDiscordLink() {
        Long studyId = createStudy("디스코드 연결 상태");
        jdbcTemplate.update(
                "UPDATE STUDY SET DISCORD_CHANNEL_URL = ? WHERE ID = ?",
                "https://discord.com/channels/123/456",
                studyId);
        var unlinked = exchange(HttpMethod.GET, "/api/admin/studies/" + studyId, ADMIN_ID, null);
        assertThat(unlinked.getBody()).containsEntry("discordLinked", false);

        studyDiscordLinkRepository.save(
                new StudyDiscordLink(studyId, "1327394882193883136", "1327394882193883140"));
        jdbcTemplate.update("UPDATE STUDY SET DISCORD_CHANNEL_URL = NULL WHERE ID = ?", studyId);
        var linked = exchange(HttpMethod.GET, "/api/admin/studies/" + studyId, ADMIN_ID, null);
        assertThat(linked.getBody()).containsEntry("discordLinked", true);
    }

    @Test
    @DisplayName("실패(상세) - 토큰 없이 조회하면 401 + errorCode UNAUTHORIZED")
    void detailRejectsUnauthenticated() {
        Long studyId = createStudy("상세 401");

        var response =
                rest.exchange(
                        "/api/admin/studies/" + studyId,
                        HttpMethod.GET,
                        HttpEntity.EMPTY,
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패(상세) - 그 스터디의 네비게이터도 백오피스 경로에서는 403")
    void detailRejectsNavigator() {
        Long studyId = createStudy("상세 네비게이터");
        insertParticipantIfAbsent(studyId, NAVIGATOR_ID, ParticipantRole.LEADER);

        var response =
                exchange(HttpMethod.GET, "/api/admin/studies/" + studyId, NAVIGATOR_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패(상세) - 없는 스터디는 404 + errorCode NOT_FOUND")
    void detailNotFound() {
        var response =
                exchange(HttpMethod.GET, "/api/admin/studies/" + MISSING_STUDY_ID, ADMIN_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    // ── 등록 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(등록) - ADMIN 이 등록하면 201 + Location 이 백오피스 상세 경로다")
    void adminCreates() {
        var response =
                rest.postForEntity(
                        "/api/admin/studies",
                        authenticated(ADMIN_ID, createBody("백오피스 등록")),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        assertThat(path).startsWith("/api/admin/studies/");
        Long studyId = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        assertThat(studyRepository.findById(studyId)).isPresent();
    }

    @Test
    @DisplayName("실패(등록) - 제목이 없으면 400 + errorCode INVALID_INPUT")
    void createRejectsMissingTitle() {
        Map<String, Object> body = Map.of("oneLineSummary", "소개", "category", "DATA");

        var response = exchange(HttpMethod.POST, "/api/admin/studies", ADMIN_ID, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패(등록) - ADMIN 이 아닌 계정은 403 + errorCode FORBIDDEN")
    void createRejectsMember() {
        var response =
                exchange(HttpMethod.POST, "/api/admin/studies", MEMBER_ID, createBody("회원 등록"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    // ── 수정 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(수정) - ADMIN 이 수정하면 204 + DB 값이 바뀐다")
    void adminUpdates() {
        Long studyId = createStudy("수정 전");

        var response =
                exchange(
                        HttpMethod.PATCH,
                        "/api/admin/studies/" + studyId,
                        ADMIN_ID,
                        Map.of("title", "수정 후"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId).orElseThrow().getTitle()).isEqualTo("수정 후");
    }

    @Test
    @DisplayName("실패(수정) - 그 스터디의 네비게이터도 백오피스 경로에서는 403, 값은 그대로다")
    void updateRejectsNavigator() {
        Long studyId = createStudy("네비게이터 수정 전");
        insertParticipantIfAbsent(studyId, NAVIGATOR_ID, ParticipantRole.LEADER);

        var response =
                exchange(
                        HttpMethod.PATCH,
                        "/api/admin/studies/" + studyId,
                        NAVIGATOR_ID,
                        Map.of("title", "바꿈"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
        assertThat(studyRepository.findById(studyId).orElseThrow().getTitle())
                .isEqualTo("네비게이터 수정 전");
    }

    @Test
    @DisplayName("실패(수정) - 제목을 빈 문자열로 보내면 400 + errorCode INVALID_INPUT")
    void updateRejectsBlankTitle() {
        Long studyId = createStudy("빈 제목");

        var response =
                exchange(
                        HttpMethod.PATCH,
                        "/api/admin/studies/" + studyId,
                        ADMIN_ID,
                        Map.of("title", "  "));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패(수정) - 없는 스터디는 404 + errorCode NOT_FOUND")
    void updateNotFound() {
        var response =
                exchange(
                        HttpMethod.PATCH,
                        "/api/admin/studies/" + MISSING_STUDY_ID,
                        ADMIN_ID,
                        Map.of("title", "없음"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    // ── 모집 시간대 · 날짜 입력 (specs/timezone/spec.md §3.2 · §7) ─────────────────────

    @Test
    @DisplayName("성공(모집 시간대) - 등록 때 고른 지역을 정본 ID 로 저장하고 상세가 라벨과 함께 준다")
    void createSavesRecruitmentTimeZones() {
        Map<String, Object> body = new HashMap<>(createBody("모집 시간대 등록"));
        body.put(
                "recruitmentTimeZones",
                Map.of("mode", "selected", "zones", List.of("US/Pacific", "Asia/Seoul")));
        Long studyId = createStudy(body);

        var response = exchange(HttpMethod.GET, "/api/admin/studies/" + studyId, ADMIN_ID, null);

        assertThat(response.getBody())
                .containsEntry(
                        "recruitmentTimeZones",
                        Map.of(
                                "mode",
                                "selected",
                                "zones",
                                List.of("Asia/Seoul", "America/Los_Angeles")))
                .containsEntry("recruitmentTimeZoneLabel", "한국 / 미국 · LA")
                .doesNotContainKey("timezone");
        assertThat(zonesInDb(studyId))
                .containsExactlyInAnyOrder("Asia/Seoul", "America/Los_Angeles");
    }

    @Test
    @DisplayName("성공(모집 시간대) - 안 고르면 unset(미정)이다. 일정 문구로 추정하지 않는다")
    void createWithoutRecruitmentTimeZonesIsUnset() {
        Map<String, Object> body = new HashMap<>(createBody("모집 시간대 미정"));
        body.put("schedule", "매주 목 20:00 KST");
        Long studyId = createStudy(body);

        var response = exchange(HttpMethod.GET, "/api/admin/studies/" + studyId, ADMIN_ID, null);

        assertThat(response.getBody())
                .containsEntry("recruitmentTimeZones", Map.of("mode", "unset", "zones", List.of()))
                .containsEntry("recruitmentTimeZoneLabel", "미정");
    }

    @Test
    @DisplayName("실패(모집 시간대) - 오프셋 · 빈 selected · all 에 지역 · 모르는 mode 는 400 + INVALID_INPUT")
    void createRejectsInvalidRecruitmentTimeZones() {
        for (Map<String, Object> value :
                List.<Map<String, Object>>of(
                        Map.of("mode", "selected", "zones", List.of("+09:00")),
                        Map.of("mode", "selected", "zones", List.of()),
                        Map.of("mode", "all", "zones", List.of("Asia/Seoul")),
                        Map.of("mode", "both", "zones", List.of()))) {
            Map<String, Object> body = new HashMap<>(createBody("모집 시간대 오류"));
            body.put("recruitmentTimeZones", value);

            var response = exchange(HttpMethod.POST, "/api/admin/studies", ADMIN_ID, body);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
    }

    @Test
    @DisplayName("성공(모집 시간대) - 수정으로 바꾸고, 키를 빼면 유지하고, null 이면 미정으로 되돌린다")
    void updateChangesRecruitmentTimeZones() {
        Long studyId = createStudy("모집 시간대 수정");
        String url = "/api/admin/studies/" + studyId;

        assertThat(
                        exchange(
                                HttpMethod.PATCH,
                                url,
                                ADMIN_ID,
                                Map.of(
                                        "recruitmentTimeZones",
                                        Map.of(
                                                "mode",
                                                "selected",
                                                "zones",
                                                List.of("Asia/Seoul")))))
                .extracting(ResponseEntity::getStatusCode)
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(zonesInDb(studyId)).containsExactly("Asia/Seoul");

        exchange(
                HttpMethod.PATCH,
                url,
                ADMIN_ID,
                Map.of(
                        "recruitmentTimeZones",
                        Map.of(
                                "mode",
                                "selected",
                                "zones",
                                List.of("Asia/Seoul", "Europe/London"))));
        assertThat(zonesInDb(studyId)).containsExactlyInAnyOrder("Asia/Seoul", "Europe/London");

        exchange(HttpMethod.PATCH, url, ADMIN_ID, Map.of("title", "모집 시간대 그대로"));
        assertThat(zonesInDb(studyId)).containsExactlyInAnyOrder("Asia/Seoul", "Europe/London");

        exchange(
                HttpMethod.PATCH,
                url,
                ADMIN_ID,
                Map.of("recruitmentTimeZones", Map.of("mode", "all", "zones", List.of())));
        assertThat(modeInDb(studyId)).isEqualTo("all");
        assertThat(zonesInDb(studyId)).isEmpty();

        Map<String, Object> clear = new HashMap<>();
        clear.put("recruitmentTimeZones", null);
        exchange(HttpMethod.PATCH, url, ADMIN_ID, clear);
        assertThat(modeInDb(studyId)).isEqualTo("unset");
    }

    @Test
    @DisplayName("성공(날짜 입력) - 날짜만 보낸 마감은 displayTimeZone 의 23:59:59, 시작일은 00:00 으로 저장한다")
    void createConvertsDateInputWithDisplayTimeZone() {
        String deadlineDate = LocalDate.now().plusDays(30).toString();
        String startDate = LocalDate.now().plusDays(40).toString();
        Map<String, Object> body = new HashMap<>(createBody("날짜 입력"));
        body.put("recruitDeadline", deadlineDate);
        body.put("startAt", startDate);

        Long studyId = createStudy(body, "?displayTimeZone=America/Toronto");

        var detail =
                exchange(
                                HttpMethod.GET,
                                "/api/admin/studies/"
                                        + studyId
                                        + "?displayTimeZone=America/Toronto",
                                ADMIN_ID,
                                null)
                        .getBody();
        assertThat(Instant.parse((String) detail.get("recruitDeadlineAt")))
                .isEqualTo(
                        LocalDate.parse(deadlineDate)
                                .atTime(23, 59, 59)
                                .atZone(ZoneId.of("America/Toronto"))
                                .toInstant());
        assertThat(Instant.parse((String) detail.get("startAt")))
                .isEqualTo(
                        LocalDate.parse(startDate)
                                .atStartOfDay(ZoneId.of("America/Toronto"))
                                .toInstant());
        @SuppressWarnings("unchecked")
        var formatted = (Map<String, Object>) detail.get("recruitDeadlineFormatted");
        assertThat(formatted)
                .containsEntry("displayTimeZone", "America/Toronto")
                .containsEntry("localDate", deadlineDate)
                .containsEntry("localTime", "23:59");
        assertThat(detail).containsEntry("displayTimeZone", "America/Toronto");
    }

    @Test
    @DisplayName("성공(날짜 입력) - displayTimeZone 이 없으면 운영자의 저장된 헤더 → 프로필 → 서울로 해석한다")
    void dateInputFallsBackToSeoul() {
        String deadlineDate = LocalDate.now().plusDays(30).toString();
        Map<String, Object> body = new HashMap<>(createBody("날짜 입력 기본"));
        body.put("recruitDeadline", deadlineDate);

        Long studyId = createStudy(body);

        var detail = exchange(HttpMethod.GET, "/api/admin/studies/" + studyId, ADMIN_ID, null);
        assertThat(Instant.parse((String) detail.getBody().get("recruitDeadlineAt")))
                .isEqualTo(
                        LocalDate.parse(deadlineDate)
                                .atTime(23, 59, 59)
                                .atZone(ZoneId.of("Asia/Seoul"))
                                .toInstant());
    }

    @Test
    @DisplayName("성공(날짜 입력) - 마감을 보내지 않은 수정은 표시 시간대가 달라도 저장된 마감 UTC 를 바꾸지 않는다")
    void updateWithoutDeadlineKeepsUtc() {
        Instant deadline = Instant.now().plus(20, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        Map<String, Object> body = new HashMap<>(createBody("마감 그대로"));
        body.put("recruitDeadline", deadline.toString());
        Long studyId = createStudy(body, "?displayTimeZone=Asia/Seoul");

        exchange(
                HttpMethod.PATCH,
                "/api/admin/studies/" + studyId + "?displayTimeZone=America/Los_Angeles",
                ADMIN_ID,
                Map.of("title", "제목만 수정"));

        var detail = exchange(HttpMethod.GET, "/api/admin/studies/" + studyId, ADMIN_ID, null);
        assertThat(Instant.parse((String) detail.getBody().get("recruitDeadlineAt")))
                .isEqualTo(deadline);
    }

    @Test
    @DisplayName("실패(날짜 입력) - displayTimeZone 이 오프셋이거나 비었으면 400, 날짜 형식이 틀리면 400")
    void rejectsInvalidDisplayTimeZoneAndDate() {
        Map<String, Object> body = new HashMap<>(createBody("표시 시간대 오류"));
        body.put("recruitDeadline", LocalDate.now().plusDays(3).toString());

        for (String query : List.of("?displayTimeZone=UTC%2B09:00", "?displayTimeZone=")) {
            var response = exchange(HttpMethod.POST, "/api/admin/studies" + query, ADMIN_ID, body);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }

        Map<String, Object> badDate = new HashMap<>(createBody("날짜 형식 오류"));
        badDate.put("recruitDeadline", "2026/12/01");
        assertThat(
                        exchange(HttpMethod.POST, "/api/admin/studies", ADMIN_ID, badDate)
                                .getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private List<String> zonesInDb(Long studyId) {
        return jdbcTemplate.queryForList(
                "SELECT z.TIME_ZONE FROM STUDY_RECRUITMENT_ZONE z JOIN STUDY_RECRUITMENT r"
                        + " ON r.ID = z.STUDY_RECRUITMENT_ID WHERE r.STUDY_ID = ?",
                String.class,
                studyId);
    }

    private String modeInDb(Long studyId) {
        return jdbcTemplate.queryForObject(
                "SELECT RECRUITMENT_TZ_MODE FROM STUDY_RECRUITMENT WHERE STUDY_ID = ?",
                String.class,
                studyId);
    }

    // ── 삭제 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공(삭제) - ADMIN 이 삭제하면 204 + STUDY 행이 사라진다")
    void adminDeletes() {
        Long studyId = createStudy("삭제 대상");

        var response = exchange(HttpMethod.DELETE, "/api/admin/studies/" + studyId, ADMIN_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.findById(studyId)).isEmpty();
    }

    @Test
    @DisplayName("성공(삭제) - 스터디를 지우면 그 스터디의 반 이동 기록도 지운다")
    void deleteRemovesGroupMoveLog() {
        Long studyId = createStudy("삭제 반 이동 기록");
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT_GROUP_MOVE (STUDY_ID, PARTICIPANT_ID, ACCOUNT_ID,"
                        + " FROM_GROUP_ID, FROM_GROUP_NAME, TO_GROUP_ID, TO_GROUP_NAME,"
                        + " MOVED_BY_ACCOUNT_ID, MOVED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, 1, 2, 3, 'A반', 4, 'B반', ?, ?, ?, ?)",
                studyId,
                ADMIN_ID,
                now,
                now,
                now);

        var response = exchange(HttpMethod.DELETE, "/api/admin/studies/" + studyId, ADMIN_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM STUDY_PARTICIPANT_GROUP_MOVE WHERE STUDY_ID = ?",
                                Long.class,
                                studyId))
                .isZero();
    }

    @Test
    @DisplayName("실패(삭제) - ADMIN 이 아닌 계정은 403, 스터디는 남는다")
    void deleteRejectsMember() {
        Long studyId = createStudy("삭제 403");

        var response =
                exchange(HttpMethod.DELETE, "/api/admin/studies/" + studyId, MEMBER_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(studyRepository.findById(studyId)).isPresent();
    }

    @Test
    @DisplayName("실패(삭제) - 없는 스터디는 404 + errorCode NOT_FOUND")
    void deleteNotFound() {
        var response =
                exchange(
                        HttpMethod.DELETE,
                        "/api/admin/studies/" + MISSING_STUDY_ID,
                        ADMIN_ID,
                        null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Long createStudy(String title) {
        return createStudy(createBody(title));
    }

    private Long createStudy(Map<String, Object> body) {
        return createStudy(body, "");
    }

    private Long createStudy(Map<String, Object> body, String query) {
        var response =
                rest.postForEntity(
                        "/api/admin/studies" + query, authenticated(ADMIN_ID, body), Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
    }

    private static Map<String, Object> createBody(String title) {
        return Map.of("title", title, "oneLineSummary", "소개", "category", "DATA");
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> exchange(
            HttpMethod method, String url, Long accountId, Map<String, Object> body) {
        return rest.exchange(url, method, authenticated(accountId, body), Map.class);
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
                "admin_study_" + id,
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
