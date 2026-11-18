package com.studyclub.notification;

/**
 * 받는 사람 한 명이 한 공지에서 받은 메일의 결과 — 그 사람의 {@code NOTIFICATION} 행들(같은 조건의 템플릿이 여럿이면 여러 개)을 하나로 줄인 값이다.
 * 규칙은 {@link NotificationRepository#countRecipientsByMailResult} 의 SQL 이 정본이다: 하나라도 {@code FAILED}
 * 면 {@link #FAILED}, 아니면 하나라도 {@code PENDING}·{@code PROCESSING} 이면 {@link #PENDING}, 아니면 {@code
 * SENT} 가 있으면 {@link #SENT}. {@code CANCELLED} 만 있는 사람(탈퇴로 취소)은 어느 결과에도 세지 않는다.
 */
public enum NotificationMailResult {
    PENDING,
    SENT,
    FAILED
}
