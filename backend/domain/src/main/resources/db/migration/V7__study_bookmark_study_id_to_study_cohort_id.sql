-- STUDY_BOOKMARK.STUDY_ID → STUDY_COHORT_ID
-- 북마크 단위를 스터디에서 기수(STUDY_COHORT)로 변경한다.
--
-- 기존 행의 STUDY_ID 는 STUDY.ID 를 가리킨다.
-- 배포 전에 아래 순서로 기존 데이터를 변환한다:
--   1) 기수가 없는 스터디의 북마크 삭제 (고아 북마크 제거)
--   2) 기수가 하나인 스터디 → 해당 기수 ID 로 교체
--      기수가 여럿인 스터디 → 가장 최근 기수(MAX(ID)) 로 교체
--      (사용자는 최신 모집 기수를 북마크한 것으로 간주)
--   3) 컬럼 이름 변경 및 제약 조건 재설정

-- Step 1: 기수가 없는 스터디의 북마크 제거
DELETE sb
FROM STUDY_BOOKMARK sb
WHERE NOT EXISTS (
    SELECT 1 FROM STUDY_COHORT sc WHERE sc.STUDY_ID = sb.STUDY_ID
);

-- Step 2: STUDY_ID 값을 해당 스터디의 최신 STUDY_COHORT.ID 로 교체
UPDATE STUDY_BOOKMARK sb
    JOIN (
        SELECT STUDY_ID, MAX(ID) AS latest_cohort_id
        FROM STUDY_COHORT
        GROUP BY STUDY_ID
    ) latest ON sb.STUDY_ID = latest.STUDY_ID
SET sb.STUDY_ID = latest.latest_cohort_id;

-- Step 3: 컬럼 이름 변경
ALTER TABLE STUDY_BOOKMARK CHANGE COLUMN STUDY_ID STUDY_COHORT_ID BIGINT NOT NULL;

-- Step 4: 제약 조건 재설정
ALTER TABLE STUDY_BOOKMARK DROP INDEX uk_study_bookmark_account_study;
ALTER TABLE STUDY_BOOKMARK ADD CONSTRAINT uk_study_bookmark_account_cohort UNIQUE (ACCOUNT_ID, STUDY_COHORT_ID);

ALTER TABLE STUDY_BOOKMARK DROP INDEX idx_study_bookmark_study;
ALTER TABLE STUDY_BOOKMARK ADD INDEX idx_study_bookmark_cohort (STUDY_COHORT_ID);
