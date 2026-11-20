-- V61 — stage 테스트 로그인 (specs/stage-email-login).
-- 운영에도 테이블·컬럼은 생기지만 기능 스위치(EMAIL_LOGIN_ENABLED)가 꺼져 있어 쓰이지 않는다.

CREATE TABLE EMAIL_SIGNUP_CODE (
    ID          BIGINT        NOT NULL AUTO_INCREMENT,
    EMAIL       VARCHAR(255)  NOT NULL,
    CODE_HASH   VARCHAR(64)   NOT NULL,
    CODE_COPY   VARCHAR(6)    NULL,
    ATTEMPTS    INT           NOT NULL DEFAULT 0,
    EXPIRES_AT  DATETIME   NOT NULL,
    USED_AT     DATETIME   NULL,
    CREATED_AT  DATETIME   NOT NULL,
    UPDATED_AT  DATETIME   NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_email_signup_code_email (EMAIL, ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 이메일 로그인 수단(ISSUER = 'EMAIL')의 비밀번호 해시. 구글 수단은 NULL
ALTER TABLE ACCOUNT_IDENTITY ADD COLUMN PASSWORD_HASH VARCHAR(255) NULL;
