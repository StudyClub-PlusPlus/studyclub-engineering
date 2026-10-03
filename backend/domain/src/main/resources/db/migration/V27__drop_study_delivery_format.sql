-- V27 — STUDY.STUDY_DELIVERY_FORMAT 컬럼 제거
--
-- 모든 스터디는 온라인 진행이라 ONLINE 고정값이었다.
-- 포맷 다양화 계획이 생기면 그때 STUDY_RECRUITMENT 에 추가한다.

ALTER TABLE STUDY
    DROP COLUMN STUDY_DELIVERY_FORMAT;
