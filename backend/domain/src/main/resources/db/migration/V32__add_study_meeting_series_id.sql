-- V32 — STUDY_MEETING.SERIES_ID (specs/study-meeting/spec.md 결정 2).
--   한 요청으로 회차를 2개 이상 만들면 서버가 UUID 하나를 모든 행에 넣는다. 한 번만 만든 회차는 NULL.
--   지금은 저장만 한다 — 묶음 단위 수정·삭제를 나중에 붙이려면 만들 때 묶음을 남겨야 한다.
--   기존 행은 NULL 로 둔다. 이미 만든 반복 회차는 묶을 근거가 없다.

ALTER TABLE STUDY_MEETING ADD COLUMN SERIES_ID VARCHAR(36) NULL;
