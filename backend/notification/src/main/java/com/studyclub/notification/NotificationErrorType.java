package com.studyclub.notification;

/**
 * {@code FAILED} 상태일 때의 실패 분류. 이번 구현엔 자동 재시도가 없어 재시도 가능 여부 판단에는 쓰지 않는다 — 실패 원인을 나중에 사람이 보기 위한 값이다
 * (specs/notification/spec.md).
 */
public enum NotificationErrorType {
    TEMPLATE_MISSING,
    INVALID_RECIPIENT,
    PROVIDER_ERROR,
    UNKNOWN
}
