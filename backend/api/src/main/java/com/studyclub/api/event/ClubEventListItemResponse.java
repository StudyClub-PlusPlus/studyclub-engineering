package com.studyclub.api.event;

import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventDisplayStatus;
import com.studyclub.domain.event.EventFormat;
import com.studyclub.domain.event.EventListGroup;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.time.Instant;

/** 사이트 행사 목록 한 줄 (specs/event-registration 「행사 목록」). */
public record ClubEventListItemResponse(
        Long eventId,
        String title,
        String summary,
        Instant startsAt,
        Instant endsAt,
        Instant effectiveEndsAt,
        String timeZone,
        EventFormat format,
        EventDisplayStatus displayStatus,
        EventListGroup listGroup,
        MyRegistration myRegistration) {

    /** 이 행사의 내 최신 신청. 비로그인 · 온보딩 전 · 신청 없음이면 null. */
    public record MyRegistration(ClubEventRegistrationStatus status, EventChannel channel) {}
}
