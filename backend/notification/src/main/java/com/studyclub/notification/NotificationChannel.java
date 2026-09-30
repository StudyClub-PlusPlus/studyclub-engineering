package com.studyclub.notification;

/**
 * 발송 매체. {@code NOTIFICATION.RECIPIENT_TYPE} 과 {@code NOTIFICATION_TEMPLATE.CHANNEL} 두 컬럼이 이 enum
 * 하나를 공유한다 — 둘 다 "어느 매체로 보내는가"라는 같은 개념이라 별도 enum 을 두지 않는다.
 *
 * <p>이번 구현은 {@link #EMAIL} 하나뿐 — {@code DISCORD} 는 정의하지 않는다 (specs/notification/spec.md).
 */
public enum NotificationChannel {
    EMAIL
}
