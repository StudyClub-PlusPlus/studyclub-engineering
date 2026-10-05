-- V23 — STUDY_MEETING.TITLE (specs/study-meeting/spec.md 결정 1).
--   표시용 제목. 회차 번호는 저장하지 않는다 — SCHEDULED_AT 순서로 센다.

ALTER TABLE STUDY_MEETING ADD COLUMN TITLE VARCHAR(50) NULL;
