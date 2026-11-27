package com.studyclub.domain.event.mail;

/** 지금 운영자 메일을 보낼 수 없는 첫 이유 ({@link ClubEventMail#sendBlock}). 미리보기의 {@code blockedReason} 이다. */
public enum MailBlockedReason {
    EVENT_CANCELLED,
    EVENT_NOT_CANCELLED,
    TEMPLATE_MISSING,
    NO_RECIPIENTS,
    NOTICE_REQUIRED
}
