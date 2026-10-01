-- V23 — STUDY_PARTICIPANT.LEFT_AT 추가
-- 회원 탈퇴 시 명부 행을 지우지 않고 STATUS=DELETED + LEFT_AT 으로 바꾼다. 지우면 STUDY_ATTENDANCE
-- (ACCOUNT_ID 로만 연결, FK 없음)가 갈 곳을 잃어 출석률 집계에서 통째로 빠지기 때문이다
-- (specs/user-leave/spec.md). 이 시각 이후 회차는 결석(0점)이 아니라 집계 자체에서 제외한다.
ALTER TABLE STUDY_PARTICIPANT ADD COLUMN LEFT_AT DATETIME NULL;
