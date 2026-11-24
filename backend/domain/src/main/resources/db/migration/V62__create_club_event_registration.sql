-- V62 — 행사 신청 (specs/event-registration/spec.md · specs/event-participant/spec.md 「데이터 모델 제안」, docs/erd/CLUB_EVENT_REGISTRATION.md)
-- 크루 한 명의 행사 신청 한 건이 한 행이다. 운영진 처리(ST-037)와 크루 신청·본인 취소(ST-038)가 함께 쓰는 공통 테이블 (P5).
-- 행사(CLUB_EVENT)와 계정(ACCOUNT)은 다른 애그리거트라 FK 를 걸지 않는다 (database-guide 외래키 정책). 탈퇴로 계정이 지워져도 ACCOUNT_ID 는 남는다.
-- 취소한 크루가 다시 신청하면 새 행이 생긴다 — 그래서 UNIQUE(CLUB_EVENT_ID, ACCOUNT_ID) 를 두지 않는다. 중복 신청은 계정 · 행사 행 잠금 뒤 확인으로 막는다.
-- 질문 · 답은 신청 당시 사본이다. 신청은 CLUB_EVENT_QUESTION 을 FK 로 물지 않는다. 닉네임 · 이메일은 복사하지 않고 ACCOUNT 에서 읽는다.
-- 시각은 모두 UTC.
CREATE TABLE CLUB_EVENT_REGISTRATION (
    ID                     BIGINT      NOT NULL AUTO_INCREMENT,
    CLUB_EVENT_ID          BIGINT      NOT NULL,
    ACCOUNT_ID             BIGINT      NOT NULL,
    CHANNEL                VARCHAR(20) NOT NULL,
    STATUS                 VARCHAR(20) NOT NULL,
    CANCEL_REASON          VARCHAR(30)     NULL,
    STATUS_CHANGED_AT      DATETIME(6)     NULL,
    STATUS_CHANGED_BY      BIGINT          NULL,
    APPLICANT_TIME_ZONE    VARCHAR(64)     NULL,
    QUESTIONS_SNAPSHOT     JSON        NOT NULL,
    ANSWERS_SNAPSHOT       JSON        NOT NULL,
    SUBMIT_IDEMPOTENCY_KEY VARCHAR(36) NOT NULL,
    CREATED_AT             DATETIME(6) NOT NULL,
    UPDATED_AT             DATETIME(6) NOT NULL,
    PRIMARY KEY (ID),
    -- 같은 신청 시도의 재시도(응답을 못 받은 재전송)가 새 신청을 만들지 않게 한다 (event-registration 「신청 제출」 1-1)
    CONSTRAINT uk_club_event_registration_account_submit_key UNIQUE (ACCOUNT_ID, SUBMIT_IDEMPOTENCY_KEY),
    -- 방식 · 상태별 수 — 정원 · 잔여석 · 표시 상태 · 일괄 확정 (ClubEventRegistrationPort)
    INDEX idx_club_event_registration_event_channel_status (CLUB_EVENT_ID, CHANNEL, STATUS),
    -- 참가자 목록 정렬 · 페이지 (event-participant)
    INDEX idx_club_event_registration_event_created (CLUB_EVENT_ID, CREATED_AT, ID),
    -- 중복 신청 확인 · 내 행사 · 내 신청서 · 탈퇴 처리
    INDEX idx_club_event_registration_account_event (ACCOUNT_ID, CLUB_EVENT_ID),
    -- 종료 자동 전환의 대상 고르기 (STATUS = 'PENDING')
    INDEX idx_club_event_registration_status_event (STATUS, CLUB_EVENT_ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
