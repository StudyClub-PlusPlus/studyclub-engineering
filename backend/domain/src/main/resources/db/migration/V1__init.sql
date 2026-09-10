-- V1 — 최초 스키마. 이 시점까지 ddl-auto: update 가 만들던 것을 마이그레이션으로 고정한다.
--
-- 규칙 (docs/backend-development-guide/jpa-guide.md):
--   * 테이블 이름은 대문자 (USERS)  * 컬럼은 소문자 snake_case
--   * 적용된 마이그레이션은 절대 수정하지 않는다 — 고칠 게 있으면 V2 를 추가한다

CREATE TABLE USERS (
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    email      VARCHAR(255)  NOT NULL,
    name       VARCHAR(255)      NULL,
    -- 구글 프로필 URL 은 우리가 길이를 못 정한다. 2026-08-24 에 512 를 넘겨 로그인이 500 났다.
    picture    VARCHAR(2048)     NULL,
    google_sub VARCHAR(255)      NULL,
    role       VARCHAR(20)   NOT NULL,
    created_at DATETIME(6)   NOT NULL,
    updated_at DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
