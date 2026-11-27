package com.studyclub.notification;

import java.util.EnumSet;
import java.util.Set;

/** 알림 조건. 각 이벤트의 템플릿으로 예약하고 같은 폴러가 발송한다 (specs/notification/spec.md). */
public enum NotificationEventType {
    USER_REGISTERED,
    /** 네비게이터가 반 팀원에게 보낸 공지 메일. {@code NOTIFICATION.REFERENCE_ID} 가 {@code STUDY_NOTICE.ID} 다. */
    STUDY_NOTICE,
    /** 첫 문의 회신 알림. REFERENCE_ID 는 FEEDBACK.ID 이고 답변 본문은 싣지 않는다. */
    FEEDBACK_REPLIED,
    /** 캡틴의 행사 안내 메일. REFERENCE_ID 는 {@code EVENT_MAIL.ID}. */
    EVENT_ANNOUNCEMENT,
    /** 캡틴의 행사 취소 안내 메일. REFERENCE_ID 는 {@code EVENT_MAIL.ID}. */
    EVENT_CANCELLATION,
    /** 행사 신청 접수(확인 대기). 이하 자동 메일 넷의 REFERENCE_ID 는 {@code CLUB_EVENT_REGISTRATION.ID}. */
    EVENT_REGISTRATION_PENDING,
    EVENT_REGISTRATION_CONFIRMED,
    EVENT_REGISTRATION_DECLINED,
    EVENT_REGISTRATION_CANCELLED;

    private static final Set<NotificationEventType> CLUB_EVENT =
            EnumSet.of(
                    EVENT_ANNOUNCEMENT,
                    EVENT_CANCELLATION,
                    EVENT_REGISTRATION_PENDING,
                    EVENT_REGISTRATION_CONFIRMED,
                    EVENT_REGISTRATION_DECLINED,
                    EVENT_REGISTRATION_CANCELLED);

    /**
     * 행사 여섯 조건 — 가장 작은 ID 템플릿 한 건만 쓰고(M1), 예약 때 템플릿 원문을 함께 저장하고(M6), HTML 값의 줄바꿈을 {@code <br>} 로
     * 바꾸고, 재발송 때 현재 행사 · 신청 상태를 본다.
     */
    public boolean isClubEvent() {
        return CLUB_EVENT.contains(this);
    }
}
