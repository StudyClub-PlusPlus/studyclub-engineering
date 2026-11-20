package com.studyclub.domain.event.registration;

/**
 * 본인 취소를 할 수 없는 이유 — 상세 · 내 신청서의 {@code cancelBlockedReason} (specs/event-registration 「본인 취소할 수
 * 있나」).
 */
public enum SelfCancelBlockedReason {
    /** 확인 대기 · 참가 확정이 아니다 (참가 불가 · 이미 취소 · 행사 취소로 취소됨). */
    NOT_ACTIVE,
    /** 신청 마감 시각이 지났다. 모집 수동 마감은 막지 않는다 (S3). */
    DEADLINE_PASSED
}
