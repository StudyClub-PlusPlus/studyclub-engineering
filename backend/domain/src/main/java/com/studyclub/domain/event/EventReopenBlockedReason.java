package com.studyclub.domain.event;

/** 모집 마감한 행사를 다시 열 수 없는 이유 — 운영 상세의 {@code reopenBlockedReason} (specs/event-status). */
public enum EventReopenBlockedReason {
    /** 행사가 시작했다. 시작 시각은 미래로 옮길 수 없어 다시 열 길이 없다. */
    STARTED,
    /** 신청 마감 시각이 지났다. 행사 수정으로 마감을 미래로 옮기면 다시 열 수 있다. */
    DEADLINE_PASSED
}
