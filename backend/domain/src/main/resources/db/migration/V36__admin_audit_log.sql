-- V36 — 운영 감사 로그 테이블 신설 (specs/admin-users/spec.md, docs/erd/ADMIN_AUDIT_LOG.md)
-- 캡틴이 이메일 원본을 보거나 계정 권한을 바꾼 일을 남긴다. insert-only.
-- 계정 ID 와 행위만 담는다 (이메일·닉네임 금지). ACTOR/TARGET 은 ACCOUNT 와 FK 를 걸지 않는다:
-- 회원이 탈퇴해 ACCOUNT 행이 지워져도 기록은 남고, 남은 ID 로는 더 이상 사람을 되짚을 수 없다.
CREATE TABLE ADMIN_AUDIT_LOG (
    ID                BIGINT      NOT NULL AUTO_INCREMENT,
    ACTOR_ACCOUNT_ID  BIGINT      NOT NULL,
    ACTION            VARCHAR(20) NOT NULL,
    TARGET_ACCOUNT_ID BIGINT      NOT NULL,
    BEFORE_VALUE      VARCHAR(20)     NULL,
    AFTER_VALUE       VARCHAR(20)     NULL,
    CREATED_AT        DATETIME    NOT NULL,
    UPDATED_AT        DATETIME    NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_admin_audit_log_target (TARGET_ACCOUNT_ID, CREATED_AT),
    INDEX idx_admin_audit_log_actor (ACTOR_ACCOUNT_ID, CREATED_AT)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
