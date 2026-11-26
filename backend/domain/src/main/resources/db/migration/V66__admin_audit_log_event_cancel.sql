-- V66 — 행사 취소 감사 기록 (specs/event-status/spec.md 「행사 취소 감사 기록」, docs/erd/ADMIN_AUDIT_LOG.md)
-- 행사 취소는 대상이 회원이 아니라 TARGET_ACCOUNT_ID 를 비우고 CLUB_EVENT_ID 에 행사를 둔다.
-- 기존 행은 모두 TARGET_ACCOUNT_ID 값이 있어 데이터를 바꾸지 않는다. CLUB_EVENT_ID 는 PARTICIPANT_ID 처럼 외래키를 걸지 않는다.
ALTER TABLE ADMIN_AUDIT_LOG MODIFY TARGET_ACCOUNT_ID BIGINT NULL;
ALTER TABLE ADMIN_AUDIT_LOG ADD COLUMN CLUB_EVENT_ID BIGINT NULL;
