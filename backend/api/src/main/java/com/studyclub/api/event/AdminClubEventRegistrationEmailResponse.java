package com.studyclub.api.event;

/** 신청자 한 명의 이메일 원본. 응답은 캐시하지 않는다 (컨트롤러가 {@code no-store}). */
public record AdminClubEventRegistrationEmailResponse(
        Long registrationId, Long accountId, String email) {}
