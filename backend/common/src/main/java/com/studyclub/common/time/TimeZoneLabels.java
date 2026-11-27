package com.studyclub.common.time;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.text.Collator;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 시간대 한국어 표시 이름과 표시 순서. Playground {@code proto/core/lib/time-zones.ts} · {@code
 * recruitment-timezones.ts} 와 같은 이름 · 순서를 낸다 (PRD §2 · §4).
 */
public final class TimeZoneLabels {

    private static final String RESOURCE = "time-zone-labels.tsv";
    private static final Map<String, String> KO = load();
    private static final Map<String, String> SHORT_KO =
            Map.of(TimeZoneIds.SEOUL, "한국", TimeZoneIds.LOS_ANGELES, "미국 · LA");
    private static final List<String> COUNTRY_ORDER = List.of("한국", "미국", "캐나다", "오스트레일리아", "영국");
    private static final Map<String, Integer> CITY_ORDER =
            Map.of(
                    "America/New_York",
                    0,
                    TimeZoneIds.LOS_ANGELES,
                    1,
                    "America/Toronto",
                    0,
                    TimeZoneIds.VANCOUVER,
                    1);
    private static final Collator KOREAN = Collator.getInstance(Locale.KOREAN);

    /** 한국 → 미국 → 캐나다 → 오스트레일리아 → 영국 → 나머지, 나라 안에서는 주요 도시 먼저 · 이름순. */
    public static final Comparator<String> DISPLAY_ORDER =
            Comparator.comparingInt(TimeZoneLabels::countryRank)
                    .thenComparingInt(zone -> CITY_ORDER.getOrDefault(zone, 2))
                    .thenComparing(TimeZoneLabels::label, KOREAN)
                    .thenComparing(Comparator.naturalOrder());

    private TimeZoneLabels() {}

    /** {@code 나라 · 도시}. 표에 없으면 IANA ID 그대로. */
    public static String label(String zone) {
        return KO.getOrDefault(zone, zone);
    }

    /** 모집 안내 · 목록 필터의 짧은 이름 — 서울은 {@code 한국}, LA 는 {@code 미국 · LA}. */
    public static String shortLabel(String zone) {
        return SHORT_KO.getOrDefault(zone, label(zone));
    }

    public static List<String> sorted(Collection<String> zones) {
        return new LinkedHashSet<>(zones).stream().sorted(DISPLAY_ORDER).toList();
    }

    private static int countryRank(String zone) {
        String country = label(zone).split(" · ")[0];
        int index = COUNTRY_ORDER.indexOf(country);
        return index < 0 ? COUNTRY_ORDER.size() : index;
    }

    private static Map<String, String> load() {
        Map<String, String> labels = new HashMap<>();
        try (InputStream in = TimeZoneLabels.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException(RESOURCE + " 가 클래스패스에 없습니다.");
            }
            BufferedReader reader =
                    new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank() || line.startsWith("#")) {
                    continue;
                }
                String[] columns = line.split("\t");
                labels.put(columns[0], columns[1]);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return Map.copyOf(labels);
    }
}
