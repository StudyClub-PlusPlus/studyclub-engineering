-- V5 — 온보딩 스펙(specs/user-onboarding/spec.md)에 맞게 스키마 보강.
--   * ACCOUNT: ONBOARDING_COMPLETED_AT, UNIQUE(NICKNAME)
--   * ACCOUNT_IDENTITY: PROVIDER_USER_ID → PROVIDER_ACCOUNT_ID, PROVIDER_EMAIL 추가
--   * ACCOUNT_CONSENT: 온보딩 완료 시 약관 동의 3행용 테이블 신설
--
-- 적용된 V1~V4 는 수정하지 않는다.

-- ---------------------------------------------------------------------------
-- ACCOUNT
-- ---------------------------------------------------------------------------
ALTER TABLE ACCOUNT
    ADD COLUMN ONBOARDING_COMPLETED_AT DATETIME NULL;

-- 온보딩 닉네임 중복 방지. 로그인 직후 임시값(account_<랜덤>)이 겹치면 재생성한다.
ALTER TABLE ACCOUNT
    ADD CONSTRAINT uk_account_nickname UNIQUE (NICKNAME);

-- ---------------------------------------------------------------------------
-- ACCOUNT_IDENTITY
-- ---------------------------------------------------------------------------
-- 스펙·ERD 컬럼명에 맞춤. UNIQUE(ISSUER, …) 제약은 컬럼 rename 을 따라간다.
ALTER TABLE ACCOUNT_IDENTITY
    RENAME COLUMN PROVIDER_USER_ID TO PROVIDER_ACCOUNT_ID;

ALTER TABLE ACCOUNT_IDENTITY
    ADD COLUMN PROVIDER_EMAIL VARCHAR(255) NULL;

-- ---------------------------------------------------------------------------
-- ACCOUNT_CONSENT
-- ---------------------------------------------------------------------------
-- 온보딩 완료 시 TERMS_OF_SERVICE / PRIVACY_POLICY / MARKETING 3행.
-- 약관 개정 시 같은 CONSENT_TYPE 에 새 CONSENT_VERSION 행을 추가한다.
CREATE TABLE ACCOUNT_CONSENT (
    ID              BIGINT       NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID      BIGINT       NOT NULL,
    CONSENT_TYPE    VARCHAR(20)  NOT NULL,
    AGREED          TINYINT(1)   NOT NULL,
    AGREED_AT       DATETIME     NOT NULL,
    CONSENT_VERSION VARCHAR(20)  NOT NULL,
    CREATED_AT      DATETIME(6)  NOT NULL,
    UPDATED_AT      DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_account_consent_account_type_version
        UNIQUE (ACCOUNT_ID, CONSENT_TYPE, CONSENT_VERSION),
    INDEX idx_account_consent_account (ACCOUNT_ID),
    CONSTRAINT fk_account_consent_account
        FOREIGN KEY (ACCOUNT_ID) REFERENCES ACCOUNT (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
