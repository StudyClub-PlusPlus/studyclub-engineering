package com.studyclub.domain.event.registration;

import com.studyclub.common.error.ErrorCode;

/**
 * 지금 신청할 수 없는 이유 — 상세의 {@code applyBlockedReason} 과 신청 제출의 거절이 같은 값을 쓴다 (specs/event-registration
 * 「신청할 수 있나」). 선언 순서가 판정 순서다.
 */
public enum ApplyBlockedReason {
    LOGIN_REQUIRED(ErrorCode.UNAUTHORIZED),
    ONBOARDING_REQUIRED(ErrorCode.ONBOARDING_REQUIRED),
    EVENT_CANCELLED(ErrorCode.EVENT_CANCELLED),
    EVENT_ENDED(ErrorCode.EVENT_ENDED),
    RECRUITMENT_CLOSED(ErrorCode.EVENT_REGISTRATION_CLOSED),
    ACCOUNT_EMAIL_INVALID(ErrorCode.EVENT_APPLICANT_EMAIL_INVALID),
    ALREADY_REGISTERED(ErrorCode.EVENT_ALREADY_REGISTERED),
    DECLINED_BEFORE(ErrorCode.EVENT_REGISTRATION_DECLINED),
    /** 모든 참여 방식이 찼다. 신청 제출은 고른 방식만 보고 {@code EVENT_CHANNEL_FULL} 로 거절한다. */
    FULL(ErrorCode.EVENT_CHANNEL_FULL);

    private final ErrorCode errorCode;

    ApplyBlockedReason(ErrorCode errorCode) {
        this.errorCode = errorCode;
    }

    /** 신청 제출이 이 이유로 거절할 때의 오류 코드. */
    public ErrorCode errorCode() {
        return errorCode;
    }
}
