package com.studyclub.notification;

/** {@code REFERENCE_ID} 하나의 알림을 상태별로 센 건수 — 공지별 메일 결과(대기·완료·실패)를 만드는 재료다. */
public record NotificationStatusCount(Long referenceId, NotificationStatus status, long count) {}
