package com.studyclub.api.event;

import com.studyclub.domain.event.EventDisplayStatus;
import com.studyclub.domain.event.EventStatus;
import java.time.Instant;
import java.util.List;

/** 운영 행사 목록 한 페이지 — 행에는 행사명 · 일정 · 표시 상태만 (§1-1). */
public record AdminClubEventListResponse(List<Item> items, long total, int offset, int limit) {

    public record Item(
            Long eventId,
            String title,
            Instant startsAt,
            Instant endsAt,
            Instant effectiveEndsAt,
            String timeZone,
            EventStatus status,
            EventDisplayStatus displayStatus) {}
}
