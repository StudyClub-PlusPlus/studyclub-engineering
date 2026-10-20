-- V37 — 올린 파일 테이블 신설 (specs/profile-image/spec.md, docs/erd/STORAGE_OBJECT.md)
-- 오브젝트 스토리지에 올린 파일 하나가 행 하나. 「누가 어떤 용도로 어디에 올렸고 지금 쓰이고 있나」 만 담는다.
-- 사진 주소 자체는 기능 쪽 칼럼(ACCOUNT.PROFILE_IMG_URL 등)에 적고, 이 행은 주소에서 뽑은 OBJECT_KEY 로 찾는다.
-- ACCOUNT 와 FK 를 걸지 않는다 (애그리거트 간 참조). PROVIDER 는 파일이 있는 저장소 — 지금은 S3 만 쓴다.
CREATE TABLE STORAGE_OBJECT (
    ID           BIGINT       NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID   BIGINT       NOT NULL,
    PURPOSE      VARCHAR(20)  NOT NULL,
    PROVIDER     VARCHAR(20)  NOT NULL,
    OBJECT_KEY   VARCHAR(512) NOT NULL,
    CONTENT_TYPE VARCHAR(40)  NOT NULL,
    SIZE         BIGINT       NOT NULL,
    STATUS       VARCHAR(20)  NOT NULL,
    ATTACHED_AT  DATETIME         NULL,
    CREATED_AT   DATETIME     NOT NULL,
    UPDATED_AT   DATETIME     NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_storage_object_key UNIQUE (OBJECT_KEY),
    INDEX idx_storage_object_status_created (STATUS, CREATED_AT),
    INDEX idx_storage_object_account_status (ACCOUNT_ID, STATUS)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
