package com.studyclub.notification;

/** 알림 조건. 각 이벤트의 템플릿으로 예약하고 같은 폴러가 발송한다 (specs/notification/spec.md). */
public enum NotificationEventType {
    USER_REGISTERED,
    /** 네비게이터가 반 팀원에게 보낸 공지 메일. {@code NOTIFICATION.REFERENCE_ID} 가 {@code STUDY_NOTICE.ID} 다. */
    STUDY_NOTICE,
    /** 첫 문의 회신 알림. REFERENCE_ID 는 FEEDBACK.ID 이고 답변 본문은 싣지 않는다. */
    FEEDBACK_REPLIED
}
