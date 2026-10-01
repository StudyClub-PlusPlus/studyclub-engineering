-- STUDY 테이블에 작성자(등록한 계정 ID) 컬럼 추가.
-- ACCOUNT 애그리거트 밖이라 외래키 없이 인덱스만 건다.
-- 이 컬럼이 생기기 전 데이터는 NULL 이다.
ALTER TABLE STUDY
    ADD COLUMN created_by BIGINT NULL AFTER schedule;

CREATE INDEX idx_study_created_by ON STUDY (created_by);
