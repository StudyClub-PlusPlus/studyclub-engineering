-- V49 — STUDY_RECRUITMENT.START_AT 을 NULL 허용으로. 모집 시작 시각은 공개(= 모집 시작)할 때 채우고, 등록 시점과 공개 취소 뒤에는 비운다.
-- 지금까지는 NOT NULL 이라 등록이 now() 를 채웠고, 그래서 공개 전(DRAFT) 스터디의 신청 폼 저장이
-- 「모집이 시작되어 신청 폼을 수정할 수 없습니다」로 막혔다 (specs/study 스터디 공개 · TODO(migration)).
ALTER TABLE STUDY_RECRUITMENT
    MODIFY COLUMN START_AT DATETIME NULL;

-- 공개 전(DRAFT) 스터디는 모집을 시작하지 않은 상태다 — 등록 때 채운 시각을 비운다.
-- 공개했다 취소한 스터디도 여기 들어간다. 이미 신청서가 있으면 신청 폼은 그 신청서로 계속 잠긴다.
UPDATE STUDY_RECRUITMENT r
    JOIN STUDY s ON s.ID = r.STUDY_ID
SET r.START_AT = NULL
WHERE s.STATUS = 'DRAFT';
