-- 기존 테스트 행은 앱의 RetentionBackfillService가 원래 기준일로 V1을 채운다.
-- stage(Hibernate update)와 Flyway 환경이 같은 초기화 규칙을 사용한다.
-- 역할 미상 WITHDRAW는 규칙만 저장하고 EXPIRES_AT=NULL로 보류한다.
ALTER TABLE FEEDBACK
    ADD COLUMN RETENTION_POLICY VARCHAR(40) NULL,
    ADD COLUMN EXPIRES_AT DATETIME(6) NULL,
    ADD INDEX idx_feedback_expiry (EXPIRES_AT, ID);

ALTER TABLE ADMIN_AUDIT_LOG
    ADD COLUMN RETENTION_POLICY VARCHAR(40) NULL,
    ADD COLUMN EXPIRES_AT DATETIME(6) NULL,
    ADD INDEX idx_admin_audit_log_expiry (EXPIRES_AT, ID);
