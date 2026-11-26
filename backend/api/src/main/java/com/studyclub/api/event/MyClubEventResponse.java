package com.studyclub.api.event;

import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.time.Instant;

/** 마이페이지 「내 행사」 한 줄 — 행사별 내 최신 신청 (specs/event-registration 「내 행사」). */
public record MyClubEventResponse(
        Long eventId, String title, Instant startsAt, String timeZone, Registration registration) {

    public record Registration(
            Long registrationId,
            ClubEventRegistrationStatus status,
            EventChannel channel,
            Instant createdAt) {}
}
