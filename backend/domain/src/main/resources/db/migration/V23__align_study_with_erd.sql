-- V23 — STUDY 를 docs/erd/STUDY.md 에 맞춘다
--
-- 세 컬럼을 걷어낸다. 전부 문서에 없는 컬럼이고, 둘은 판정 로직이 잘못된 근거로 쓰고 있었다.
--   CAPACITY   → 정원은 모집 회차 소관이다 (STUDY_RECRUITMENT.RECRUITMENT_CAPACITY)
--   IS_HIDDEN  → 공개 여부는 STATUS != DRAFT 하나로 정한다 (별도 플래그를 두지 않는다)
--   PUBLISH_AT → 예약 공개가 없다. 공개는 캡틴이 모집을 시작하는 순간이다
--
-- SLUG · STUDY_KIND · STUDY_DELIVERY_FORMAT 도 문서와 어긋나지만, 응답·프론트가 읽고 있어 여기서 건드리지
-- 않는다 — docs/erd/STUDY.md 「구현 현황」.

-- 1. 정원을 모집 회차로 옮긴다.
--    회차가 여럿이면 가장 최근(ID 최대) 회차가 현재 정원이다 — 모집 상태를 계산할 때 읽는 회차와 같은 행이어야 한다.
--    최신 회차를 파생 테이블로 JOIN 한다: UPDATE 대상 테이블을 상관 서브쿼리로 다시 읽지 않으려는 것이다.
UPDATE STUDY_RECRUITMENT r
    JOIN STUDY s ON s.ID = r.STUDY_ID
    JOIN (SELECT STUDY_ID, MAX(ID) AS LATEST_ID
          FROM STUDY_RECRUITMENT
          GROUP BY STUDY_ID) latest ON latest.LATEST_ID = r.ID
SET r.RECRUITMENT_CAPACITY = s.CAPACITY
WHERE s.CAPACITY IS NOT NULL
  AND r.RECRUITMENT_CAPACITY IS NULL;

-- 2. 옮긴 컬럼과 폐기 컬럼 제거
ALTER TABLE STUDY
    DROP COLUMN CAPACITY,
    DROP COLUMN IS_HIDDEN,
    DROP COLUMN PUBLISH_AT;
