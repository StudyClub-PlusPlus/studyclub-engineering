-- V28 — STUDY.SLUG 컬럼 제거
--
-- URL 식별자로 SLUG 를 두지 않는다(docs/erd/STUDY.md) — 주소에는 STUDY.ID 를 쓴다.
-- SLUG 는 UUID 라 사람이 읽을 수 없고, 이름을 바꾸면 주소가 깨지는 문제도 있다.

ALTER TABLE STUDY
    DROP INDEX uk_study_slug,
    DROP COLUMN SLUG;
