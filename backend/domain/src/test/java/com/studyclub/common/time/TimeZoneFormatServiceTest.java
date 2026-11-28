package com.studyclub.common.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class TimeZoneFormatServiceTest {

    @Test
    @DisplayName("서울: 로컬 날짜 · 24시간제 · KST · UTC+09:00")
    void seoul() {
        FormattedInstant formatted =
                TimeZoneFormatService.format(Instant.parse("2026-09-15T14:59:59Z"), "Asia/Seoul");

        assertThat(formatted.instant()).isEqualTo("2026-09-15T14:59:59Z");
        assertThat(formatted.displayTimeZone()).isEqualTo("Asia/Seoul");
        assertThat(formatted.localDate()).isEqualTo("2026-09-15");
        assertThat(formatted.localTime()).isEqualTo("23:59");
        assertThat(formatted.clock24()).isTrue();
        assertThat(formatted.abbreviation()).isEqualTo("KST");
        assertThat(formatted.offsetLabel()).isEqualTo("UTC+09:00");
        assertThat(formatted.dDay()).isNull();
    }

    @Test
    @DisplayName("해당 날짜의 서머타임을 반영한다 — 토론토 EDT / EST, LA PDT / PST")
    void dstAbbreviation() {
        Instant summer = Instant.parse("2026-07-01T12:00:00Z");
        Instant winter = Instant.parse("2026-01-15T12:00:00Z");

        assertThat(TimeZoneFormatService.format(summer, "America/Toronto").abbreviation())
                .isEqualTo("EDT");
        assertThat(TimeZoneFormatService.format(winter, "America/Toronto").abbreviation())
                .isEqualTo("EST");
        assertThat(TimeZoneFormatService.format(summer, "America/Los_Angeles").abbreviation())
                .isEqualTo("PDT");
        assertThat(TimeZoneFormatService.format(winter, "America/Los_Angeles").offsetLabel())
                .isEqualTo("UTC-08:00");
    }

    @Test
    @DisplayName("약칭이 없는 지역은 null — offsetLabel 만 쓴다")
    void noAbbreviation() {
        FormattedInstant formatted =
                TimeZoneFormatService.format(Instant.parse("2026-07-01T12:00:00Z"), "Asia/Dubai");
        FormattedInstant utc =
                TimeZoneFormatService.format(Instant.parse("2026-07-01T12:00:00Z"), "UTC");

        assertThat(formatted.offsetLabel()).isEqualTo("UTC+04:00");
        assertThat(utc.offsetLabel()).isEqualTo("UTC+00:00");
        assertThat(utc.abbreviation()).isEqualTo("UTC");
    }

    @Test
    @DisplayName("null 순간은 null")
    void nullInstant() {
        assertThat(TimeZoneFormatService.format(null, "Asia/Seoul")).isNull();
        assertThat(TimeZoneFormatService.formatDeadline(null, "Asia/Seoul", Instant.now()))
                .isNull();
    }

    @Nested
    @DisplayName("밴쿠버 — 2026-03-08 10:00 UTC 뒤 연중 UTC-7 · PCT")
    class Vancouver {

        @Test
        @DisplayName("전환 직전은 TZDB 의 PST, 직후는 PCT · UTC-07:00")
        void cutover() {
            Instant before = TimeZoneRules.VANCOUVER_PERMANENT_TIME_START.minusSeconds(1);
            Instant after = TimeZoneRules.VANCOUVER_PERMANENT_TIME_START;

            FormattedInstant old = TimeZoneFormatService.format(before, "America/Vancouver");
            FormattedInstant permanent = TimeZoneFormatService.format(after, "America/Vancouver");

            assertThat(old.abbreviation()).isEqualTo("PST");
            assertThat(old.offsetLabel()).isEqualTo("UTC-08:00");
            assertThat(permanent.abbreviation()).isEqualTo("PCT");
            assertThat(permanent.offsetLabel()).isEqualTo("UTC-07:00");
        }

        @Test
        @DisplayName("2026-11-05 LA 19:00 PST 는 밴쿠버 회원에게 20:00 PCT")
        void novemberDiffersFromLosAngeles() {
            Instant meeting = Instant.parse("2026-11-06T03:00:00Z");

            FormattedInstant la = TimeZoneFormatService.format(meeting, "America/Los_Angeles");
            FormattedInstant vancouver = TimeZoneFormatService.format(meeting, "America/Vancouver");

            assertThat(la.localDate()).isEqualTo("2026-11-05");
            assertThat(la.localTime()).isEqualTo("19:00");
            assertThat(la.abbreviation()).isEqualTo("PST");
            assertThat(vancouver.localDate()).isEqualTo("2026-11-05");
            assertThat(vancouver.localTime()).isEqualTo("20:00");
            assertThat(vancouver.abbreviation()).isEqualTo("PCT");
            assertThat(vancouver.offsetLabel()).isEqualTo("UTC-07:00");
        }

        @Test
        @DisplayName("11월 날짜 입력의 23:59:59 도 UTC-7 로 환산한다")
        void endOfDayUsesPermanentOffset() {
            assertThat(
                            TimeZoneFormatService.endOfDay(
                                    LocalDate.of(2026, 11, 20), "America/Vancouver"))
                    .isEqualTo(Instant.parse("2026-11-21T06:59:59Z"));
            assertThat(
                            TimeZoneFormatService.endOfDay(
                                    LocalDate.of(2025, 11, 20), "America/Vancouver"))
                    .isEqualTo(Instant.parse("2025-11-21T07:59:59Z"));
        }
    }

    @Nested
    @DisplayName("마감 dDay")
    class Deadline {

        private final Instant deadline = Instant.parse("2026-09-16T03:59:59Z");

        @Test
        @DisplayName("같은 UTC 마감이라도 지역 달력에 따라 dDay 가 다르다")
        void dDayPerZone() {
            Instant now = Instant.parse("2026-09-15T12:00:00Z");

            FormattedInstant seoul =
                    TimeZoneFormatService.formatDeadline(deadline, "Asia/Seoul", now);
            FormattedInstant la =
                    TimeZoneFormatService.formatDeadline(deadline, "America/Los_Angeles", now);

            assertThat(seoul.localDate()).isEqualTo("2026-09-16");
            assertThat(seoul.dDay()).isEqualTo(1);
            assertThat(la.localDate()).isEqualTo("2026-09-15");
            assertThat(la.dDay()).isEqualTo(0);
            assertThat(
                            TimeZoneFormatService.formatDeadline(
                                            deadline,
                                            "Asia/Seoul",
                                            Instant.parse("2026-09-14T12:00:00Z"))
                                    .dDay())
                    .isEqualTo(2);
            assertThat(
                            TimeZoneFormatService.formatDeadline(
                                            deadline,
                                            "America/Los_Angeles",
                                            Instant.parse("2026-09-14T12:00:00Z"))
                                    .dDay())
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("마감 순간부터는 dDay 가 null — 1ms 전까지만 채운다")
        void closedHasNoDDay() {
            assertThat(
                            TimeZoneFormatService.formatDeadline(
                                            deadline, "Asia/Seoul", deadline.minusMillis(1))
                                    .dDay())
                    .isEqualTo(0);
            assertThat(
                            TimeZoneFormatService.formatDeadline(deadline, "Asia/Seoul", deadline)
                                    .dDay())
                    .isNull();
        }

        @Test
        @DisplayName("날짜 입력은 그 지역 23:59:59, 시작일은 00:00:00")
        void dateInput() {
            LocalDate date = LocalDate.of(2026, 9, 16);

            assertThat(TimeZoneFormatService.endOfDay(date, "Asia/Seoul"))
                    .isEqualTo(Instant.parse("2026-09-16T14:59:59Z"));
            assertThat(TimeZoneFormatService.endOfDay(date, "America/Toronto"))
                    .isEqualTo(Instant.parse("2026-09-17T03:59:59Z"));
            assertThat(TimeZoneFormatService.startOfDay(date, "America/Los_Angeles"))
                    .isEqualTo(Instant.parse("2026-09-16T07:00:00Z"));
        }
    }
}
