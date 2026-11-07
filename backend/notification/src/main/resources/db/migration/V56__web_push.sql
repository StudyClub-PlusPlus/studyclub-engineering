-- V56: 웹 푸시 구독과 백오피스 직접 발송 템플릿 (specs/web-push/spec.md).
-- stage 는 Flyway off(Hibernate update)라 표는 자동으로 생기지만 템플릿 INSERT 는 이 SQL 을 한 번 손으로 적용한다.
CREATE TABLE WEB_PUSH_SUBSCRIPTION (
    ID            BIGINT        NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID    BIGINT        NOT NULL,
    ENDPOINT      VARCHAR(1024) NOT NULL,
    ENDPOINT_HASH VARCHAR(64)   NOT NULL,
    P256DH        VARCHAR(128)  NOT NULL,
    AUTH          VARCHAR(64)   NOT NULL,
    CREATED_AT    DATETIME(6)   NOT NULL,
    UPDATED_AT    DATETIME(6)   NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_web_push_subscription_endpoint_hash UNIQUE (ENDPOINT_HASH),
    INDEX idx_web_push_subscription_account (ACCOUNT_ID)
);

-- 캡틴이 쓴 제목·본문을 그대로 옮긴다. 이미 있으면 덮어쓰지 않는다.
INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, CREATED_AT, UPDATED_AT)
SELECT 'ADMIN_PUSH', 'WEB_PUSH', '{{title}}', '{{body}}', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
WHERE NOT EXISTS (
    SELECT 1 FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'ADMIN_PUSH' AND CHANNEL = 'WEB_PUSH'
);
