-- V21 — 회원 탈퇴 사유 집계 테이블 신설
-- ACCOUNT_ID 를 두지 않는다: 계정이 지워지면 이을 대상도 없고, 사유는 집계용이라
-- 개인과 이어질 필요가 없다 (specs/user-leave/spec.md).
CREATE TABLE ACCOUNT_LEAVE_REASON (
    ID         BIGINT      NOT NULL AUTO_INCREMENT,
    REASON     VARCHAR(30)     NULL,
    CREATED_AT DATETIME    NOT NULL,
    UPDATED_AT DATETIME    NOT NULL,
    PRIMARY KEY (ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
