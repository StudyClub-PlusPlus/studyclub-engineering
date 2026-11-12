-- V51 — 문의·오류 신고 (specs/feedback/spec.md, docs/erd/FEEDBACK.md, docs/erd/FEEDBACK_IMAGE.md)
-- 크루가 보낸 문의 한 건과 캡틴의 처리(상태 · 회신 · 메모)가 FEEDBACK 한 행이다. 첨부 이미지는 FEEDBACK_IMAGE.
-- ACCOUNT 와는 FK 를 걸지 않는다 (애그리거트 간 참조) — 탈퇴로 계정이 지워져도 문의는 남고 「탈퇴한 사용자」로 보인다.
-- STATUS = DONE ⇔ REPLY_CONTENT 있음 ⇔ DONE_BY_ACCOUNT_ID 있음 은 엔티티(Feedback)가 지킨다. 삭제 컬럼은 두지 않는다.
CREATE TABLE FEEDBACK (
    ID                 BIGINT        NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID         BIGINT        NOT NULL,
    TYPE               VARCHAR(20)   NOT NULL,
    TITLE              VARCHAR(100)  NOT NULL,
    CONTENT            VARCHAR(2000) NOT NULL,
    BROWSER            VARCHAR(60)       NULL,
    VIEWPORT_WIDTH     INT               NULL,
    VIEWPORT_HEIGHT    INT               NULL,
    STATUS             VARCHAR(20)   NOT NULL,
    DONE_BY_ACCOUNT_ID BIGINT            NULL,
    REPLY_CONTENT      VARCHAR(2000)     NULL,
    REPLIED_AT         DATETIME(6)       NULL,
    ADMIN_MEMO         VARCHAR(2000)     NULL,
    CREATED_AT         DATETIME(6)   NOT NULL,
    UPDATED_AT         DATETIME(6)   NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_feedback_account_created (ACCOUNT_ID, CREATED_AT),
    INDEX idx_feedback_created (CREATED_AT)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 첨부 이미지 — 문의 애그리거트 안이라 FEEDBACK 과 FK 를 건다. STORAGE_OBJECT 와는 ID 로만 잇는다.
CREATE TABLE FEEDBACK_IMAGE (
    ID                BIGINT       NOT NULL AUTO_INCREMENT,
    FEEDBACK_ID       BIGINT       NOT NULL,
    STORAGE_OBJECT_ID BIGINT       NOT NULL,
    IMAGE_URL         VARCHAR(512) NOT NULL,
    DISPLAY_ORDER     INT          NOT NULL,
    CREATED_AT        DATETIME(6)  NOT NULL,
    UPDATED_AT        DATETIME(6)  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_feedback_image_feedback_order UNIQUE (FEEDBACK_ID, DISPLAY_ORDER),
    INDEX idx_feedback_image_storage_object (STORAGE_OBJECT_ID),
    CONSTRAINT fk_feedback_image_feedback
        FOREIGN KEY (FEEDBACK_ID) REFERENCES FEEDBACK (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
