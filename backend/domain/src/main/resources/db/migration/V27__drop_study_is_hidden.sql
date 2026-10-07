-- V27 — STUDY.IS_HIDDEN 컬럼 제거
--
-- 공개 여부는 STATUS != DRAFT 하나로 판정한다(docs/erd/STUDY.md#공개-여부).
-- IS_HIDDEN 은 별도 플래그를 두지 않는다는 방향과 어긋나 폐기한다.
-- 실제로 IS_HIDDEN = true 인 행은 없었으므로 데이터 손실이 없다.

ALTER TABLE STUDY
    DROP COLUMN IS_HIDDEN;
