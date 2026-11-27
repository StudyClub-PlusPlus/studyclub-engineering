-- V68 — 행사 메일 발송 작업 (specs/event-mail/spec.md 「데이터 모델」, docs/erd/EVENT_MAIL.md · EVENT_MAIL_RECIPIENT.md)
-- 캡틴의 안내 메일 · 취소 안내 메일 한 번이 EVENT_MAIL 한 행이고, 받는 사람 스냅샷이 EVENT_MAIL_RECIPIENT 다. 자동 메일은 여기 없다.
-- 행사 · 계정 · 신청 · 템플릿은 다른 애그리거트라 FK 를 걸지 않는다. EVENT_MAIL_RECIPIENT 만 같은 애그리거트 안이라 FK 를 건다.
-- BODY 는 템플릿 본문(TEXT) 에 안내 내용(이스케이프 · <br> 로 늘어남)과 일정이 더해져 TEXT 를 넘을 수 있어 MEDIUMTEXT.
-- 시각은 모두 UTC.
CREATE TABLE EVENT_MAIL (
    ID                BIGINT       NOT NULL AUTO_INCREMENT,
    CLUB_EVENT_ID     BIGINT       NOT NULL,
    TYPE              VARCHAR(20)  NOT NULL,
    AUDIENCE          VARCHAR(20)  NOT NULL,
    TEMPLATE_ID       BIGINT       NOT NULL,
    SUBJECT           VARCHAR(255) NOT NULL,
    BODY              MEDIUMTEXT   NOT NULL,
    FORMAT            VARCHAR(10)  NOT NULL,
    NOTICE            TEXT         NOT NULL,
    DISPLAY_TIME_ZONE VARCHAR(64)  NOT NULL,
    RECIPIENT_COUNT   INT          NOT NULL,
    SENDER_ACCOUNT_ID BIGINT       NOT NULL,
    IDEMPOTENCY_KEY   VARCHAR(36)  NOT NULL,
    CREATED_AT        DATETIME(6)  NOT NULL,
    UPDATED_AT        DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    -- 같은 보내기 시도의 재시도가 새 발송을 만들지 않게 한다 (M5). SENDER_ACCOUNT_ID 인덱스를 겸한다
    CONSTRAINT uk_event_mail_sender_key UNIQUE (SENDER_ACCOUNT_ID, IDEMPOTENCY_KEY),
    -- 메일 이력 목록 정렬 · 페이지
    INDEX idx_event_mail_event_created (CLUB_EVENT_ID, CREATED_AT, ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE EVENT_MAIL_RECIPIENT (
    ID              BIGINT      NOT NULL AUTO_INCREMENT,
    EVENT_MAIL_ID   BIGINT      NOT NULL,
    ACCOUNT_ID      BIGINT      NOT NULL,
    REGISTRATION_ID BIGINT      NOT NULL,
    CHANNEL         VARCHAR(20) NOT NULL,
    CREATED_AT      DATETIME(6) NOT NULL,
    UPDATED_AT      DATETIME(6) NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_event_mail_recipient_mail_account UNIQUE (EVENT_MAIL_ID, ACCOUNT_ID),
    CONSTRAINT fk_event_mail_recipient_mail
        FOREIGN KEY (EVENT_MAIL_ID) REFERENCES EVENT_MAIL (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
