package com.studyclub.notification;

/**
 * 알림을 유발한 이벤트 종류. 이번 구현은 {@link #USER_REGISTERED} 하나뿐 — 나머지(모집 시작·마감임박·신청접수·승인/거절·세션리마인드·출석경고)는 아직
 * 코드에 없다 (specs/notification/spec.md).
 */
public enum NotificationEventType {
    USER_REGISTERED
}
