-- V2 — 도메인 테이블 최초 생성.
-- 규칙: 테이블 대문자, 컬럼 대문자 snake_case, FK 는 부모 없이 자식이 무의미한 관계에만.
-- cross-domain 참조(ACCOUNT_ID 등)는 FK 없이 인덱스만.

CREATE TABLE ACCOUNT_IDENTITY (
    ID               BIGINT        NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID          BIGINT        NOT NULL,
    ISSUER           VARCHAR(20)   NOT NULL,
    PROVIDER_ACCOUNT_ID VARCHAR(255)  NOT NULL,
    LAST_LOGIN_AT    DATETIME       NULL,
    CREATED_AT       DATETIME   NOT NULL,
    UPDATED_AT       DATETIME   NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_account_identity_account_issuer     UNIQUE (ACCOUNT_ID, ISSUER),
    CONSTRAINT uk_account_identity_issuer_provider UNIQUE (ISSUER, PROVIDER_ACCOUNT_ID),
    CONSTRAINT fk_account_identity_account FOREIGN KEY (ACCOUNT_ID) REFERENCES USERS (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY (
    ID             BIGINT        NOT NULL AUTO_INCREMENT,
    SLUG           VARCHAR(100)  NOT NULL,
    TITLE          VARCHAR(200)  NOT NULL,
    DESCRIPTION    TEXT              NULL,
    CATEGORY       VARCHAR(50)   NOT NULL,
    STUDY_KIND     VARCHAR(20)   NOT NULL,
    THUMBNAIL_URL  VARCHAR(2048)     NULL,
    IS_HIDDEN      TINYINT(1)    NOT NULL DEFAULT 0,
    CREATED_AT     DATETIME   NOT NULL,
    UPDATED_AT     DATETIME   NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_slug UNIQUE (SLUG)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_COHORT (
    ID                    BIGINT        NOT NULL AUTO_INCREMENT,
    STUDY_ID              BIGINT        NOT NULL,
    STUDY_DELIVERY_FORMAT VARCHAR(20)   NOT NULL,
    STATUS                VARCHAR(20)   NOT NULL,
    APPLICATION_FORM      JSON              NULL,
    CURRICULUM            JSON              NULL,
    CAPACITY              INT               NULL,
    RECRUIT_DEADLINE      DATETIME   NOT NULL,
    START_DATE            DATETIME       NULL,
    END_DATE              DATETIME       NULL,
    DISCORD_CHANNEL_URL   VARCHAR(2048)     NULL,
    DRIVE_URL             VARCHAR(2048)     NULL,
    CREATED_AT            DATETIME   NOT NULL,
    UPDATED_AT            DATETIME   NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_study_cohort_study_status (STUDY_ID, STATUS),
    CONSTRAINT fk_study_cohort_study FOREIGN KEY (STUDY_ID) REFERENCES STUDY (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_CLASS (
    ID              BIGINT        NOT NULL AUTO_INCREMENT,
    STUDY_COHORT_ID BIGINT        NOT NULL,
    NAME            VARCHAR(255)  NOT NULL,
    STARTS_AT       DATETIME       NULL,
    TIMEZONE        VARCHAR(64)       NULL,
    CAPACITY        INT               NULL,
    CREATED_AT      DATETIME   NOT NULL,
    UPDATED_AT      DATETIME   NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_class_cohort_name UNIQUE (STUDY_COHORT_ID, NAME),
    INDEX idx_study_class_cohort (STUDY_COHORT_ID),
    CONSTRAINT fk_study_class_cohort FOREIGN KEY (STUDY_COHORT_ID) REFERENCES STUDY_COHORT (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_MEETING (
    ID             BIGINT       NOT NULL AUTO_INCREMENT,
    STUDY_CLASS_ID BIGINT       NOT NULL,
    SCHEDULED_AT   DATETIME  NOT NULL,
    STARTS_AT      DATETIME      NULL,
    ENDS_AT        DATETIME      NULL,
    CREATED_AT     DATETIME  NOT NULL,
    UPDATED_AT     DATETIME  NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_study_meeting_class_scheduled (STUDY_CLASS_ID, SCHEDULED_AT),
    CONSTRAINT fk_study_meeting_class FOREIGN KEY (STUDY_CLASS_ID) REFERENCES STUDY_CLASS (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_APPLICATION (
    ID              BIGINT       NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID         BIGINT       NOT NULL,
    STUDY_COHORT_ID BIGINT       NOT NULL,
    STATUS          VARCHAR(20)  NOT NULL,
    FORM_ANSWER     JSON         NOT NULL,
    CREATED_AT      DATETIME  NOT NULL,
    UPDATED_AT      DATETIME  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_application_cohort_account UNIQUE (STUDY_COHORT_ID, ACCOUNT_ID),
    INDEX idx_study_application_account (ACCOUNT_ID),
    INDEX idx_study_application_cohort_status (STUDY_COHORT_ID, STATUS)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_PARTICIPANT (
    ID               BIGINT       NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID          BIGINT       NOT NULL,
    STUDY_CLASS_ID   BIGINT       NOT NULL,
    STUDY_COHORT_ID  BIGINT       NOT NULL,
    STATUS           VARCHAR(20)  NOT NULL,
    PARTICIPANT_ROLE VARCHAR(20)  NOT NULL,
    JOINED_AT        DATETIME  NOT NULL,
    CREATED_AT       DATETIME  NOT NULL,
    UPDATED_AT       DATETIME  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_participant_account_class UNIQUE (ACCOUNT_ID, STUDY_CLASS_ID),
    INDEX idx_study_participant_account (ACCOUNT_ID),
    INDEX idx_study_participant_class_status (STUDY_CLASS_ID, STATUS),
    INDEX idx_study_participant_cohort_status (STUDY_COHORT_ID, STATUS)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_ATTENDANCE (
    ID               BIGINT       NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID          BIGINT       NOT NULL,
    STUDY_COHORT_ID  BIGINT       NOT NULL,
    STUDY_CLASS_ID   BIGINT       NOT NULL,
    STUDY_MEETING_ID BIGINT       NOT NULL,
    STATUS           VARCHAR(20)  NOT NULL,
    CREATED_AT       DATETIME  NOT NULL,
    UPDATED_AT       DATETIME  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_attendance_meeting_account UNIQUE (STUDY_MEETING_ID, ACCOUNT_ID),
    INDEX idx_study_attendance_account_cohort (ACCOUNT_ID, STUDY_COHORT_ID),
    INDEX idx_study_attendance_account_class (ACCOUNT_ID, STUDY_CLASS_ID),
    INDEX idx_study_attendance_cohort_status (STUDY_COHORT_ID, STATUS)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_REVIEW (
    ID              BIGINT       NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID         BIGINT       NOT NULL,
    STUDY_COHORT_ID BIGINT       NOT NULL,
    STUDY_ID        BIGINT       NOT NULL,
    CONTENT         TEXT         NOT NULL,
    CREATED_AT      DATETIME  NOT NULL,
    UPDATED_AT      DATETIME  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_review_cohort_account UNIQUE (STUDY_COHORT_ID, ACCOUNT_ID),
    INDEX idx_study_review_account (ACCOUNT_ID),
    INDEX idx_study_review_cohort (STUDY_COHORT_ID),
    INDEX idx_study_review_study_created (STUDY_ID, CREATED_AT)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_BOOKMARK (
    ID         BIGINT       NOT NULL AUTO_INCREMENT,
    ACCOUNT_ID    BIGINT       NOT NULL,
    STUDY_ID   BIGINT       NOT NULL,
    CREATED_AT DATETIME  NOT NULL,
    UPDATED_AT DATETIME  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_bookmark_account_study UNIQUE (ACCOUNT_ID, STUDY_ID),
    INDEX idx_study_bookmark_account (ACCOUNT_ID),
    INDEX idx_study_bookmark_study (STUDY_ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_PROPOSAL (
    ID               BIGINT       NOT NULL AUTO_INCREMENT,
    PROPOSER_ACCOUNT_ID BIGINT       NOT NULL,
    CONTENT          TEXT         NOT NULL,
    PROPOSED_DATE    DATETIME  NOT NULL,
    STATUS           VARCHAR(20)  NOT NULL,
    CREATED_AT       DATETIME  NOT NULL,
    UPDATED_AT       DATETIME  NOT NULL,
    PRIMARY KEY (ID),
    INDEX idx_study_proposal_proposer (PROPOSER_ACCOUNT_ID),
    INDEX idx_study_proposal_status_created (STATUS, CREATED_AT)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE STUDY_PROPOSAL_INTEREST (
    ID          BIGINT       NOT NULL AUTO_INCREMENT,
    PROPOSAL_ID BIGINT       NOT NULL,
    ACCOUNT_ID     BIGINT       NOT NULL,
    CREATED_AT  DATETIME  NOT NULL,
    UPDATED_AT  DATETIME  NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_proposal_interest_proposal_account UNIQUE (PROPOSAL_ID, ACCOUNT_ID),
    INDEX idx_proposal_interest_proposal (PROPOSAL_ID),
    INDEX idx_proposal_interest_account (ACCOUNT_ID),
    CONSTRAINT fk_proposal_interest_proposal FOREIGN KEY (PROPOSAL_ID) REFERENCES STUDY_PROPOSAL (ID) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
