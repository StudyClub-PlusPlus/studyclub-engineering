-- V29 — STUDY_MEETING.TITLE (specs/study-meeting/spec.md 결정 1).
--   표시용 제목. 회차 번호는 저장하지 않는다 — SCHEDULED_AT 순서로 센다.
--   V23~V28 은 열린 PR(#174 schema-cleanup 등)이 쓰고 있어 비워 둔다. 머지 순서에 따라 번호를 다시 맞춘다.

ALTER TABLE STUDY_MEETING ADD COLUMN TITLE VARCHAR(50) NULL;
