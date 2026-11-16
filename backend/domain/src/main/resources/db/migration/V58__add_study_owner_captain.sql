-- V58 — STUDY.OWNER_CAPTAIN_ID 컬럼 추가
--
-- 담당 캡틴. 스터디당 한 명이고 백오피스 신청자 탭에서 바꾼다. CREATED_BY 는 「등록한 사람」 기록으로만 남는다
-- (docs/share/2026-11-16-owner-captain-assignable.md). NULL = 담당 캡틴 없음 → 캡틴 누구나.
-- 애그리거트 간 참조라 FK 제약은 두지 않는다 — ID 참조 + 인덱스(docs/backend-development-guide/ddd-guide.md).

ALTER TABLE STUDY
    ADD COLUMN OWNER_CAPTAIN_ID BIGINT NULL;

CREATE INDEX idx_study_owner_captain ON STUDY (OWNER_CAPTAIN_ID);

-- 지금까지는 CREATED_BY 로 판정했다 — 같은 값으로 채워 오늘과 똑같이 동작하게 한다
UPDATE STUDY SET OWNER_CAPTAIN_ID = CREATED_BY WHERE CREATED_BY IS NOT NULL;
