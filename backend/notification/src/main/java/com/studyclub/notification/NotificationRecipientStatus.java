package com.studyclub.notification;

/**
 * 공지({@code REFERENCE_ID}) 하나에서 받는 사람 한 명이 가진 메일 행의 상태 하나 — 공지별 메일 결과(대기·완료·실패)를 받는 사람 수 기준으로 세는
 * 재료다. 같은 조건의 템플릿이 여럿이면 한 사람에게 행이 여러 개라, 행 수로 세면 템플릿 수만큼 부풀기 때문이다.
 */
public record NotificationRecipientStatus(
        Long referenceId, Long recipientUserId, NotificationStatus status) {}
