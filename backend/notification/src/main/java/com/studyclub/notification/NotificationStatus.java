package com.studyclub.notification;

import java.util.Collection;
import java.util.Optional;

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
    CANCELLED;

    /**
     * 받는 사람 한 명의 메일 행들(같은 조건의 템플릿이 여럿이면 여러 개)을 <b>대표 상태 하나</b>로 줄인다. 하나라도 {@code FAILED} 면 {@code
     * FAILED}, 아니면 하나라도 {@code PENDING}·{@code PROCESSING} 이면 {@code PENDING}, 아니면 {@code SENT} 가
     * 있으면 {@code SENT}. {@code CANCELLED} 만 있으면(탈퇴로 취소) 센 값이 없다.
     */
    public static Optional<NotificationStatus> representative(
            Collection<NotificationStatus> statuses) {
        if (statuses.contains(FAILED)) {
            return Optional.of(FAILED);
        }
        if (statuses.contains(PENDING) || statuses.contains(PROCESSING)) {
            return Optional.of(PENDING);
        }
        if (statuses.contains(SENT)) {
            return Optional.of(SENT);
        }
        return Optional.empty();
    }
}
