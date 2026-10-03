package com.studyclub.domain.participant;

public enum ParticipantStatus {
    ACTIVE,
    PAUSED,
    WITHDRAWN,
    COMPLETED,
    /** 참여자 본인이 회원 탈퇴해 사라진 명부 행 — WITHDRAWN(중도 하차)과 달리 본인 요청이 아니라 계정 자체가 없어진 결과다. */
    DELETED
}
