package com.studyclub.api.stats;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.stats.AdminStatsResponses.TimeZoneBreakdown;
import com.studyclub.api.stats.AdminStatsResponses.TimeZoneGroup;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** specs/dashboard/spec.md §4.5 확장 개정안 · specs/timezone/spec.md §10 의 세 갈래. */
class CrewTimeZoneDistributionTest {

    @Test
    @DisplayName("합계 5 이하 — 지역 4 + unset 이면 다섯 칸 그대로, other 없음")
    void fiveOrFewerShowsAll() {
        List<String> crew =
                crew(
                        "Asia/Seoul", 4,
                        "America/Los_Angeles", 3,
                        "America/Toronto", 2,
                        "Europe/London", 1);
        crew.add(null);

        List<TimeZoneGroup> groups = CrewTimeZoneDistribution.of(crew);

        assertThat(groups)
                .extracting(TimeZoneGroup::code)
                .containsExactly(
                        "Asia/Seoul",
                        "America/Los_Angeles",
                        "America/Toronto",
                        "Europe/London",
                        "unset");
        assertThat(groups).allSatisfy(group -> assertThat(group.breakdown()).isNull());
        assertThat(groups.getFirst().percentage()).isEqualTo(4 * 100.0 / 11);
        assertThat(groups.getLast().count()).isEqualTo(1);
    }

    @Test
    @DisplayName("합계 5 초과 · unset 있음 — 상위 3 + other(나머지 2 지역) + unset")
    void moreThanFiveWithUnset() {
        List<String> crew =
                crew(
                        "Asia/Seoul", 10,
                        "America/Los_Angeles", 7,
                        "America/Toronto", 5,
                        "Europe/London", 1,
                        "Australia/Sydney", 1);
        crew.add("Not/AZone");

        List<TimeZoneGroup> groups = CrewTimeZoneDistribution.of(crew);

        assertThat(groups)
                .extracting(TimeZoneGroup::code)
                .containsExactly(
                        "Asia/Seoul", "America/Los_Angeles", "America/Toronto", "other", "unset");
        TimeZoneGroup other = groups.get(3);
        assertThat(other.count()).isEqualTo(2);
        assertThat(other.percentage()).isEqualTo(8.0);
        assertThat(other.breakdown())
                .containsExactly(
                        new TimeZoneBreakdown("Australia/Sydney", 1, 4.0),
                        new TimeZoneBreakdown("Europe/London", 1, 4.0));
        assertThat(groups.get(4).count()).isEqualTo(1);
        assertThat(groups.stream().mapToLong(TimeZoneGroup::count).sum()).isEqualTo(25);
    }

    @Test
    @DisplayName("합계 5 초과 · unset 없음 — 상위 4 + other(나머지 2 지역)")
    void moreThanFiveWithoutUnset() {
        List<String> crew =
                crew(
                        "Asia/Seoul", 6,
                        "America/Los_Angeles", 5,
                        "America/Toronto", 4,
                        "America/New_York", 3,
                        "Europe/London", 2,
                        "Asia/Tokyo", 2);

        List<TimeZoneGroup> groups = CrewTimeZoneDistribution.of(crew);

        assertThat(groups)
                .extracting(TimeZoneGroup::code)
                .containsExactly(
                        "Asia/Seoul",
                        "America/Los_Angeles",
                        "America/Toronto",
                        "America/New_York",
                        "other");
        assertThat(groups.get(4).breakdown())
                .extracting(TimeZoneBreakdown::code)
                .containsExactly("Asia/Tokyo", "Europe/London");
    }

    @Test
    @DisplayName("동률은 IANA 오름차순, deprecated 링크는 정본과 합친다")
    void tieBreakAndNormalization() {
        List<String> crew =
                new ArrayList<>(
                        List.of("US/Pacific", "America/Los_Angeles", "Asia/Seoul", "Asia/Seoul"));
        crew.addAll(List.of("Europe/London", "Asia/Tokyo"));

        List<TimeZoneGroup> groups = CrewTimeZoneDistribution.of(crew);

        assertThat(groups)
                .extracting(TimeZoneGroup::code)
                .containsExactly(
                        "America/Los_Angeles", "Asia/Seoul", "Asia/Tokyo", "Europe/London");
    }

    @Test
    @DisplayName("활성 크루가 없으면 빈 목록")
    void empty() {
        assertThat(CrewTimeZoneDistribution.of(List.of())).isEmpty();
    }

    private static List<String> crew(Object... zoneAndCount) {
        List<String> crew = new ArrayList<>();
        for (int i = 0; i < zoneAndCount.length; i += 2) {
            crew.addAll(
                    Collections.nCopies((Integer) zoneAndCount[i + 1], (String) zoneAndCount[i]));
        }
        return crew;
    }
}
