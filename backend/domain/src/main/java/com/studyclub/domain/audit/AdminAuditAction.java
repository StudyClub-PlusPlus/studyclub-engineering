package com.studyclub.domain.audit;

/** 운영 감사 로그가 남기는 행위. 저장 값은 enum 이름 그대로 (ADMIN_AUDIT_LOG.ACTION). */
public enum AdminAuditAction {
    /** 백오피스 회원 목록에서 한 명의 이메일 원본을 봤다. BEFORE/AFTER 없음. */
    EMAIL_REVEAL,
    /** 계정 권한(SYSTEM_ROLE)이 실제로 바뀌었다. BEFORE/AFTER 에 변경 전후 값. */
    ROLE_CHANGE,
    /**
     * 출석부에서 참여를 중단시켰다 (specs/study-participant/spec.md). 행위자는 네비게이터일 수도 있다. BEFORE 에 중단 직전
     * 상태(ACTIVE·PAUSED), AFTER 에 중단된 명부 행 ID.
     */
    WITHDRAW,
    /**
     * 백오피스 신청자 탭에서 명부 행의 역할(네비게이터)을 바꿨다 (specs/study-group/spec.md). BEFORE 에 변경 전 역할, AFTER 에 명부 행
     * ID. 역할은 {@code LEADER} · {@code MEMBER} 둘뿐이라 변경 후 값은 BEFORE 의 반대다.
     */
    PARTICIPANT_ROLE
}
