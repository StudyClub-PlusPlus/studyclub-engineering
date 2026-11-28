package com.studyclub.api.stats;

import com.studyclub.api.stats.AdminStatsResponses.TimeZoneBreakdown;
import com.studyclub.api.stats.AdminStatsResponses.TimeZoneGroup;
import com.studyclub.common.time.TimeZoneIds;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 크루 시간대 분포 차트 — 최대 5칸 (specs/dashboard/spec.md §4.5 확장 개정안). 묶기 전 칸 수 = 지역 수 + ({@code unset} 이
 * 있으면 1).
 *
 * <ul>
 *   <li>5 이하 — 전부, {@code other} 없음
 *   <li>5 초과 · {@code unset} 있음 — 상위 3 지역 + {@code other} + {@code unset}
 *   <li>5 초과 · {@code unset} 없음 — 상위 4 지역 + {@code other}
 * </ul>
 *
 * <p>지역은 인원 내림차순 · 동률 IANA 오름차순. 출력 순서는 지역 → {@code other} → {@code unset}. 비율의 분모는 전체 활성 크루다.
 */
final class CrewTimeZoneDistribution {

    static final String OTHER = "other";
    static final String UNSET = "unset";
    private static final int MAX_SLOTS = 5;

    private CrewTimeZoneDistribution() {}

    /**
     * @param timeZones 활성 크루 한 명당 저장된 {@code TIME_ZONE} 하나 (null · 무효는 {@code unset})
     */
    static List<TimeZoneGroup> of(Collection<String> timeZones) {
        long total = timeZones.size();
        if (total == 0) {
            return List.of();
        }
        Map<String, Long> regions = new HashMap<>();
        long unset = 0;
        for (String raw : timeZones) {
            String zone = TimeZoneIds.normalizeOrNull(raw);
            if (zone == null) {
                unset++;
            } else {
                regions.merge(zone, 1L, Long::sum);
            }
        }
        List<Map.Entry<String, Long>> ranked =
                regions.entrySet().stream()
                        .sorted(
                                Comparator.<Map.Entry<String, Long>>comparingLong(
                                                Map.Entry::getValue)
                                        .reversed()
                                        .thenComparing(Map.Entry::getKey))
                        .toList();

        int slots = ranked.size() + (unset > 0 ? 1 : 0);
        int shown = slots <= MAX_SLOTS ? ranked.size() : MAX_SLOTS - 1 - (unset > 0 ? 1 : 0);

        List<TimeZoneGroup> groups = new ArrayList<>();
        for (Map.Entry<String, Long> entry : ranked.subList(0, shown)) {
            groups.add(group(entry.getKey(), entry.getValue(), total, null));
        }
        if (shown < ranked.size()) {
            List<TimeZoneBreakdown> breakdown =
                    ranked.subList(shown, ranked.size()).stream()
                            .map(
                                    entry ->
                                            new TimeZoneBreakdown(
                                                    entry.getKey(),
                                                    entry.getValue(),
                                                    percentage(entry.getValue(), total)))
                            .toList();
            long otherCount = breakdown.stream().mapToLong(TimeZoneBreakdown::count).sum();
            groups.add(group(OTHER, otherCount, total, breakdown));
        }
        if (unset > 0) {
            groups.add(group(UNSET, unset, total, null));
        }
        return groups;
    }

    private static TimeZoneGroup group(
            String code, long count, long total, List<TimeZoneBreakdown> breakdown) {
        return new TimeZoneGroup(code, count, percentage(count, total), breakdown);
    }

    private static Double percentage(long count, long total) {
        return total == 0 ? null : (count * 100.0) / total;
    }
}
