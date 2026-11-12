package com.studyclub.api.sitenotice;

import com.studyclub.domain.account.SystemRole;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

/** 두 통합 테스트가 같은 DB 를 다른 테스트 클래스와 나눠 쓴다 — 계정·공지 ID 를 9800 번대에 고정하고, 사이트 목록은 공지 ID 로 좁혀서 본다. */
final class SiteNoticeTestSupport {

    static final long ADMIN_ID = 9801L;
    static final long MEMBER_ID = 9802L;

    /** ACCOUNT 행을 만들지 않는다 — 탈퇴한 작성자. */
    static final long WITHDRAWN_AUTHOR_ID = 9899L;

    static final long NOTICE_OLDEST = 9801L;
    static final long NOTICE_REMOVED = 9802L;
    static final long NOTICE_MIDDLE = 9803L;
    static final long NOTICE_NEWEST = 9804L;
    static final List<Long> NOTICE_IDS =
            List.of(NOTICE_OLDEST, NOTICE_REMOVED, NOTICE_MIDDLE, NOTICE_NEWEST);

    private SiteNoticeTestSupport() {}

    static void cleanSeedRows(JdbcTemplate jdbcTemplate) {
        // POST 가 만든 행은 ID 를 모른다 — 작성자로 지운다
        jdbcTemplate.update(
                "DELETE FROM SITE_NOTICE WHERE ID IN (?, ?, ?, ?) OR AUTHOR_ACCOUNT_ID IN (?, ?, ?)",
                NOTICE_OLDEST,
                NOTICE_REMOVED,
                NOTICE_MIDDLE,
                NOTICE_NEWEST,
                ADMIN_ID,
                MEMBER_ID,
                WITHDRAWN_AUTHOR_ID);
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID IN (?, ?)", ADMIN_ID, MEMBER_ID);
    }

    static void insertAccount(JdbcTemplate jdbcTemplate, long id, SystemRole role) {
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "sitenotice-" + id + "@example.com",
                "sitenotice_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }

    static void insertNotice(
            JdbcTemplate jdbcTemplate,
            long id,
            String title,
            String body,
            long authorId,
            Instant createdAt,
            Instant updatedAt,
            Instant removedAt) {
        Timestamp removedTimestamp = null;
        if (removedAt != null) {
            removedTimestamp = Timestamp.from(removedAt);
        }
        jdbcTemplate.update(
                "INSERT INTO SITE_NOTICE (ID, TITLE, BODY, AUTHOR_ACCOUNT_ID, REMOVED_AT,"
                        + " CREATED_AT, UPDATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?)",
                id,
                title,
                body,
                authorId,
                removedTimestamp,
                Timestamp.from(createdAt),
                Timestamp.from(updatedAt));
    }
}
