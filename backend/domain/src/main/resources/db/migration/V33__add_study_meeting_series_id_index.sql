-- V33 — STUDY_MEETING.SERIES_ID 인덱스 (specs/study-meeting/spec.md 결정 2 후속).
--   V32 에서 SERIES_ID 컬럼을 추가했다. 묶음 단위 수정·삭제 기능을 붙이면 seriesId 로 회차를 검색하므로
--   인덱스 없이는 STUDY_MEETING 전체를 스캔한다. 지금은 사용하지 않지만 컬럼과 함께 인덱스도 준비한다.

CREATE INDEX idx_study_meeting_series_id ON STUDY_MEETING (SERIES_ID);
