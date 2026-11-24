package com.studyclub.domain.event.registration;

import com.studyclub.domain.event.EventChannel;

/**
 * 행사 · 방식 · 상태별 신청 수 한 줄 — {@link ClubEventRegistrationRepository#countGroupedByEvent} 의 GROUP BY
 * 결과.
 */
public record RegistrationSeatCount(
        Long clubEventId, EventChannel channel, ClubEventRegistrationStatus status, long count) {}
