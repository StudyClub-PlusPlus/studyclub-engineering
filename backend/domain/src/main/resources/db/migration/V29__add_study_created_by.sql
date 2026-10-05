-- V29 — STUDY.CREATED_BY 컬럼 추가
--
-- 스터디를 등록한 계정 ID. 기존 행은 NULL 허용(소급 불가).
-- 애그리거트 간 참조라 FK 제약은 두지 않는다 — ID 참조 + 인덱스(docs/backend-development-guide/ddd-guide.md).

ALTER TABLE STUDY
    ADD COLUMN CREATED_BY BIGINT NULL;

CREATE INDEX idx_study_created_by ON STUDY (CREATED_BY);
