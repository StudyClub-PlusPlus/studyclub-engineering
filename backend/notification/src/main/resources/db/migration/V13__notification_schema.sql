-- V13 — 회원가입 웰컴메일 알림 (specs/notification/spec.md).
--   * NOTIFICATION_TEMPLATE: 알림 문구. 백오피스 편집 화면이 아직 없어 이 파일이 유일한 등록 경로(시딩).
--   * NOTIFICATION: "이벤트가 발생했다는 사실"과 "실제로 언제·누구에게·어떻게 보냈는지"를 기록하는 아웃박스.
--     재시도 체인 컬럼(root_notification_id 등)은 이번 구현 범위 밖 — 자동/수동 재시도가 아직 없다.
--
-- notification 모듈이 자기 엔티티의 마이그레이션을 직접 갖는 첫 사례다. Flyway 는 classpath:db/migration 을
-- 모듈 경계 없이 한 시퀀스로 스캔한다. 원래 domain 모듈의 V11 을 이어 V12 로 번호를 매겼으나, 그 사이 beta 에
-- domain 모듈의 V12(recruit_schema, PR #91)가 먼저 병합되어 버전이 충돌해(Flyway "Found more than one
-- migration with version 12") V13 으로 재번호했다.

-- ACCOUNT(UPDATED_BY_ADMIN_ID)·NOTIFICATION_TEMPLATE/ACCOUNT(NOTIFICATION 쪽)는 모두 다른 애그리거트를 잇는
-- 참조라 FK 를 걸지 않는다 — ID 컬럼 + 인덱스만 둔다 (database-guide.md 의 "외래키 정책": 애그리거트 사이는 FK 대신
-- ID+인덱스, 애그리거트마다 트랜잭션이 다르므로 DB 제약으로 묶으면 경계가 다시 붙어 버린다).
CREATE TABLE NOTIFICATION_TEMPLATE (
    ID                   BIGINT       NOT NULL AUTO_INCREMENT,
    EVENT_TYPE           VARCHAR(40)  NOT NULL,
    CHANNEL              VARCHAR(20)  NOT NULL,
    SUBJECT              VARCHAR(255) NOT NULL,
    BODY                 TEXT         NOT NULL,
    UPDATED_BY_ADMIN_ID  BIGINT       NULL,
    CREATED_AT           DATETIME(6)  NOT NULL,
    UPDATED_AT           DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_notification_template_event_channel
        UNIQUE (EVENT_TYPE, CHANNEL),
    INDEX idx_notification_template_updated_by_admin (UPDATED_BY_ADMIN_ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE NOTIFICATION (
    ID                 BIGINT       NOT NULL AUTO_INCREMENT,
    EVENT_TYPE         VARCHAR(40)  NOT NULL,
    RECIPIENT_TYPE     VARCHAR(20)  NOT NULL,
    RECIPIENT_VALUE    VARCHAR(255) NOT NULL,
    RECIPIENT_USER_ID  BIGINT       NULL,
    TEMPLATE_ID        BIGINT       NOT NULL,
    PAYLOAD            JSON         NOT NULL,
    STATUS             VARCHAR(20)  NOT NULL,
    LOCKED_AT          DATETIME(6)  NULL,
    ERROR_TYPE         VARCHAR(30)  NULL,
    SCHEDULED_AT       DATETIME(6)  NULL,
    SENT_AT            DATETIME(6)  NULL,
    CREATED_AT         DATETIME(6)  NOT NULL,
    UPDATED_AT         DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_notification_status_created (STATUS, CREATED_AT),
    INDEX idx_notification_recipient_user (RECIPIENT_USER_ID),
    INDEX idx_notification_template (TEMPLATE_ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 웰컴메일 템플릿 시딩 (유일한 등록 경로 — 편집 화면 없음).
INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, UPDATED_BY_ADMIN_ID, CREATED_AT, UPDATED_AT)
VALUES (
    'USER_REGISTERED',
    'EMAIL',
    'StudyClub++에 오신 걸 환영합니다',
    '안녕하세요, {{nickname}}님.\n\nStudyClub++ 회원가입이 완료되었습니다.\n가입을 환영합니다!\n\nStudyClub++ 바로가기\n\n이 메일은 회원님의 가입 요청에 따라 가입 완료 사실을 안내하기 위해 발송되었습니다.\n\n직접 가입하지 않으셨거나 계정 관련 문의가 있다면 support@studyclub-plusplus.com으로 연락해 주세요.\n\n감사합니다.\nStudyClub++ 드림',
    NULL,
    UTC_TIMESTAMP(6),
    UTC_TIMESTAMP(6)
);
