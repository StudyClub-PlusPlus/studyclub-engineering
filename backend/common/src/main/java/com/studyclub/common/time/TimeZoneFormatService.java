package com.studyclub.common.time;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

/** 서버 포맷 시각과 날짜 입력 환산. 모든 응답의 {@link FormattedInstant} 는 여기서 만든다. specs/timezone/spec.md §3.3 */
public final class TimeZoneFormatService {

    private static final DateTimeFormatter LOCAL_TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final LocalTime END_OF_DAY = LocalTime.of(23, 59, 59);

    private TimeZoneFormatService() {}

    /**
     * @param zone {@link TimeZoneIds#normalize} 를 거친 ID
     * @return {@code instant} 가 {@code null} 이면 {@code null}
     */
    public static FormattedInstant format(Instant instant, String zone) {
        return instant == null ? null : build(instant, zone, null);
    }

    /** 마감 시각. {@code now} 가 마감 전일 때만 {@code dDay} 를 채운다 — 마감 판정과 같은 {@code now < deadline}. */
    public static FormattedInstant formatDeadline(Instant deadline, String zone, Instant now) {
        if (deadline == null) {
            return null;
        }
        Integer dDay = null;
        if (now.isBefore(deadline)) {
            dDay = (int) ChronoUnit.DAYS.between(localDate(now, zone), localDate(deadline, zone));
        }
        return build(deadline, zone, dDay);
    }

    /** 날짜 칸으로 받은 마감 — 그 지역 달력의 23:59:59 (PRD §6). */
    public static Instant endOfDay(LocalDate date, String zone) {
        return toInstant(date.atTime(END_OF_DAY), zone);
    }

    /** 날짜 칸으로 받은 시작일 — 그 지역 달력의 00:00:00. */
    public static Instant startOfDay(LocalDate date, String zone) {
        return toInstant(date.atStartOfDay(), zone);
    }

    public static LocalDate localDate(Instant instant, String zone) {
        return ZonedDateTime.ofInstant(instant, TimeZoneRules.zoneAt(zone, instant)).toLocalDate();
    }

    public static String offsetLabel(ZoneOffset offset) {
        String id = offset.getTotalSeconds() == 0 ? "+00:00" : offset.getId();
        return "UTC" + id;
    }

    private static Instant toInstant(LocalDateTime local, String zone) {
        if (TimeZoneIds.VANCOUVER.equals(zone)) {
            Instant permanent = local.toInstant(ZoneOffset.ofHours(-7));
            if (TimeZoneRules.usesVancouverPacificTime(zone, permanent)) {
                return permanent;
            }
        }
        return local.atZone(ZoneId.of(zone)).toInstant();
    }

    private static FormattedInstant build(Instant instant, String zone, Integer dDay) {
        ZonedDateTime local = ZonedDateTime.ofInstant(instant, TimeZoneRules.zoneAt(zone, instant));
        return new FormattedInstant(
                instant.toString(),
                zone,
                local.toLocalDate().toString(),
                LOCAL_TIME.format(local),
                true,
                TimeZoneRules.abbreviation(zone, instant),
                offsetLabel(local.getOffset()),
                dDay);
    }
}
