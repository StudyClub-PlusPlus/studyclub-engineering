-- V40 — STUDY_PARTICIPANT.STUDY_GROUP_ID 를 NULL 허용으로 변경.
-- 신청을 제출하면 같은 트랜잭션에서 명부에 들어간다. 그 순간에는 반이 아직 없어서 비워 둔다(NULL = 반 미배정).
-- 캡틴이 반을 만든 뒤 「크루의 반 지정」이 채운다 (docs/share/2026-10-18-roster-on-apply.md).
-- UNIQUE(ACCOUNT_ID, STUDY_GROUP_ID) 는 NULL 을 여럿 허용한다 — 같은 기수 중복 신청은 계정 잠금 + 기존 신청 확인이 막는다.
ALTER TABLE STUDY_PARTICIPANT
    MODIFY COLUMN STUDY_GROUP_ID BIGINT NULL;
