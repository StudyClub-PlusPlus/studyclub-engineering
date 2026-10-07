package com.studyclub.api.account;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 같은 DB 를 다른 테스트 클래스와 같이 쓴다 — 목록은 닉네임 접두사({@value #PREFIX})로 좁혀서 본다. 그러면 전체 수·순서가 이 픽스처만으로 정해진다.
 *
 * <p>픽스처 (정렬 순서대로, 가입일은 {@code base} 기준 며칠 전):
 *
 * <ul>
 *   <li>9907 ADMIN · 20일 전 · 담당 캡틴처럼 MEMBER 역할 ACTIVE 행 1개(스터디 9952) → 참여 1, 담당 아님
 *   <li>9901 ADMIN · 10일 전 · 요청자 · 참여 0
 *   <li>9903 MEMBER · 4일 전 · 담당 2곳(9951 LEADER, 9953 LEADER) → 담당, 참여 2
 *   <li>9909 MEMBER · 6일 전 · 9952 CO_LEADER PAUSED → 담당, 참여 1
 *   <li>9908 MEMBER · 0일 전 · 9951·9952·9953 MEMBER ACTIVE → 참여 3, 담당 아님
 *   <li>9904 MEMBER · 2일 전 · 9951 MEMBER ACTIVE → 참여 1
 *   <li>9902 MEMBER · 1일 전 · 참여 0 (403 요청자)
 *   <li>9905 MEMBER · 3일 전 · 하차한 LEADER 행 + 완주한 MEMBER 행뿐 → 참여 0
 *   <li>9906 MEMBER · 온보딩 전 — 닉네임이 접두사와 같아도 이름으로 찾히지 않는다
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminAccountListIntegrationTest {

    private static final String PREFIX = "acctlist_";
    private static final long ADMIN_ID = 9901L;
    private static final long MEMBER_ID = 9902L;
    private static final long NAVIGATOR_ID = 9903L;
    private static final long CREW_ID = 9904L;
    private static final long DORMANT_ID = 9905L;
    private static final long NOT_ONBOARDED_ID = 9906L;
    private static final long CAPTAIN_PARTICIPANT_ID = 9907L;
    private static final long BUSY_CREW_ID = 9908L;
    private static final long CO_NAVIGATOR_ID = 9909L;
    private static final List<Long> ACCOUNT_IDS =
            List.of(
                    ADMIN_ID,
                    MEMBER_ID,
                    NAVIGATOR_ID,
                    CREW_ID,
                    DORMANT_ID,
                    NOT_ONBOARDED_ID,
                    CAPTAIN_PARTICIPANT_ID,
                    BUSY_CREW_ID,
                    CO_NAVIGATOR_ID);

    private static final long STUDY_A = 9951L;
    private static final long STUDY_B = 9952L;
    private static final long STUDY_C = 9953L;
    private static final List<Long> STUDY_IDS = List.of(STUDY_A, STUDY_B, STUDY_C);

    /** 접두사로 거른 이 픽스처의 정렬된 ID — 온보딩 전 계정(9906)은 이름으로 안 찾힌다. */
    private static final List<Long> SORTED_IDS =
            List.of(
                    CAPTAIN_PARTICIPANT_ID,
                    ADMIN_ID,
                    NAVIGATOR_ID,
                    CO_NAVIGATOR_ID,
                    BUSY_CREW_ID,
                    CREW_ID,
                    MEMBER_ID,
                    DORMANT_ID);

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seed() {
        cleanSeedRows();
        Instant base = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertAccount(ADMIN_ID, SystemRole.ADMIN, true, base.minus(10, ChronoUnit.DAYS));
        insertAccount(MEMBER_ID, SystemRole.MEMBER, true, base.minus(1, ChronoUnit.DAYS));
        insertAccount(NAVIGATOR_ID, SystemRole.MEMBER, true, base.minus(4, ChronoUnit.DAYS));
        insertAccount(CREW_ID, SystemRole.MEMBER, true, base.minus(2, ChronoUnit.DAYS));
        insertAccount(DORMANT_ID, SystemRole.MEMBER, true, base.minus(3, ChronoUnit.DAYS));
        insertAccount(NOT_ONBOARDED_ID, SystemRole.MEMBER, false, base.minus(5, ChronoUnit.DAYS));
        insertAccount(
                CAPTAIN_PARTICIPANT_ID, SystemRole.ADMIN, true, base.minus(20, ChronoUnit.DAYS));
        insertAccount(BUSY_CREW_ID, SystemRole.MEMBER, true, base);
        insertAccount(CO_NAVIGATOR_ID, SystemRole.MEMBER, true, base.minus(6, ChronoUnit.DAYS));

        insertStudy(STUDY_A, "알고리즘 스터디", base);
        insertStudy(STUDY_B, "AI 논문 리딩", base);
        insertStudy(STUDY_C, "클린 코드", base);

        // 담당 캡틴은 반 편성 때 MEMBER 로 명부에 들어간다 — 담당 스터디는 아니지만 참여는 센다
        insertParticipant(
                CAPTAIN_PARTICIPANT_ID,
                STUDY_B,
                ParticipantRole.MEMBER,
                ParticipantStatus.ACTIVE,
                base.minus(30, ChronoUnit.DAYS));
        // 담당 2곳 — 편입이 최신인 스터디가 먼저 나온다
        insertParticipant(
                NAVIGATOR_ID,
                STUDY_A,
                ParticipantRole.LEADER,
                ParticipantStatus.ACTIVE,
                base.minus(5, ChronoUnit.DAYS));
        insertParticipant(
                NAVIGATOR_ID,
                STUDY_C,
                ParticipantRole.LEADER,
                ParticipantStatus.ACTIVE,
                base.minus(2, ChronoUnit.DAYS));
        insertParticipant(
                CO_NAVIGATOR_ID,
                STUDY_B,
                ParticipantRole.CO_LEADER,
                ParticipantStatus.PAUSED,
                base.minus(5, ChronoUnit.DAYS));
        for (long studyId : STUDY_IDS) {
            insertParticipant(
                    BUSY_CREW_ID,
                    studyId,
                    ParticipantRole.MEMBER,
                    ParticipantStatus.ACTIVE,
                    base.minus(5, ChronoUnit.DAYS));
        }
        insertParticipant(
                CREW_ID,
                STUDY_A,
                ParticipantRole.MEMBER,
                ParticipantStatus.ACTIVE,
                base.minus(5, ChronoUnit.DAYS));
        // 하차·완주는 지난 일 — 담당에도 참여에도 안 센다
        insertParticipant(
                DORMANT_ID,
                STUDY_A,
                ParticipantRole.LEADER,
                ParticipantStatus.WITHDRAWN,
                base.minus(9, ChronoUnit.DAYS));
        insertParticipant(
                DORMANT_ID,
                STUDY_B,
                ParticipantRole.MEMBER,
                ParticipantStatus.COMPLETED,
                base.minus(9, ChronoUnit.DAYS));
    }

    @AfterEach
    void cleanUp() {
        cleanSeedRows();
    }

    @Test
    @DisplayName("성공 - 정렬: 캡틴 먼저 → 담당 스터디 있는 사람 → 참여 중인 스터디 수 → 가입일 최신순")
    void sortsByRoleThenNavigatorThenParticipationThenJoinedAt() {
        var response = get("/api/admin/users?q=" + PREFIX, ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(ids(response.getBody())).containsExactlyElementsOf(SORTED_IDS);
        assertThat(total(response.getBody())).isEqualTo(SORTED_IDS.size());
    }

    @Test
    @DisplayName("성공 - 응답 항목에 이름·가린 이메일·권한·담당 스터디·휴면·가입일이 담긴다")
    void itemFieldsAreAssembled() {
        var response = get("/api/admin/users?q=" + PREFIX, ADMIN_ID);

        Map<String, Object> navigator = itemById(response.getBody(), NAVIGATOR_ID);
        assertThat(navigator)
                .containsEntry("name", PREFIX + NAVIGATOR_ID)
                .containsEntry("maskedEmail", "a***@example.com")
                .containsEntry("systemRole", "MEMBER")
                .containsEntry("dormant", false)
                .containsKey("joinedAt")
                .containsEntry("roleChangeBlockedReason", null)
                .doesNotContainKey("email");
        // 편입이 최신인 스터디가 먼저
        assertThat(navigatorOf(navigator))
                .containsExactly(
                        Map.of("studyId", (int) STUDY_C, "title", "클린 코드"),
                        Map.of("studyId", (int) STUDY_A, "title", "알고리즘 스터디"));
    }

    @Test
    @DisplayName("성공 - 응답 본문 어디에도 이메일 원본이 없다")
    void bodyNeverContainsRawEmail() {
        var response =
                rest.exchange(
                        "/api/admin/users?q=" + PREFIX,
                        HttpMethod.GET,
                        authenticatedRequest(ADMIN_ID),
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("acctlist-");
    }

    @Test
    @DisplayName("성공 - 하차·완주한 스터디는 담당에도 참여에도 안 센다 (휴면)")
    void withdrawnAndCompletedRowsAreNotCounted() {
        var response = get("/api/admin/users?q=" + PREFIX, ADMIN_ID);

        Map<String, Object> dormant = itemById(response.getBody(), DORMANT_ID);
        assertThat(navigatorOf(dormant)).isEmpty();
        assertThat(dormant).containsEntry("dormant", true);
    }

    @Test
    @DisplayName("성공 - 담당 캡틴처럼 MEMBER 역할 ACTIVE 행만 있어도 참여로 센다 — 휴면이 아니고 담당도 아니다")
    void memberRoleRowCountsAsParticipation() {
        var response = get("/api/admin/users?q=" + PREFIX, ADMIN_ID);

        Map<String, Object> captain = itemById(response.getBody(), CAPTAIN_PARTICIPANT_ID);
        assertThat(captain).containsEntry("dormant", false).containsEntry("systemRole", "ADMIN");
        assertThat(navigatorOf(captain)).isEmpty();
        // 참여가 있어서 같은 캡틴 안에서는 참여 0 인 요청자보다 앞선다 (가입일은 더 오래됐다)
        assertThat(ids(response.getBody()).subList(0, 2))
                .containsExactly(CAPTAIN_PARTICIPANT_ID, ADMIN_ID);
    }

    @Test
    @DisplayName("성공 - PAUSED 인 CO_LEADER 도 담당으로 센다")
    void pausedCoLeaderCountsAsNavigator() {
        var response = get("/api/admin/users?role=NAVIGATOR&q=" + PREFIX, ADMIN_ID);

        assertThat(ids(response.getBody())).containsExactly(NAVIGATOR_ID, CO_NAVIGATOR_ID);
        assertThat(navigatorOf(itemById(response.getBody(), CO_NAVIGATOR_ID)))
                .containsExactly(Map.of("studyId", (int) STUDY_B, "title", "AI 논문 리딩"));
    }

    @Test
    @DisplayName("성공 - role=CAPTAIN 은 캡틴 계정만 준다")
    void filterByCaptain() {
        var response = get("/api/admin/users?role=CAPTAIN&q=" + PREFIX, ADMIN_ID);

        assertThat(ids(response.getBody())).containsExactly(CAPTAIN_PARTICIPANT_ID, ADMIN_ID);
        assertThat(total(response.getBody())).isEqualTo(2);
    }

    @Test
    @DisplayName("성공 - role=CREW 는 크루 계정을 주고, 계정이 MEMBER 인 네비게이터도 함께 나온다 (탭이 배타적이지 않다)")
    void crewIncludesNavigatorWhoseAccountIsMember() {
        var response = get("/api/admin/users?role=CREW&q=" + PREFIX, ADMIN_ID);

        assertThat(ids(response.getBody()))
                .containsExactly(
                        NAVIGATOR_ID,
                        CO_NAVIGATOR_ID,
                        BUSY_CREW_ID,
                        CREW_ID,
                        MEMBER_ID,
                        DORMANT_ID);
        assertThat(itemById(response.getBody(), NAVIGATOR_ID))
                .containsEntry("systemRole", "MEMBER");
        assertThat(navigatorOf(itemById(response.getBody(), NAVIGATOR_ID))).isNotEmpty();
    }

    @Test
    @DisplayName("성공 - role 을 생략하거나 ALL 이면 조건 없음")
    void roleDefaultsToAll() {
        var omitted = get("/api/admin/users?q=" + PREFIX, ADMIN_ID);
        var all = get("/api/admin/users?role=ALL&q=" + PREFIX, ADMIN_ID);

        assertThat(ids(omitted.getBody())).containsExactlyElementsOf(SORTED_IDS);
        assertThat(ids(all.getBody())).containsExactlyElementsOf(SORTED_IDS);
    }

    @Test
    @DisplayName("성공 - role 과 q 는 AND 로 걸린다")
    void roleAndSearchAreAnded() {
        var navigatorByName = get("/api/admin/users?role=NAVIGATOR&q=acctlist_9909", ADMIN_ID);
        var captainByNavigatorName = get("/api/admin/users?role=CAPTAIN&q=acctlist_9903", ADMIN_ID);

        assertThat(ids(navigatorByName.getBody())).containsExactly(CO_NAVIGATOR_ID);
        assertThat(items(captainByNavigatorName.getBody())).isEmpty();
        assertThat(total(captainByNavigatorName.getBody())).isZero();
    }

    @Test
    @DisplayName("성공 - q 는 이름 부분 일치이고 대소문자를 가리지 않는다")
    void searchByNamePartialIgnoringCase() {
        var response = get("/api/admin/users?q=ACCTLIST_9903", ADMIN_ID);
        var partial = get("/api/admin/users?q=ctList_990", ADMIN_ID);

        assertThat(ids(response.getBody())).containsExactly(NAVIGATOR_ID);
        assertThat(ids(partial.getBody())).containsExactlyInAnyOrderElementsOf(SORTED_IDS);
    }

    @Test
    @DisplayName("성공 - q 앞뒤 공백은 자르고, 공백뿐이면 조건 없음")
    void searchTrimsAndTreatsBlankAsNoCondition() {
        // 템플릿 변수로 넘겨야 공백이 한 번만 인코딩된다
        var trimmed = get("/api/admin/users?q={q}", ADMIN_ID, "  acctlist_9903 ");
        var blank = get("/api/admin/users?q={q}", ADMIN_ID, "   ");

        assertThat(ids(trimmed.getBody())).containsExactly(NAVIGATOR_ID);
        assertThat(blank.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(total(blank.getBody())).isGreaterThanOrEqualTo(SORTED_IDS.size());
    }

    @Test
    @DisplayName("성공 - q 의 % 와 _ 는 와일드카드가 아니라 글자로 찾는다")
    void likeWildcardsAreLiteral() {
        var percent = get("/api/admin/users?q=acctlist_99%25", ADMIN_ID);
        var underscore = get("/api/admin/users?q=acctlist__903", ADMIN_ID);

        assertThat(total(percent.getBody())).isZero();
        assertThat(total(underscore.getBody())).isZero();
    }

    @Test
    @DisplayName("성공 - q 가 이메일 전체와 같으면 찾고(대소문자 무시), 일부만 같으면 못 찾는다")
    void searchByEmailIsExactOnly() {
        var exact = get("/api/admin/users?q=ACCTLIST-9903@example.com", ADMIN_ID);
        var localPart = get("/api/admin/users?q=acctlist-9903", ADMIN_ID);
        var domainOnly = get("/api/admin/users?q=example.com", ADMIN_ID);
        var withoutDomain = get("/api/admin/users?q=acctlist-9903@example", ADMIN_ID);

        assertThat(ids(exact.getBody())).containsExactly(NAVIGATOR_ID);
        assertThat(total(localPart.getBody())).isZero();
        assertThat(total(domainOnly.getBody())).isZero();
        assertThat(total(withoutDomain.getBody())).isZero();
    }

    @Test
    @DisplayName("성공 - 온보딩 전 계정은 name 이 null 이고, 임시 닉네임으로는 안 찾히지만 이메일 전체로는 찾힌다")
    void notOnboardedAccount() {
        var byNickname = get("/api/admin/users?q=acctlist_9906", ADMIN_ID);
        var byEmail = get("/api/admin/users?q=acctlist-9906@example.com", ADMIN_ID);

        assertThat(total(byNickname.getBody())).isZero();
        assertThat(ids(byEmail.getBody())).containsExactly(NOT_ONBOARDED_ID);
        assertThat(items(byEmail.getBody()).get(0))
                .containsEntry("name", null)
                .containsEntry("maskedEmail", "a***@example.com");
    }

    @Test
    @DisplayName("성공 - 본인 행은 roleChangeBlockedReason 이 CANNOT_CHANGE_OWN_ROLE 이고 나머지는 null")
    void selfRowIsBlocked() {
        var response = get("/api/admin/users?q=" + PREFIX, ADMIN_ID);

        assertThat(itemById(response.getBody(), ADMIN_ID))
                .containsEntry("roleChangeBlockedReason", "CANNOT_CHANGE_OWN_ROLE");
        assertThat(items(response.getBody()))
                .filteredOn(item -> id(item) != ADMIN_ID)
                .allSatisfy(
                        item -> assertThat(item).containsEntry("roleChangeBlockedReason", null));
    }

    @Test
    @DisplayName("성공 - 페이지: total 은 걸러진 뒤 전체 수이고 offset·limit 은 요청 값 그대로")
    void pagination() {
        var first = get("/api/admin/users?q=" + PREFIX + "&offset=0&limit=3", ADMIN_ID);
        var second = get("/api/admin/users?q=" + PREFIX + "&offset=3&limit=3", ADMIN_ID);

        assertThat(ids(first.getBody())).containsExactlyElementsOf(SORTED_IDS.subList(0, 3));
        assertThat(ids(second.getBody())).containsExactlyElementsOf(SORTED_IDS.subList(3, 6));
        assertThat(total(first.getBody())).isEqualTo(SORTED_IDS.size());
        assertThat(first.getBody()).containsEntry("offset", 0).containsEntry("limit", 3);
        assertThat(second.getBody()).containsEntry("offset", 3).containsEntry("limit", 3);
    }

    @Test
    @DisplayName("성공 - offset 이 total 이상이면 빈 목록과 실제 total 을 준다 (에러 아님)")
    void offsetPastTotalReturnsEmptyPage() {
        var response = get("/api/admin/users?q=" + PREFIX + "&offset=1000", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(items(response.getBody())).isEmpty();
        assertThat(total(response.getBody())).isEqualTo(SORTED_IDS.size());
    }

    @Test
    @DisplayName("성공 - 조건에 맞는 사람이 없으면 빈 목록과 total 0")
    void noMatchReturnsEmpty() {
        var response = get("/api/admin/users?q=zzz-no-such-person", ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(items(response.getBody())).isEmpty();
        assertThat(total(response.getBody())).isZero();
    }

    @Test
    @DisplayName("실패 - 잘못된 입력은 400 + errorCode INVALID_INPUT")
    void rejectsInvalidInput() {
        for (String query :
                List.of(
                        "limit=0",
                        "limit=101",
                        "offset=-1",
                        "role=LEADER",
                        "role=captain",
                        "role=ADMIN",
                        "q=" + "a".repeat(101))) {
            var response = get("/api/admin/users?" + query, ADMIN_ID);

            assertThat(response.getStatusCode()).as(query).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).as(query).containsEntry("errorCode", "INVALID_INPUT");
        }
    }

    @Test
    @DisplayName("실패 - 토큰 없이 조회하면 401 + errorCode UNAUTHORIZED")
    void rejectsUnauthenticatedRequest() {
        var response =
                rest.exchange("/api/admin/users", HttpMethod.GET, HttpEntity.EMPTY, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403 + errorCode FORBIDDEN")
    void rejectsNonAdmin() {
        var response = get("/api/admin/users", MEMBER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private ResponseEntity<Map> get(String path, long requesterId, Object... uriVariables) {
        return rest.exchange(
                path, HttpMethod.GET, authenticatedRequest(requesterId), Map.class, uriVariables);
    }

    private HttpEntity<Void> authenticatedRequest(long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(headers);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<?, ?> body) {
        return (List<Map<String, Object>>) body.get("items");
    }

    private static long id(Map<String, Object> item) {
        return ((Number) item.get("id")).longValue();
    }

    private static List<Long> ids(Map<?, ?> body) {
        return items(body).stream().map(AdminAccountListIntegrationTest::id).toList();
    }

    private static long total(Map<?, ?> body) {
        return ((Number) body.get("total")).longValue();
    }

    private static Map<String, Object> itemById(Map<?, ?> body, long accountId) {
        return items(body).stream().filter(i -> id(i) == accountId).findFirst().orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> navigatorOf(Map<String, Object> item) {
        return (List<Map<String, Object>>) item.get("navigatorOf");
    }

    private void cleanSeedRows() {
        String accountIn = inClause(ACCOUNT_IDS.size());
        jdbcTemplate.update(
                "DELETE FROM STUDY_PARTICIPANT WHERE ACCOUNT_ID IN (" + accountIn + ")",
                ACCOUNT_IDS.toArray());
        String studyIn = inClause(STUDY_IDS.size());
        jdbcTemplate.update("DELETE FROM STUDY WHERE ID IN (" + studyIn + ")", STUDY_IDS.toArray());
        jdbcTemplate.update(
                "DELETE FROM STUDY_PROGRAM WHERE ID IN (" + studyIn + ")", STUDY_IDS.toArray());
        jdbcTemplate.update(
                "DELETE FROM ACCOUNT WHERE ID IN (" + accountIn + ")", ACCOUNT_IDS.toArray());
    }

    private static String inClause(int size) {
        return String.join(",", Collections.nCopies(size, "?"));
    }

    private void insertAccount(long id, SystemRole role, boolean onboarded, Instant createdAt) {
        Timestamp created = Timestamp.from(createdAt);
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "acctlist-" + id + "@example.com",
                PREFIX + id,
                role.name(),
                "Asia/Seoul",
                onboarded ? created : null,
                created,
                created);
    }

    private void insertStudy(long id, String title, Instant now) {
        Timestamp ts = Timestamp.from(now);
        jdbcTemplate.update(
                "INSERT INTO STUDY_PROGRAM (ID, TITLE, STUDY_KIND, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?)",
                id,
                title,
                "STUDY",
                ts,
                ts);
        jdbcTemplate.update(
                "INSERT INTO STUDY (ID, PROGRAM_ID, TITLE, ONE_LINE_SUMMARY, CATEGORY,"
                        + " STATUS, APPLICATION_FORM, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)",
                id,
                id,
                title,
                "한 줄 소개",
                "ALGORITHM",
                "OPEN",
                "{\"questions\":[]}",
                ts,
                ts);
    }

    /** 반 ID 는 스터디 ID 와 같게 둔다 — (계정, 반) 이 유일해야 해서 계정이 여러 스터디에 들어가려면 반이 달라야 한다. */
    private void insertParticipant(
            long accountId,
            long studyId,
            ParticipantRole role,
            ParticipantStatus status,
            Instant joinedAt) {
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO STUDY_PARTICIPANT (ACCOUNT_ID, STUDY_GROUP_ID, STUDY_ID, STATUS,"
                        + " PARTICIPANT_ROLE, JOINED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                accountId,
                studyId,
                studyId,
                status.name(),
                role.name(),
                Timestamp.from(joinedAt),
                now,
                now);
    }
}
