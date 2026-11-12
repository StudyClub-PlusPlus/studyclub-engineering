-- V50 — 같은 조건에 알림 템플릿 여럿 (specs/notification/spec.md, PRD ST-030 완료 기준 5)
--   * NOTIFICATION_TEMPLATE 의 UNIQUE(EVENT_TYPE, CHANNEL) 을 걷어낸다. 같은 조건에 템플릿을 여럿 둘 수 있고, 그 조건이 생기면 모두 발송한다.
--     같은 조건·같은 제목도 막지 않는다 (운영 규칙: docs/share/2026-10-29-notification-template-ops-rules.md).
--   * 조건의 템플릿 목록을 읽는 조회(EVENT_TYPE, CHANNEL)는 일반 인덱스가 받는다.
--   * 기존 데이터는 그대로다. NOTIFICATION 은 건드리지 않는다.
--   * stage 는 Flyway 가 꺼져 있고 Hibernate(update)는 기존 제약을 지우지 않는다. 코드를 배포한 뒤 같은 내용을 손으로 한 번 실행한다
--     (제약 이름은 SHOW INDEX FROM NOTIFICATION_TEMPLATE 로 확인한다).
ALTER TABLE NOTIFICATION_TEMPLATE
    DROP INDEX uk_notification_template_event_channel,
    ADD INDEX idx_notification_template_event_channel (EVENT_TYPE, CHANNEL);
