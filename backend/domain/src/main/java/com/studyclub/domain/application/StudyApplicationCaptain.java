package com.studyclub.domain.application;

/** 신청 알림의 재발송 수신자 판정 재료. ADMIN 이 아닌 담당자는 captainId 가 null 이다. */
public record StudyApplicationCaptain(Long applicationId, Long studyId, Long captainId) {}
