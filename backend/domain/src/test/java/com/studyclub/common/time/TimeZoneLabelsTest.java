package com.studyclub.common.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TimeZoneLabelsTest {

    @Test
    @DisplayName("모집 표기: 서울은 한국, LA 는 미국 · LA, 나머지는 나라 · 도시")
    void shortLabel() {
        assertThat(TimeZoneLabels.shortLabel("Asia/Seoul")).isEqualTo("한국");
        assertThat(TimeZoneLabels.shortLabel("America/Los_Angeles")).isEqualTo("미국 · LA");
        assertThat(TimeZoneLabels.shortLabel("America/Toronto")).isEqualTo("캐나다 · 토론토");
        assertThat(TimeZoneLabels.shortLabel("Europe/London")).isEqualTo("영국 · 런던");
    }

    @Test
    @DisplayName("표에 없는 ID 는 그대로")
    void unknownLabel() {
        assertThat(TimeZoneLabels.label("Antarctica/Unknown")).isEqualTo("Antarctica/Unknown");
    }

    @Test
    @DisplayName("순서: 한국 → 미국(뉴욕 · LA 먼저) → 캐나다(토론토 · 밴쿠버 먼저) → 오스트레일리아 → 영국 → 나머지")
    void displayOrder() {
        List<String> sorted =
                TimeZoneLabels.sorted(
                        List.of(
                                "Asia/Tokyo",
                                "Europe/London",
                                "America/Vancouver",
                                "America/Chicago",
                                "America/Los_Angeles",
                                "Australia/Sydney",
                                "America/Toronto",
                                "America/New_York",
                                "Asia/Seoul"));

        assertThat(sorted)
                .containsExactly(
                        "Asia/Seoul",
                        "America/New_York",
                        "America/Los_Angeles",
                        "America/Chicago",
                        "America/Toronto",
                        "America/Vancouver",
                        "Australia/Sydney",
                        "Europe/London",
                        "Asia/Tokyo");
    }
}
