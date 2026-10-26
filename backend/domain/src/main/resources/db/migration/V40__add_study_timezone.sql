-- 기준 시간대 — KST / PST / BOTH(동시 진행). NULL = 미정 (이 컬럼 전 데이터). docs/erd/STUDY.md
ALTER TABLE STUDY
    ADD COLUMN TIMEZONE VARCHAR(10) NULL;
