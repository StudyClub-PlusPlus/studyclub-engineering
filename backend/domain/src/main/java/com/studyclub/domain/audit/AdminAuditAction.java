package com.studyclub.domain.audit;

/** 운영 감사 로그가 남기는 행위. 저장 값은 enum 이름 그대로 (ADMIN_AUDIT_LOG.ACTION). */
public enum AdminAuditAction {
    /** 백오피스 회원 목록에서 한 명의 이메일 원본을 봤다. BEFORE/AFTER 없음. */
    EMAIL_REVEAL,
    /** 계정 권한(SYSTEM_ROLE)이 실제로 바뀌었다. BEFORE/AFTER 에 변경 전후 값. */
    ROLE_CHANGE
}
