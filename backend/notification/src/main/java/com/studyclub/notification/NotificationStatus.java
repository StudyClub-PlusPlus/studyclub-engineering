package com.studyclub.notification;

/**
 * {@code NOTIFICATION} 행의 발송 상태 전이. PENDING → PROCESSING → SENT/FAILED, 재수거 시 PROCESSING → PENDING.
 */
public enum NotificationStatus {
    PENDING,
    PROCESSING,
    SENT,
    FAILED
}
