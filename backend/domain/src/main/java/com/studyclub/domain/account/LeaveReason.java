package com.studyclub.domain.account;

/** 회원 탈퇴 사유 — 집계용 정해진 값 셋. 자유 입력은 받지 않는다 (specs/user-leave/spec.md). */
public enum LeaveReason {
    NO_DESIRED_STUDY,
    PARTICIPATION_BURDEN,
    OTHER
}
