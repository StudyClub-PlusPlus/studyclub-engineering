package com.studyclub.notification;

/**
 * 알림을 유발한 이벤트 종류. 웰컴메일({@link #USER_REGISTERED})과 스터디 반 공지({@link #STUDY_NOTICE}) 둘이다 — 나머지(모집
 * 시작·마감임박·신청접수· 승인/거절·세션리마인드·출석경고)는 아직 코드에 없다 (specs/notification/spec.md,
 * specs/study-notice/spec.md).
 */
public enum NotificationEventType {
    USER_REGISTERED,
    /** 네비게이터가 반 팀원에게 보낸 공지 메일. {@code NOTIFICATION.REFERENCE_ID} 가 {@code STUDY_NOTICE.ID} 다. */
    STUDY_NOTICE
}
