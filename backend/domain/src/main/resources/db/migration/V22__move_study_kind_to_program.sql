-- V22 — STUDY_KIND 를 STUDY → STUDY_PROGRAM 으로 되돌린다
--
-- 종류는 기수가 아니라 프로그램의 속성이다 (docs/erd/STUDY_PROGRAM.md). 지금 스키마는 한 프로그램의
-- 두 기수가 서로 다른 종류를 가질 수 있어, 「새 기수는 클럽에만 붙일 수 있다」를 판정할 근거가 없다.
-- V16 이 STUDY_PROGRAM → STUDY 로 옮겼던 것을 되돌리는 셈이다.

-- 1. 컬럼 추가 (백필 전이라 NULL 허용)
ALTER TABLE STUDY_PROGRAM
    ADD COLUMN STUDY_KIND VARCHAR(20) NULL;

-- 2. 백필 — 프로그램별 ID 가 가장 큰 기수의 값을 쓴다.
--    기수마다 값이 갈렸을 수 있어 "아무거나"가 아니라 최신 기수 하나로 정한다.
--    최신 기수를 파생 테이블로 JOIN 한다: UPDATE 대상이 아닌 STUDY 를 읽는 것이지만 형태를 V23 과 맞춘다.
UPDATE STUDY_PROGRAM p
    JOIN (SELECT PROGRAM_ID, MAX(ID) AS LATEST_ID
          FROM STUDY
          GROUP BY PROGRAM_ID) latest ON latest.PROGRAM_ID = p.ID
    JOIN STUDY s ON s.ID = latest.LATEST_ID
SET p.STUDY_KIND = s.STUDY_KIND;

-- 3. 기수가 하나도 없는 프로그램은 STUDY 로 둔다 (기본 종류)
UPDATE STUDY_PROGRAM
SET STUDY_KIND = 'STUDY'
WHERE STUDY_KIND IS NULL;

-- 4. 이제 비어 있을 수 없다
ALTER TABLE STUDY_PROGRAM
    MODIFY COLUMN STUDY_KIND VARCHAR(20) NOT NULL;

-- 5. 기수에서 제거
ALTER TABLE STUDY
    DROP COLUMN STUDY_KIND;
