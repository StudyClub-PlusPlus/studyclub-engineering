-- V69 — 행사 메일의 템플릿 원문 스냅샷 (specs/event-mail/spec.md 「발송 내용 고정 (M6)」, docs/erd/NOTIFICATION.md)
-- 행사 여섯 조건의 행만 예약 때 템플릿 제목 · 본문 원문을 함께 저장한다. 예약 뒤 템플릿을 고치거나 지워도 그 내용으로 나가고 재발송도 같다.
-- 기존 행 · 기존 조건은 NULL 이고 지금처럼 TEMPLATE_ID 로 템플릿을 읽는다.
ALTER TABLE NOTIFICATION
    ADD COLUMN SUBJECT_TEMPLATE VARCHAR(255) NULL AFTER TEMPLATE_ID,
    ADD COLUMN BODY_TEMPLATE    TEXT         NULL AFTER SUBJECT_TEMPLATE;
