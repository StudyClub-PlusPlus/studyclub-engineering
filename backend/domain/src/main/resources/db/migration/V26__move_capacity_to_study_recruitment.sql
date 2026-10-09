-- V26 — CAPACITY 를 STUDY → STUDY_RECRUITMENT 으로 이전
--
-- STUDY_RECRUITMENT.RECRUITMENT_CAPACITY 는 V12 에서 이미 존재한다.
-- 정원은 모집 회차의 속성이다(docs/erd/STUDY_RECRUITMENT.md) —
-- 같은 기수의 1차·2차 추가 모집이 서로 다른 정원을 가질 수 있다.
--
-- 기존 STUDY.CAPACITY 값을 최신 모집 회차로 백필한 뒤 컬럼을 제거한다.

-- 1. 백필 — 각 기수의 최신 모집 회차에 STUDY.CAPACITY 값을 그대로 복사한다.
--    NULL(무제한)도 복사한다 — 지금까지 판정은 STUDY.CAPACITY 만 봤으므로, 모집 회차에
--    따로 들어 있던 값이 이관 후 갑자기 정원으로 걸리면 기존 동작이 바뀐다.
UPDATE STUDY_RECRUITMENT sr
    JOIN (SELECT STUDY_ID, MAX(ID) AS LATEST_ID
          FROM STUDY_RECRUITMENT
          GROUP BY STUDY_ID) latest ON sr.ID = latest.LATEST_ID
    JOIN STUDY s ON s.ID = sr.STUDY_ID
SET sr.RECRUITMENT_CAPACITY = s.CAPACITY;

-- 2. STUDY 에서 CAPACITY 컬럼 제거
ALTER TABLE STUDY
    DROP COLUMN CAPACITY;
