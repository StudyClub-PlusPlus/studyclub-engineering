-- 유니크 키 이름을 uk_{테이블}_{컬럼} 규칙에 맞춘다 (database-guide). 제약 내용은 그대로다.
ALTER TABLE STUDY_NOTICE_RECIPIENT
    RENAME INDEX uk_study_notice_recipient TO uk_study_notice_recipient_notice_account;
