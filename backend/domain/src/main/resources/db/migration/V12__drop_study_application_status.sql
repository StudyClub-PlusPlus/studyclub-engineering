-- V12 — STUDY_APPLICATION 상태 컬럼 제거. 행 존재 = 제출 완료. 정원은 제출 시 명부 인원으로 막는다.
ALTER TABLE STUDY_APPLICATION
    DROP INDEX idx_study_application_cohort_status,
    DROP COLUMN STATUS;
