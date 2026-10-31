package com.studyclub.api.sitenotice;

import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.ADMIN_ID;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.MEMBER_ID;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_IDS;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_MIDDLE;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_NEWEST;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_OLDEST;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.NOTICE_REMOVED;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.cleanSeedRows;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.insertAccount;
import static com.studyclub.api.sitenotice.SiteNoticeTestSupport.insertNotice;
import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.SystemRole;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 사이트(비로그인) 공지 읽기. 픽스처는 ID 순 = 게시 순: 9801(가장 오래됨) · 9802(삭제됨) · 9803(가운데) · 9804(가장 최신). 다른 테스트가 남긴
 * 공지가 섞일 수 있어 목록은 이 ID 들만 골라 본다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class SiteNoticeIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seed() {
        cleanSeedRows(jdbcTemplate);
        insertAccount(jdbcTemplate, ADMIN_ID, SystemRole.ADMIN);
        insertAccount(jdbcTemplate, MEMBER_ID, SystemRole.MEMBER);
        Instant base = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        insertNotice(
                jdbcTemplate,
                NOTICE_OLDEST,
                "첫 공지",
                "본문 1",
                ADMIN_ID,
                base.minus(3, ChronoUnit.DAYS),
                base.minus(3, ChronoUnit.DAYS),
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
                "가운데 공지",
                "줄 하나\n\n줄 둘 https://studyclub.life",
                ADMIN_ID,
                base.minus(1, ChronoUnit.DAYS),
                base.minus(1, ChronoUnit.DAYS),
                null);
        insertNotice(jdbcTemplate, NOTICE_NEWEST, "최신 공지", "본문 4", ADMIN_ID, base, base, null);
    }

    @AfterEach
    void cleanUp() {
        cleanSeedRows(jdbcTemplate);
    }

    @Test
    @DisplayName("목록 — 토큰 없이 200, ID 내림차순, 삭제 건 없음, 작성자 필드 없음")
    void listWithoutToken() {
        ResponseEntity<Map> response = get("/api/notices?limit=100");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> mine = seededItems(response.getBody());
        assertThat(mine)
                .extracting(item -> ((Number) item.get("noticeId")).longValue())
                .containsExactly(NOTICE_NEWEST, NOTICE_MIDDLE, NOTICE_OLDEST);
        assertThat(mine.get(0)).containsKeys("noticeId", "title", "publishedAt");
        assertThat(mine.get(0)).doesNotContainKeys("author", "body", "updatedAt");
        // total 은 살아 있는 수 — 다른 테스트의 공지가 섞여도 삭제 건은 세지 않는다
        long alive =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM SITE_NOTICE WHERE REMOVED_AT IS NULL", Long.class);
        assertThat(((Number) response.getBody().get("total")).longValue()).isEqualTo(alive);
    }

    @Test
    @DisplayName("목록 — offset 이 total 이상이면 빈 items, limit 0·101 은 400")
    void listPaging() {
        ResponseEntity<Map> past = get("/api/notices?offset=100000");
        assertThat(past.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((List<?>) past.getBody().get("items")).isEmpty();
        assertThat(((Number) past.getBody().get("total")).longValue()).isGreaterThanOrEqualTo(3);

        for (String query : List.of("limit=0", "limit=101", "offset=-1")) {
            ResponseEntity<Map> bad = get("/api/notices?" + query);
            assertThat(bad.getStatusCode()).as(query).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(bad.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
    }

    @Test
    @DisplayName("상세 — 가운데 공지의 newer 는 최신, older 는 삭제 건을 건너뛴 첫 공지")
    void detailNeighborsSkipRemoved() {
        ResponseEntity<Map> response = get("/api/notices/" + NOTICE_MIDDLE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("title", "가운데 공지");
        assertThat(body.get("body")).isEqualTo("줄 하나\n\n줄 둘 https://studyclub.life");
        assertThat(body).containsKey("publishedAt");
        assertThat(body).doesNotContainKeys("author", "updatedAt");
        assertThat(((Map<?, ?>) body.get("newer")).get("noticeId")).isEqualTo((int) NOTICE_NEWEST);
        assertThat(((Map<?, ?>) body.get("newer")).get("title")).isEqualTo("최신 공지");
        // 바로 아래 ID(9802)는 삭제됐다 — 그다음인 9801 이 older
        assertThat(((Map<?, ?>) body.get("older")).get("noticeId")).isEqualTo((int) NOTICE_OLDEST);
    }

    @Test
    @DisplayName("상세 — 가장 최신은 newer=null, 가장 오래된 것은 older=null")
    void detailEnds() {
        Map<String, Object> newest = get("/api/notices/" + NOTICE_NEWEST).getBody();
        assertThat(newest).containsEntry("newer", null);
        assertThat(((Map<?, ?>) newest.get("older")).get("noticeId"))
                .isEqualTo((int) NOTICE_MIDDLE);

        Map<String, Object> oldest = get("/api/notices/" + NOTICE_OLDEST).getBody();
        assertThat(oldest).containsEntry("older", null);
        assertThat(((Map<?, ?>) oldest.get("newer")).get("noticeId"))
                .isEqualTo((int) NOTICE_MIDDLE);
    }

    @Test
    @DisplayName("상세 — 공지가 하나뿐이면 newer·older 둘 다 null")
    void detailAlone() {
        jdbcTemplate.update(
                "DELETE FROM SITE_NOTICE WHERE ID IN (?, ?, ?)",
                NOTICE_OLDEST,
                NOTICE_REMOVED,
                NOTICE_NEWEST);

        Map<String, Object> body = get("/api/notices/" + NOTICE_MIDDLE).getBody();
        assertThat(body).containsEntry("newer", null);
        assertThat(body).containsEntry("older", null);
    }

    @Test
    @DisplayName("상세 — 삭제된 ID·없는 ID 는 404, 숫자가 아니면 400")
    void detailErrors() {
        ResponseEntity<Map> removed = get("/api/notices/" + NOTICE_REMOVED);
        assertThat(removed.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(removed.getBody()).containsEntry("errorCode", "NOT_FOUND");

        ResponseEntity<Map> missing = get("/api/notices/987654321");
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        ResponseEntity<Map> text = get("/api/notices/abc");
        assertThat(text.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(text.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> get(String url) {
        return rest.exchange(url, HttpMethod.GET, HttpEntity.EMPTY, Map.class);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> seededItems(Map<?, ?> body) {
        return ((List<Map<String, Object>>) body.get("items"))
                .stream()
                        .filter(
                                item ->
                                        NOTICE_IDS.contains(
                                                ((Number) item.get("noticeId")).longValue()))
                        .toList();
    }
}
