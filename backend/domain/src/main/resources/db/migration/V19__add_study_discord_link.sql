-- V19 — STUDY_DISCORD_LINK 신설 (Notion 134).
--   봇이 아는 식별자는 디스코드 카테고리 ID 뿐이라 STUDY.ID 로 바꿀 자리가 필요하다.
--   snowflake 는 VARCHAR — BIGINT 로 받으면 JS 정밀도에서 깨진다 (봇 계약: 경계에서 항상 문자열).
--   채널 목록은 저장하지 않는다. get-study-channels 로 조회되고, 저장하면 디스코드에서 지운 채널을
--   백엔드만 들고 있게 된다.

CREATE TABLE STUDY_DISCORD_LINK (
    ID               BIGINT       NOT NULL AUTO_INCREMENT,
    STUDY_ID         BIGINT       NOT NULL,
    DISCORD_STUDY_ID VARCHAR(20)  NOT NULL,
    DISCORD_ROLE_ID  VARCHAR(20)  NOT NULL,
    CREATED_AT       DATETIME     NOT NULL,
    UPDATED_AT       DATETIME     NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_discord_link_study   UNIQUE (STUDY_ID),
    CONSTRAINT uk_study_discord_link_discord UNIQUE (DISCORD_STUDY_ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
