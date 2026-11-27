package com.studyclub.api.study;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.studyclub.common.time.TimeZoneFormatService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * 마감 · 시작일 입력. ISO-8601 순간({@code 2026-09-16T14:59:59Z})은 그대로, 날짜만({@code 2026-09-16}) 보내면 요청의 표시
 * 시간대 달력으로 해석한다 — 마감은 23:59:59, 시작은 00:00:00 (PRD §6 · specs/timezone/spec.md §7).
 */
public record StudyDateInput(Instant instant, LocalDate date) {

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static StudyDateInput parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        try {
            return trimmed.length() == 10
                    ? new StudyDateInput(null, LocalDate.parse(trimmed))
                    : new StudyDateInput(Instant.parse(trimmed), null);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("날짜(YYYY-MM-DD) 또는 ISO-8601 시각이어야 합니다.", e);
        }
    }

    public static StudyDateInput of(Instant instant) {
        return instant == null ? null : new StudyDateInput(instant, null);
    }

    public Instant toDeadline(String displayTimeZone) {
        return instant != null ? instant : TimeZoneFormatService.endOfDay(date, displayTimeZone);
    }

    public Instant toStart(String displayTimeZone) {
        return instant != null ? instant : TimeZoneFormatService.startOfDay(date, displayTimeZone);
    }

    @JsonValue
    public String value() {
        return instant != null ? instant.toString() : date.toString();
    }
}
