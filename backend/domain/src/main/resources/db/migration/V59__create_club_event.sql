-- V59 — 행사 (specs/event/spec.md, docs/erd/CLUB_EVENT.md, CLUB_EVENT_CHANNEL.md, CLUB_EVENT_QUESTION.md)
-- 캡틴이 백오피스에서 등록하면 바로 공개(PUBLISHED)되는 행사 한 건이 CLUB_EVENT 한 행이다.
-- 참여 방식(온라인·오프라인)과 신청 질문은 행사 애그리거트 안이라 FK 를 건다. 등록한 계정(CREATED_BY)과는 FK 를 걸지 않는다 (애그리거트 간 참조).
-- 신청 테이블은 신청 스펙(crew-apply-event)에서 만든다. 신청은 질문 행을 FK 로 물지 않는다 — 신청 당시 질문의 사본을 신청 쪽에 둔다.
-- VERSION 은 JPA @Version 이 아니다. 수정 요청이 보낸 값과 행 잠금 뒤 비교하고 저장마다 1 올린다 (Q14 · N3).
-- 시각은 모두 UTC. 표시 상태(모집 중·정원 마감 등)는 저장하지 않고 요청마다 계산한다.
CREATE TABLE CLUB_EVENT (
    ID                     BIGINT       NOT NULL AUTO_INCREMENT,
    TITLE                  VARCHAR(60)  NOT NULL,
    SUMMARY                VARCHAR(120) NOT NULL,
    DESCRIPTION            TEXT         NOT NULL,
    TIME_ZONE              VARCHAR(64)  NOT NULL,
    STARTS_AT              DATETIME(6)  NOT NULL,
    ENDS_AT                DATETIME(6)      NULL,
    DEADLINE_AT            DATETIME(6)  NOT NULL,
    CONFIRMATION           VARCHAR(20)  NOT NULL,
    STATUS                 VARCHAR(20)  NOT NULL,
    PUBLISHED_AT           DATETIME(6)  NOT NULL,
    VERSION                BIGINT       NOT NULL,
    CREATED_BY             BIGINT       NOT NULL,
    CREATE_IDEMPOTENCY_KEY VARCHAR(36)  NOT NULL,
    CREATED_AT             DATETIME(6)  NOT NULL,
    UPDATED_AT             DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_club_event_created_by_idempotency UNIQUE (CREATED_BY, CREATE_IDEMPOTENCY_KEY),
    INDEX idx_club_event_starts_at_id (STARTS_AT, ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 참여 방식 — 행사당 방식마다 한 행. format(ONLINE·OFFLINE·HYBRID)은 행 조합으로 정한다.
CREATE TABLE CLUB_EVENT_CHANNEL (
    ID            BIGINT        NOT NULL AUTO_INCREMENT,
    CLUB_EVENT_ID BIGINT        NOT NULL,
    CHANNEL       VARCHAR(20)   NOT NULL,
    CAPACITY      INT           NOT NULL,
    LOCATION      VARCHAR(300)      NULL,
    ONLINE_URL    VARCHAR(2048)     NULL,
    CREATED_AT    DATETIME(6)   NOT NULL,
    UPDATED_AT    DATETIME(6)   NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_club_event_channel_event_channel UNIQUE (CLUB_EVENT_ID, CHANNEL),
    CONSTRAINT fk_club_event_channel_event
        FOREIGN KEY (CLUB_EVENT_ID) REFERENCES CLUB_EVENT (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 현재 신청 질문 — QUESTION_KEY 는 행사 안에서 유지되는 안정 키(응답의 questionId). OPTIONS 는 문자열 JSON 배열.
CREATE TABLE CLUB_EVENT_QUESTION (
    ID            BIGINT       NOT NULL AUTO_INCREMENT,
    CLUB_EVENT_ID BIGINT       NOT NULL,
    QUESTION_KEY  VARCHAR(36)  NOT NULL,
    LABEL         VARCHAR(200) NOT NULL,
    TYPE          VARCHAR(20)  NOT NULL,
    REQUIRED      BOOLEAN      NOT NULL,
    OPTIONS       JSON         NOT NULL,
    SORT_ORDER    INT          NOT NULL,
    CREATED_AT    DATETIME(6)  NOT NULL,
    UPDATED_AT    DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_club_event_question_event_key UNIQUE (CLUB_EVENT_ID, QUESTION_KEY),
    INDEX idx_club_event_question_event_sort (CLUB_EVENT_ID, SORT_ORDER),
    CONSTRAINT fk_club_event_question_event
        FOREIGN KEY (CLUB_EVENT_ID) REFERENCES CLUB_EVENT (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
