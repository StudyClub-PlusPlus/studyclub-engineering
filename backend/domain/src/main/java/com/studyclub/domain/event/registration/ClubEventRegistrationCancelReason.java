package com.studyclub.domain.event.registration;

/**
 * 신청 취소의 이유 — {@link ClubEventRegistrationStatus#CANCELLED} 일 때만 값이 있다. 취소 안내 메일 대상(행사 취소) · 재신청 가능
 * 여부 · 분석 {@code cancel_type} 을 이 값으로 나눈다. 운영자가 입력하는 자유 사유는 없다 (event-participant P6).
 */
public enum ClubEventRegistrationCancelReason {
    /** 크루 본인 취소 (event-registration). */
    SELF_CANCELLED,
    /** 운영진 개별 취소 (event-participant). */
    ADMIN_CANCELLED,
    /** 회원 탈퇴 — 종료 전 행사의 유효 신청을 정리한다. 메일 · 도메인 이벤트 없음 (P3). */
    ACCOUNT_DELETED,
    /** 행사 취소 — 취소 안내 메일 대상 (event-status). */
    EVENT_CANCELLED
}
