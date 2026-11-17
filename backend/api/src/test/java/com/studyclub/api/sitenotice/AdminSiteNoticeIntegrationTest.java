package com.studyclub.api.sitenotice;

import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.ADMIN_ID;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.MEMBER_ID;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_IDS;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_MIDDLE;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_NEWEST;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_OLDEST;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_REMOVED;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.WITHDRAWN_AUTHOR_ID;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.cleanSeedRows;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.insertAccount;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.insertNotice;
import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.net.URI;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 콘솔 공지 — 목록·한 건·등록·수정·삭제. 픽스처(ID 순 = 게시 순):
 *
 * <ul>
 *   <li>9801 「Alpha 공지」 · 3일 전 · 수정 2일 전 · 작성자 ADMIN
 *   <li>9802 삭제됨 — 어디에도 안 나온다
 *   <li>9803 「beta 안내 100%」 · 1일 전 · 수정 없음 · 작성자 탈퇴(9899, ACCOUNT 행 없음)
 *   <li>9804 「Gamma 공지」 · 지금 · 수정 없음 · 작성자 ADMIN
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminSiteNoticeIntegrationTest {

    private static final String ADMIN_PATH = "/api/admin/notices";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    private Instant base;

    @BeforeEach
    void seed() {
        // 기본 요청 팩토리는 PATCH 를 못 보낸다
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        cleanSeedRows(jdbcTemplate);
        insertAccount(jdbcTemplate, ADMIN_ID, SystemRole.ADMIN);
        insertAccount(jdbcTemplate, MEMBER_ID, SystemRole.MEMBER);
        base = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertNotice(
                jdbcTemplate,
                NOTICE_OLDEST,
                "Alpha 공지",
                "본문 1",
                ADMIN_ID,
                base.minus(3, ChronoUnit.DAYS),
                base.minus(2, ChronoUnit.DAYS),
                null);
        insertNotice(
                jdbcTemplate,
                NOTICE_REMOVED,
                "지운 공지",
                "본문 2",
                ADMIN_ID,
                base.minus(2, ChronoUnit.DAYS),
                base.minus(1, ChronoUnit.DAYS),
                base.minus(1, ChronoUnit.DAYS));
        insertNotice(
                jdbcTemplate,
                NOTICE_MIDDLE,
                "beta 안내 100%",
                "본문 3",
                WITHDRAWN_AUTHOR_ID,
                base.minus(1, ChronoUnit.DAYS),
                base.minus(1, ChronoUnit.DAYS),
                null);
        insertNotice(jdbcTemplate, NOTICE_NEWEST, "Gamma 공지", "본문 4", ADMIN_ID, base, base, null);
    }

    @AfterEach
    void cleanUp() {
        cleanSeedRows(jdbcTemplate);
    }

    // ── 목록 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("목록 — ADMIN 은 200, 기본 정렬 publishedAt desc, 작성자 닉네임, 삭제 건 없음, 본문 없음")
    void listAsAdmin() {
        ResponseEntity<Map> response =
                exchange(HttpMethod.GET, ADMIN_PATH + "?limit=100", ADMIN_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> mine = seededItems(response.getBody());
        assertThat(ids(mine)).containsExactly(NOTICE_NEWEST, NOTICE_MIDDLE, NOTICE_OLDEST);
        assertThat(mine.get(0)).containsEntry("author", "sitenotice_" + ADMIN_ID);
        assertThat(mine.get(0)).containsKeys("publishedAt", "updatedAt");
        assertThat(mine.get(0)).doesNotContainKey("body");

        // sort·order 를 빈 값으로 보내도 기본 정렬 그대로
        ResponseEntity<Map> blank =
                exchange(HttpMethod.GET, ADMIN_PATH + "?sort=&order=&limit=100", ADMIN_ID, null);
        assertThat(blank.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(ids(seededItems(blank.getBody())))
                .containsExactly(NOTICE_NEWEST, NOTICE_MIDDLE, NOTICE_OLDEST);
    }

    @Test
    @DisplayName("목록 — 작성자 계정이 탈퇴했으면 author 는 「탈퇴한 회원」, 공지는 그대로")
    void listWithdrawnAuthor() {
        List<Map<String, Object>> mine =
                seededItems(
                        exchange(HttpMethod.GET, ADMIN_PATH + "?limit=100", ADMIN_ID, null)
                                .getBody());

        Map<String, Object> middle =
                mine.stream().filter(item -> id(item) == NOTICE_MIDDLE).findFirst().orElseThrow();
        assertThat(middle).containsEntry("author", "탈퇴한 회원");
        assertThat(middle).containsEntry("title", "beta 안내 100%");
    }

    @Test
    @DisplayName("목록 — q 는 제목 부분 일치·대소문자 무시, %·_ 는 글자로 취급")
    void listSearch() {
        List<Map<String, Object>> upper =
                seededItems(
                        exchange(HttpMethod.GET, ADMIN_PATH + "?q=ALPHA&limit=100", ADMIN_ID, null)
                                .getBody());
        assertThat(ids(upper)).containsExactly(NOTICE_OLDEST);

        List<Map<String, Object>> percent =
                seededItems(
                        exchange(HttpMethod.GET, ADMIN_PATH + "?q=100%25&limit=100", ADMIN_ID, null)
                                .getBody());
        assertThat(ids(percent)).containsExactly(NOTICE_MIDDLE);

        // % 가 와일드카드였다면 「본문 1」 같은 제목이 아닌 것도 「공지」로 걸렸을 것 — 「공%지」는 아무것도 못 찾아야 한다
        List<Map<String, Object>> wildcard =
                seededItems(
                        exchange(
                                        HttpMethod.GET,
                                        ADMIN_PATH + "?q=%EA%B3%B5%25%EC%A7%80&limit=100",
                                        ADMIN_ID,
                                        null)
                                .getBody());
        assertThat(wildcard).isEmpty();

        // _ 가 한 글자 와일드카드였다면 「alph_」 는 「Alpha 공지」를 찾았을 것 — 제목에 _ 가 없으니 아무것도 못 찾아야 한다
        List<Map<String, Object>> underscore =
                seededItems(
                        exchange(HttpMethod.GET, ADMIN_PATH + "?q=alph_&limit=100", ADMIN_ID, null)
                                .getBody());
        assertThat(underscore).isEmpty();
    }

    @Test
    @DisplayName("목록 — offset 이 total 이상이면 빈 items")
    void listPaging() {
        ResponseEntity<Map> past =
                exchange(HttpMethod.GET, ADMIN_PATH + "?offset=100000", ADMIN_ID, null);
        assertThat(past.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(items(past.getBody())).isEmpty();
        assertThat(((Number) past.getBody().get("total")).longValue()).isGreaterThanOrEqualTo(3);
    }

    @Test
    @DisplayName("목록 — sort=title&order=asc 는 대소문자 무시 제목순, sort=updatedAt 은 수정 시각순, 같은 값은 ID 내림차순")
    void listSort() {
        List<Map<String, Object>> byTitle =
                seededItems(
                        exchange(
                                        HttpMethod.GET,
                                        ADMIN_PATH + "?sort=title&order=asc&limit=100",
                                        ADMIN_ID,
                                        null)
                                .getBody());
        // Alpha < beta < Gamma — 대소문자를 구분했다면 소문자 beta 가 맨 뒤로 간다
        assertThat(ids(byTitle)).containsExactly(NOTICE_OLDEST, NOTICE_MIDDLE, NOTICE_NEWEST);

        List<Map<String, Object>> byUpdated =
                seededItems(
                        exchange(
                                        HttpMethod.GET,
                                        ADMIN_PATH + "?sort=updatedAt&limit=100",
                                        ADMIN_ID,
                                        null)
                                .getBody());
        // 수정 시각: 9804(지금) > 9803(1일 전) > 9801(2일 전)
        assertThat(ids(byUpdated)).containsExactly(NOTICE_NEWEST, NOTICE_MIDDLE, NOTICE_OLDEST);

        // 같은 수정 시각이면 ID 내림차순 — 9801 의 수정 시각을 9803 과 같게 맞춘다
        jdbcTemplate.update(
                "UPDATE SITE_NOTICE SET UPDATED_AT = ? WHERE ID = ?",
                Timestamp.from(base.minus(1, ChronoUnit.DAYS)),
                NOTICE_OLDEST);
        List<Map<String, Object>> tie =
                seededItems(
                        exchange(
                                        HttpMethod.GET,
                                        ADMIN_PATH + "?sort=updatedAt&order=asc&limit=100",
                                        ADMIN_ID,
                                        null)
                                .getBody());
        assertThat(ids(tie)).containsExactly(NOTICE_MIDDLE, NOTICE_OLDEST, NOTICE_NEWEST);
    }

    @Test
    @DisplayName("목록 — MEMBER 403 · 토큰 없음 401 · sort=foo 400 · q 101자 400")
    void listErrors() {
        ResponseEntity<Map> member = exchange(HttpMethod.GET, ADMIN_PATH, MEMBER_ID, null);
        assertThat(member.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(member.getBody()).containsEntry("errorCode", "FORBIDDEN");

        ResponseEntity<Map> anonymous =
                rest.exchange(ADMIN_PATH, HttpMethod.GET, HttpEntity.EMPTY, Map.class);
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(anonymous.getBody()).containsEntry("errorCode", "UNAUTHORIZED");

        for (String query :
                List.of(
                        "sort=foo",
                        "order=up",
                        "q=" + "a".repeat(101),
                        "limit=0",
                        "limit=101",
                        "offset=-1")) {
            ResponseEntity<Map> bad =
                    exchange(HttpMethod.GET, ADMIN_PATH + "?" + query, ADMIN_ID, null);
            assertThat(bad.getStatusCode()).as(query).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(bad.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
    }

    // ── 한 건 ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("한 건 — ADMIN 은 본문 포함 200, 탈퇴 작성자는 「탈퇴한 회원」, 삭제된 ID 는 404")
    void detail() {
        ResponseEntity<Map> response =
                exchange(HttpMethod.GET, ADMIN_PATH + "/" + NOTICE_OLDEST, ADMIN_ID, null);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("title", "Alpha 공지");
        assertThat(response.getBody()).containsEntry("body", "본문 1");
        assertThat(response.getBody()).containsEntry("author", "sitenotice_" + ADMIN_ID);
        assertThat(response.getBody()).containsKeys("publishedAt", "updatedAt");

        ResponseEntity<Map> withdrawn =
                exchange(HttpMethod.GET, ADMIN_PATH + "/" + NOTICE_MIDDLE, ADMIN_ID, null);
        assertThat(withdrawn.getBody()).containsEntry("author", "탈퇴한 회원");

        ResponseEntity<Map> removed =
                exchange(HttpMethod.GET, ADMIN_PATH + "/" + NOTICE_REMOVED, ADMIN_ID, null);
        assertThat(removed.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(removed.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    // ── 등록 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("등록 — 201 + Location, 작성자 = 요청자, 바로 사이트 목록 맨 위")
    void create() {
        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.POST,
                        ADMIN_PATH,
                        ADMIN_ID,
                        Map.of("title", "새 공지", "body", "본문"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getFirst(HttpHeaders.LOCATION))
                .startsWith(ADMIN_PATH + "/");
        long noticeId = idFromLocation(response);

        Map<String, Object> row =
                jdbcTemplate.queryForMap(
                        "SELECT AUTHOR_ACCOUNT_ID, REMOVED_AT FROM SITE_NOTICE WHERE ID = ?",
                        noticeId);
        assertThat(((Number) row.get("AUTHOR_ACCOUNT_ID")).longValue()).isEqualTo(ADMIN_ID);
        assertThat(row.get("REMOVED_AT")).isNull();

        ResponseEntity<Map> site =
                rest.exchange("/api/notices", HttpMethod.GET, HttpEntity.EMPTY, Map.class);
        List<Map<String, Object>> items = items(site.getBody());
        assertThat(id(items.get(0))).isEqualTo(noticeId);
        assertThat(items.get(0)).containsEntry("title", "새 공지");
    }

    @Test
    @DisplayName("등록 — 제목 공백만·201자, 본문 줄바꿈만·20,001자는 400")
    void createInvalid() {
        List<Map<String, Object>> bodies =
                List.of(
                        Map.of("title", "   ", "body", "본문"),
                        Map.of("title", "a".repeat(201), "body", "본문"),
                        Map.of("title", "제목", "body", "\n\n  \n"),
                        Map.of("title", "제목", "body", "b".repeat(20_001)));
        for (Map<String, Object> body : bodies) {
            ResponseEntity<Map> response = exchange(HttpMethod.POST, ADMIN_PATH, ADMIN_ID, body);
            assertThat(response.getStatusCode())
                    .as(body.toString())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
    }

    @Test
    @DisplayName("등록 — 제목은 앞뒤 공백을 잘라 저장, 본문은 태그·앞뒤 줄바꿈 그대로, \\r\\n 은 \\n 으로")
    void createNormalizes() {
        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.POST,
                        ADMIN_PATH,
                        ADMIN_ID,
                        Map.of("title", "  공백 공지  ", "body", "\n<b>태그</b>\r\n둘째 줄\n"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        long noticeId = idFromLocation(response);

        Map<String, Object> row =
                jdbcTemplate.queryForMap(
                        "SELECT TITLE, BODY FROM SITE_NOTICE WHERE ID = ?", noticeId);
        assertThat(row.get("TITLE")).isEqualTo("공백 공지");
        assertThat(row.get("BODY")).isEqualTo("\n<b>태그</b>\n둘째 줄\n");
    }

    @Test
    @DisplayName("등록 — MEMBER 는 403, 행이 생기지 않는다")
    void createAsMember() {
        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.POST,
                        ADMIN_PATH,
                        MEMBER_ID,
                        Map.of("title", "크루 공지", "body", "본문"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        Long count =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM SITE_NOTICE WHERE AUTHOR_ACCOUNT_ID = ?",
                        Long.class,
                        MEMBER_ID);
        assertThat(count).isZero();
    }

    // ── 수정 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("수정 — 204, 값 반영, UPDATED_AT 갱신, 작성자 불변")
    void update() {
        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.PATCH,
                        ADMIN_PATH + "/" + NOTICE_OLDEST,
                        ADMIN_ID,
                        Map.of("title", "고친 제목", "body", "고친 본문"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        Map<String, Object> row =
                jdbcTemplate.queryForMap(
                        "SELECT TITLE, BODY, AUTHOR_ACCOUNT_ID FROM SITE_NOTICE WHERE ID = ?",
                        NOTICE_OLDEST);
        assertThat(row.get("TITLE")).isEqualTo("고친 제목");
        assertThat(row.get("BODY")).isEqualTo("고친 본문");
        assertThat(((Number) row.get("AUTHOR_ACCOUNT_ID")).longValue()).isEqualTo(ADMIN_ID);
        Instant updatedAt =
                jdbcTemplate
                        .queryForObject(
                                "SELECT UPDATED_AT FROM SITE_NOTICE WHERE ID = ?",
                                Timestamp.class,
                                NOTICE_OLDEST)
                        .toInstant();
        assertThat(updatedAt).isAfter(base.minus(2, ChronoUnit.DAYS));
        // 게시 시각은 그대로다
        Instant createdAt =
                jdbcTemplate
                        .queryForObject(
                                "SELECT CREATED_AT FROM SITE_NOTICE WHERE ID = ?",
                                Timestamp.class,
                                NOTICE_OLDEST)
                        .toInstant();
        assertThat(createdAt).isEqualTo(base.minus(3, ChronoUnit.DAYS));
    }

    @Test
    @DisplayName("수정 — 같은 값이면 204, UPDATED_AT 그대로")
    void updateSameValues() {
        Instant before =
                jdbcTemplate
                        .queryForObject(
                                "SELECT UPDATED_AT FROM SITE_NOTICE WHERE ID = ?",
                                Timestamp.class,
                                NOTICE_OLDEST)
                        .toInstant();

        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.PATCH,
                        ADMIN_PATH + "/" + NOTICE_OLDEST,
                        ADMIN_ID,
                        Map.of("title", "Alpha 공지", "body", "본문 1"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        Instant after =
                jdbcTemplate
                        .queryForObject(
                                "SELECT UPDATED_AT FROM SITE_NOTICE WHERE ID = ?",
                                Timestamp.class,
                                NOTICE_OLDEST)
                        .toInstant();
        assertThat(after).isEqualTo(before);
    }

    @Test
    @DisplayName("수정 — 삭제된 ID 404, 빈 제목 400")
    void updateErrors() {
        ResponseEntity<Map> removed =
                exchange(
                        HttpMethod.PATCH,
                        ADMIN_PATH + "/" + NOTICE_REMOVED,
                        ADMIN_ID,
                        Map.of("title", "x", "body", "y"));
        assertThat(removed.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        ResponseEntity<Map> blank =
                exchange(
                        HttpMethod.PATCH,
                        ADMIN_PATH + "/" + NOTICE_OLDEST,
                        ADMIN_ID,
                        Map.of("title", "  ", "body", "y"));
        assertThat(blank.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(blank.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("수정 — MEMBER 403 · 토큰 없음 401 이면 값 그대로, MEMBER 가 없는 ID 로 불러도 404 가 아니라 403")
    void updateForbidden() {
        Map<String, Object> body = Map.of("title", "바꿈", "body", "바꿈");
        ResponseEntity<Map> member =
                exchange(HttpMethod.PATCH, ADMIN_PATH + "/" + NOTICE_OLDEST, MEMBER_ID, body);
        assertThat(member.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> anonymous =
                rest.exchange(
                        ADMIN_PATH + "/" + NOTICE_OLDEST,
                        HttpMethod.PATCH,
                        new HttpEntity<>(body, headers),
                        Map.class);
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT TITLE FROM SITE_NOTICE WHERE ID = ?",
                                String.class,
                                NOTICE_OLDEST))
                .isEqualTo("Alpha 공지");

        ResponseEntity<Map> missing =
                exchange(HttpMethod.PATCH, ADMIN_PATH + "/987654321", MEMBER_ID, body);
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ── 삭제 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("삭제 — 204, REMOVED_AT 기록, 사이트 상세 404, 목록에서 빠짐, 두 번째는 404")
    void delete() {
        ResponseEntity<Map> response =
                exchange(HttpMethod.DELETE, ADMIN_PATH + "/" + NOTICE_MIDDLE, ADMIN_ID, null);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT REMOVED_AT FROM SITE_NOTICE WHERE ID = ?",
                                Timestamp.class,
                                NOTICE_MIDDLE))
                .isNotNull();
        assertThat(
                        rest.exchange(
                                        "/api/notices/" + NOTICE_MIDDLE,
                                        HttpMethod.GET,
                                        HttpEntity.EMPTY,
                                        Map.class)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        List<Map<String, Object>> site =
                items(
                        rest.exchange(
                                        "/api/notices?limit=100",
                                        HttpMethod.GET,
                                        HttpEntity.EMPTY,
                                        Map.class)
                                .getBody());
        assertThat(ids(site)).doesNotContain(NOTICE_MIDDLE);
        List<Map<String, Object>> console =
                seededItems(
                        exchange(HttpMethod.GET, ADMIN_PATH + "?limit=100", ADMIN_ID, null)
                                .getBody());
        assertThat(ids(console)).containsExactly(NOTICE_NEWEST, NOTICE_OLDEST);

        ResponseEntity<Map> again =
                exchange(HttpMethod.DELETE, ADMIN_PATH + "/" + NOTICE_MIDDLE, ADMIN_ID, null);
        assertThat(again.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(again.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("삭제 — MEMBER 403 · 토큰 없음 401, REMOVED_AT 은 그대로 NULL")
    void deleteForbidden() {
        ResponseEntity<Map> member =
                exchange(HttpMethod.DELETE, ADMIN_PATH + "/" + NOTICE_OLDEST, MEMBER_ID, null);
        assertThat(member.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        ResponseEntity<Map> anonymous =
                rest.exchange(
                        ADMIN_PATH + "/" + NOTICE_OLDEST,
                        HttpMethod.DELETE,
                        HttpEntity.EMPTY,
                        Map.class);
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT REMOVED_AT FROM SITE_NOTICE WHERE ID = ?",
                                Timestamp.class,
                                NOTICE_OLDEST))
                .isNull();
    }

    // ── 도우미 ────────────────────────────────────────────────────────────────

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> exchange(
            HttpMethod method, String url, long accountId, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        // 문자열 URL 은 URI 템플릿으로 다시 인코딩돼 %25 가 %2525 로 바뀐다 — URI 로 넘겨 그대로 보낸다
        return rest.exchange(URI.create(url), method, new HttpEntity<>(body, headers), Map.class);
    }

    private static long idFromLocation(ResponseEntity<?> response) {
        String location = response.getHeaders().getFirst(HttpHeaders.LOCATION);
        return Long.parseLong(location.substring(location.lastIndexOf('/') + 1));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<?, ?> body) {
        return (List<Map<String, Object>>) body.get("items");
    }

    private static List<Map<String, Object>> seededItems(Map<?, ?> body) {
        return items(body).stream().filter(item -> NOTICE_IDS.contains(id(item))).toList();
    }

    private static long id(Map<String, Object> item) {
        return ((Number) item.get("noticeId")).longValue();
    }

    private static List<Long> ids(List<Map<String, Object>> items) {
        return items.stream().map(AdminSiteNoticeIntegrationTest::id).toList();
    }
}
