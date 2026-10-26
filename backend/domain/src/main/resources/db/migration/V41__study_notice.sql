-- V41 — 스터디 공지 발송 기록 (specs/study-notice/spec.md, docs/erd/STUDY_NOTICE.md)
-- 네비게이터(담당 캡틴)가 한 반의 팀원에게 보낸 공지 한 건과 받는 사람. 메일 결과는 NOTIFICATION 행(V42)에서 센다.
--
-- STUDY / STUDY_GROUP / ACCOUNT 는 다른 애그리거트라 FK 를 걸지 않는다 (ID 컬럼 + 인덱스만 — database-guide.md 「외래키 정책」).
-- 회원이 탈퇴해 ACCOUNT 가 지워져도 기록은 남고, 남은 ID 로는 사람을 되짚을 수 없다.
-- STUDY_NOTICE_RECIPIENT 는 같은 애그리거트 안이라 FK 를 건다.
CREATE TABLE STUDY_NOTICE (
    ID                  BIGINT       NOT NULL AUTO_INCREMENT,
    STUDY_ID            BIGINT       NOT NULL,
    STUDY_GROUP_ID      BIGINT       NOT NULL,
    SENDER_ACCOUNT_ID   BIGINT       NOT NULL,
    TITLE               VARCHAR(60)  NOT NULL,
    BODY                TEXT         NOT NULL,
    SEND_EMAIL          TINYINT(1)   NOT NULL,
    SEND_DISCORD        TINYINT(1)   NOT NULL,
    DISCORD_STATUS      VARCHAR(20)  NOT NULL,
    DISCORD_SKIP_REASON VARCHAR(30)      NULL,
    CREATED_AT          DATETIME(6)  NOT NULL,
    UPDATED_AT          DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_study_notice_group_created (STUDY_GROUP_ID, CREATED_AT),
    INDEX idx_study_notice_study (STUDY_ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_NOTICE_RECIPIENT (
    ID                BIGINT      NOT NULL AUTO_INCREMENT,
    NOTICE_ID         BIGINT      NOT NULL,
    ACCOUNT_ID        BIGINT      NOT NULL,
    DISCORD_MENTIONED TINYINT(1)  NOT NULL DEFAULT 0,
    CREATED_AT        DATETIME(6) NOT NULL,
    UPDATED_AT        DATETIME(6) NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_notice_recipient UNIQUE (NOTICE_ID, ACCOUNT_ID),
    CONSTRAINT fk_study_notice_recipient_notice
        FOREIGN KEY (NOTICE_ID) REFERENCES STUDY_NOTICE (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
