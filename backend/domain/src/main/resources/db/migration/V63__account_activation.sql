-- V63 — 계정 활성화 기록 (specs/event-registration 「퍼널·계측」 R4, specs/analytics, docs/erd/ACCOUNT.md)
-- 활성화 = 계정의 첫 스터디 신청 또는 첫 행사 신청 중 먼저 성공한 한 번. 판정을 DB 한 곳에 둔다 — 신청 트랜잭션이 계정 행을 잠근 뒤
-- ACTIVATED_AT 이 NULL 일 때만 채우고, 채웠을 때만 분석 이벤트 Activated 를 낸다. 동시 신청 · 재전송에도 한 번이다.
ALTER TABLE ACCOUNT
    ADD COLUMN ACTIVATED_AT      DATETIME(6) NULL,
    ADD COLUMN ACTIVATION_ACTION VARCHAR(20) NULL;

-- 이미 스터디를 신청한 회원은 첫 신청 시각으로 활성화를 채운다 — 행사 신청으로 다시 활성화되지 않게.
UPDATE ACCOUNT a
    JOIN (SELECT ACCOUNT_ID, MIN(CREATED_AT) AS FIRST_APPLIED_AT
          FROM STUDY_APPLICATION
          GROUP BY ACCOUNT_ID) first_application
    ON first_application.ACCOUNT_ID = a.ID
SET a.ACTIVATED_AT      = first_application.FIRST_APPLIED_AT,
    a.ACTIVATION_ACTION = 'STUDY_APPLIED'
WHERE a.ACTIVATED_AT IS NULL;
