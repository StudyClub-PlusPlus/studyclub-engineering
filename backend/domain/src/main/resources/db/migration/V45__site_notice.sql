-- V45 — 사이트 공지 테이블 신설 (specs/site-notice/spec.md, docs/erd/SITE_NOTICE.md)
-- 캡틴이 사이트 전체에 올리는 글. 등록 즉시 게시라 게시 시각 컬럼이 없고 CREATED_AT 이 게시 시각이다.
-- 지우기는 REMOVED_AT 을 적는 소프트 삭제. ACCOUNT 와 FK 를 걸지 않는다 (애그리거트 간 참조) — 작성자가 탈퇴해도 공지는 남는다.
-- 반 공지(STUDY_NOTICE, ST-016)와는 다른 테이블이다.
CREATE TABLE SITE_NOTICE (
    ID                BIGINT       NOT NULL AUTO_INCREMENT,
    TITLE             VARCHAR(200) NOT NULL,
    BODY              TEXT         NOT NULL,
    AUTHOR_ACCOUNT_ID BIGINT       NOT NULL,
    REMOVED_AT        DATETIME         NULL,
    CREATED_AT        DATETIME     NOT NULL,
    UPDATED_AT        DATETIME     NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_site_notice_removed_id (REMOVED_AT, ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
