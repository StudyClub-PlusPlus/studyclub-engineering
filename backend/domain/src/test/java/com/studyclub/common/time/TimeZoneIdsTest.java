package com.studyclub.common.time;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class TimeZoneIdsTest {

    @ParameterizedTest
    @ValueSource(
            strings = {
                "Asia/Seoul",
                "Asia/Tokyo",
                "America/Los_Angeles",
                "America/Vancouver",
                "America/Toronto",
                "Europe/London",
                "Australia/Sydney",
                "America/Argentina/Buenos_Aires",
                "Asia/Kathmandu"
            })
    @DisplayName("지역 이름이 있는 IANA 는 그대로 받는다 — 네 개 화이트리스트가 아니다")
    void acceptsAnyRegion(String zone) {
        assertThat(TimeZoneIds.normalize(zone)).contains(zone);
    }

    @Test
    @DisplayName("서울과 도쿄는 같은 오프셋이어도 합치지 않는다")
    void sameOffsetStaysDistinct() {
        assertThat(TimeZoneIds.normalize("Asia/Tokyo")).contains("Asia/Tokyo");
        assertThat(TimeZoneIds.normalize("Asia/Seoul")).contains("Asia/Seoul");
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "+09:00",
                "-07:00",
                "Z",
                "UTC+09:00",
                "GMT+9",
                "UT+1",
                "Etc/GMT+7",
                "Etc/GMT-9",
                "SystemV/PST8",
                "SystemV/PST8PDT",
                "PST8PDT",
                "EST5EDT",
                "EST",
                "MST",
                "HST",
                "KST",
                "Mars/Olympus",
                "asia/seoul"
            })
    @DisplayName("오프셋만 있는 ID · 약칭 · 모르는 ID 는 거부한다")
    void rejectsOffsetsAndUnknown(String zone) {
        assertThat(TimeZoneIds.normalize(zone)).isEmpty();
        assertThat(TimeZoneIds.isValid(zone)).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    @DisplayName("빈 값은 무효")
    void rejectsBlank(String zone) {
        assertThat(TimeZoneIds.normalize(zone)).isEmpty();
    }

    @Test
    @DisplayName("64자를 넘으면 무효")
    void rejectsTooLong() {
        assertThat(TimeZoneIds.normalize("America/" + "x".repeat(60))).isEmpty();
    }

    @Test
    @DisplayName("deprecated 링크는 정본 ID 로 바꾼다")
    void normalizesLinks() {
        assertThat(TimeZoneIds.normalize("America/Indianapolis"))
                .contains("America/Indiana/Indianapolis");
        assertThat(TimeZoneIds.normalize("Asia/Chongqing")).contains("Asia/Shanghai");
        assertThat(TimeZoneIds.normalize("Europe/Belfast")).contains("Europe/London");
        assertThat(TimeZoneIds.normalize("US/Pacific")).contains("America/Los_Angeles");
        assertThat(TimeZoneIds.normalize("Canada/Pacific")).contains("America/Vancouver");
        assertThat(TimeZoneIds.normalize("ROK")).contains("Asia/Seoul");
        assertThat(TimeZoneIds.normalize("Asia/Calcutta")).contains("Asia/Kolkata");
        assertThat(TimeZoneIds.normalize("Europe/Kiev")).contains("Europe/Kyiv");
        assertThat(TimeZoneIds.normalize(" Asia/Seoul ")).contains("Asia/Seoul");
    }

    @Test
    @DisplayName("UTC 이름들은 UTC 하나로")
    void normalizesUtc() {
        assertThat(TimeZoneIds.normalize("UTC")).contains("UTC");
        assertThat(TimeZoneIds.normalize("Etc/UTC")).contains("UTC");
        assertThat(TimeZoneIds.normalize("GMT")).contains("UTC");
    }
}
