package com.studyclub.notification.mail;

import com.studyclub.notification.NotificationErrorType;

/**
 * {@link MailClient} 발송 실패. 호출자(스케줄러)가 {@link #errorType()} 으로 {@code Notification.markFailed} 를
 * 부른다.
 */
public class MailSendException extends RuntimeException {

    private final NotificationErrorType errorType;

    public MailSendException(NotificationErrorType errorType, String message, Throwable cause) {
        super(message, cause);
        this.errorType = errorType;
    }

    public NotificationErrorType errorType() {
        return errorType;
    }
}
