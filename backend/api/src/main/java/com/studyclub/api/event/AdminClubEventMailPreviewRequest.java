package com.studyclub.api.event;

/** 메일 미리보기 본문. 값 검사는 {@link ClubEventMailRequests}. */
public record AdminClubEventMailPreviewRequest(
        String type, String audience, String notice, String displayTimeZone) {}
