package com.studyclub.notification.webpush;

import com.studyclub.notification.NotificationErrorType;

/** 웹 푸시 발송 실패. 스케줄러가 {@link #errorType()} 으로 그 행을 FAILED 로 남긴다. */
public class WebPushSendException extends RuntimeException {

    private final NotificationErrorType errorType;

    public WebPushSendException(NotificationErrorType errorType, String message) {
        super(message);
        this.errorType = errorType;
    }

    public NotificationErrorType errorType() {
        return errorType;
    }
}
