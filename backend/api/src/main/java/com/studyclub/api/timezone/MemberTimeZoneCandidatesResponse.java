package com.studyclub.api.timezone;

import java.time.Instant;
import java.util.List;

/** GET /api/admin/member-time-zones — specs/timezone/spec.md §6 */
public record MemberTimeZoneCandidatesResponse(Instant asOf, List<Item> items) {

    public record Item(String timeZone, long memberCount) {}
}
