package com.studyclub.notification;

/**
 * {@code NOTIFICATION} 행의 발송 상태 전이. PENDING → PROCESSING → SENT/FAILED, 재수거 시 PROCESSING → PENDING.
 *
 * <p>{@code CANCELLED} 는 {@code FAILED} 와 다르다 — {@code FAILED} 는 발송을 시도했다가 실패한 것({@code ERROR_TYPE}
 * 이 원인을 설명), {@code CANCELLED} 는 발송을 시도하기도 전에 더 이상 보낼 이유가 없어진 것이다(회원 탈퇴 —
 * specs/user-leave/spec.md). 자동/수동 재시도가 없으니 {@code PENDING} 에서만 전이한다.
 */
public enum NotificationStatus {
    PENDING,
    PROCESSING,
    SENT,
    FAILED,
    CANCELLED
}
