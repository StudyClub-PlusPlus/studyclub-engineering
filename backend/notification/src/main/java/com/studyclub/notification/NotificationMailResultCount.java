package com.studyclub.notification;

/**
 * 공지({@code REFERENCE_ID}) 하나에서 {@link NotificationMailResult} 별로 센 받는 사람 수 — 공지별 메일 결과(대기·완료·실패)의
 * 재료다.
 */
public record NotificationMailResultCount(
        Long referenceId, NotificationMailResult result, long count) {}
