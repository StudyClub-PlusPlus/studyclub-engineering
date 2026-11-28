package com.studyclub.common.time;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * 포맷 경계에서 적용하는 지역 규칙 — 밴쿠버 영구 서머타임과 약칭. 저장하는 ID 는 바꾸지 않는다.
 *
 * <p>정본은 Playground {@code proto/core/lib/time-zone-rules.ts} 와 POL-0006 이다. 한쪽을 고치면 다른 쪽도 고친다.
 */
public final class TimeZoneRules {

    /**
     * B.C. 는 2026-03-08 10:00 UTC 마지막 서머타임 전환 뒤 연중 UTC−7 이다. 이 규칙을 모르는 tzdata 는 11월에 UTC−8 로 되돌린다.
     * B.C. 가 시간 기준을 다시 바꾸면 이 값을 고친다.
     */
    public static final Instant VANCOUVER_PERMANENT_TIME_START =
            Instant.parse("2026-03-08T10:00:00Z");

    private static final ZoneOffset VANCOUVER_PERMANENT_OFFSET = ZoneOffset.ofHours(-7);
    private static final String VANCOUVER_PERMANENT_ABBREVIATION = "PCT";
    private static final DateTimeFormatter SHORT_NAME =
            DateTimeFormatter.ofPattern("zzz", Locale.ENGLISH);

    private TimeZoneRules() {}

    public static boolean usesVancouverPacificTime(String zone, Instant at) {
        return TimeZoneIds.VANCOUVER.equals(zone) && !at.isBefore(VANCOUVER_PERMANENT_TIME_START);
    }

    /** {@code at} 순간을 그 지역 달력으로 읽을 때 쓰는 규칙. */
    public static ZoneId zoneAt(String zone, Instant at) {
        return usesVancouverPacificTime(zone, at) ? VANCOUVER_PERMANENT_OFFSET : ZoneId.of(zone);
    }

    /** 해당 순간의 약칭. 지역 이름이 없어 {@code GMT+03:00} 처럼 오프셋만 나오면 {@code null}. */
    public static String abbreviation(String zone, Instant at) {
        if (usesVancouverPacificTime(zone, at)) {
            return VANCOUVER_PERMANENT_ABBREVIATION;
        }
        String name = SHORT_NAME.format(ZonedDateTime.ofInstant(at, ZoneId.of(zone)));
        if (name.startsWith("GMT+")
                || name.startsWith("GMT-")
                || name.startsWith("UTC+")
                || name.startsWith("UTC-")
                || name.startsWith("+")
                || name.startsWith("-")) {
            return null;
        }
        return name;
    }
}
