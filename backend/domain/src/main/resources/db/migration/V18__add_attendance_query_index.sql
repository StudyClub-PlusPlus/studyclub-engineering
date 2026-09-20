-- V18 — STUDY_ATTENDANCE 조회 인덱스 추가
-- findByStudyIdAndAccountIdIn 에 사용. 기존 (ACCOUNT_ID, STUDY_ID) 인덱스는 leading column 이 달라 적합하지 않음.
ALTER TABLE STUDY_ATTENDANCE
    ADD INDEX idx_study_attendance_study_account (STUDY_ID, ACCOUNT_ID);
