package com.studyclub.api.event;

/**
 * 메일 보내기 본문. {@code templateId} 는 미리보기에서 받은 값 — 있으면 지금 쓸 템플릿과 같아야 한다. 값 검사는 {@link
 * ClubEventMailRequests}.
 */
public record AdminClubEventMailSendRequest(
        String type, String audience, String notice, Long templateId, String displayTimeZone) {}
