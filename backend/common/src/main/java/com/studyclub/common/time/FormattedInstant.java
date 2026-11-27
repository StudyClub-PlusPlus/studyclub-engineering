package com.studyclub.common.time;

/**
 * 조회 기준 시간대로 서버가 포맷한 시각. 화면은 이 값을 그리고 다시 계산하지 않는다. specs/timezone/spec.md §3.3
 *
 * @param instant ISO-8601 UTC
 * @param abbreviation 해당 순간의 약칭. 지역 이름이 없으면 {@code null} — {@code offsetLabel} 을 쓴다
 * @param offsetLabel {@code UTC+09:00} 형태
 * @param dDay 마감 계열만. 조회 기준 달력의 마감 날짜 − 오늘. 마감 뒤 · 마감 아님은 {@code null}. 판정에 쓰지 않는다
 */
public record FormattedInstant(
        String instant,
        String displayTimeZone,
        String localDate,
        String localTime,
        boolean clock24,
        String abbreviation,
        String offsetLabel,
        Integer dDay) {}
