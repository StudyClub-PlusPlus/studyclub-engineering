package com.studyclub.domain.audit;

/** 운영 감사 로그가 남기는 행위. 저장 값은 enum 이름 그대로 (ADMIN_AUDIT_LOG.ACTION). */
public enum AdminAuditAction {
    /** 백오피스 회원 목록에서 한 명의 이메일 원본을 봤다. BEFORE/AFTER 없음. */
    EMAIL_REVEAL,
    ANALYTICS_OPT_OUT,
    /** 백오피스 회원 목록에서 한 명의 디스코드 username을 봤다. BEFORE/AFTER 없음. */
    DISCORD_REVEAL,
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
    PARTICIPANT_ROLE,
    /**
     * 백오피스 신청자 탭에서 스터디의 담당 캡틴(STUDY.OWNER_CAPTAIN_ID)을 바꿨다 (specs/study-group/spec.md). TARGET 은 새
     * 담당 캡틴, BEFORE 에 옛 담당 캡틴 계정 ID(없었으면 null), AFTER 에 스터디 ID.
     */
    OWNER_CAPTAIN,
    /** 캡틴 계정 탈퇴에 따른 시스템 권한 말소. */
    ACCOUNT_ROLE_REVOKE,
    /** 활동 중인 네비게이터의 계정 탈퇴에 따른 참여 권한 말소. */
    PARTICIPANT_REVOKE,
    /**
     * 백오피스에서 행사를 취소했다 (specs/event-status/spec.md). 대상이 회원이 아니라 TARGET 은 비우고 CLUB_EVENT_ID 에 행사를
     * 둔다. BEFORE 에 취소 직전 저장 상태, AFTER 에 함께 취소된 신청 수.
     */
    EVENT_CANCEL
}
