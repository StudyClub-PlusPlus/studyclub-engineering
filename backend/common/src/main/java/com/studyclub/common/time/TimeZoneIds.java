package com.studyclub.common.time;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/** 저장·검증하는 IANA 시간대 ID. specs/timezone/spec.md §3.1 */
public final class TimeZoneIds {

    public static final int MAX_LENGTH = 64;
    public static final String SEOUL = "Asia/Seoul";
    public static final String LOS_ANGELES = "America/Los_Angeles";
    public static final String VANCOUVER = "America/Vancouver";

    // Etc/GMT+7 은 이름이 있어도 오프셋 하나라 서울과 도쿄처럼 지역을 가르지 못한다
    private static final Pattern ETC_OFFSET = Pattern.compile("^Etc/GMT[+-]\\d{1,2}$");
    // POSIX 식 이름(PST8PDT) · SystemV/* 는 지역이 아니라 오프셋 규칙이다
    private static final Pattern POSIX_RULE = Pattern.compile("^(SystemV/.*|[A-Z]{3}\\d[A-Z]{3})$");

    private static final Set<String> UTC_ALIASES =
            Set.of(
                    "UTC",
                    "Etc/UTC",
                    "Etc/UCT",
                    "UCT",
                    "Etc/Universal",
                    "Universal",
                    "Etc/Zulu",
                    "Zulu",
                    "GMT",
                    "Etc/GMT",
                    "GMT0",
                    "Etc/GMT0",
                    "Etc/GMT+0",
                    "Etc/GMT-0",
                    "Etc/Greenwich",
                    "Greenwich");

    // JDK 에는 tzdata backward 링크를 정본으로 바꾸는 API 가 없다. 브라우저·옛 기기가 실제로 보내는 링크만 둔다
    private static final Map<String, String> LINKS =
            Map.ofEntries(
                    Map.entry("ROK", "Asia/Seoul"),
                    Map.entry("Japan", "Asia/Tokyo"),
                    Map.entry("PRC", "Asia/Shanghai"),
                    Map.entry("ROC", "Asia/Taipei"),
                    Map.entry("Hongkong", "Asia/Hong_Kong"),
                    Map.entry("Singapore", "Asia/Singapore"),
                    Map.entry("Asia/Calcutta", "Asia/Kolkata"),
                    Map.entry("Asia/Saigon", "Asia/Ho_Chi_Minh"),
                    Map.entry("Asia/Katmandu", "Asia/Kathmandu"),
                    Map.entry("Asia/Rangoon", "Asia/Yangon"),
                    Map.entry("Asia/Dacca", "Asia/Dhaka"),
                    Map.entry("Asia/Istanbul", "Europe/Istanbul"),
                    Map.entry("Turkey", "Europe/Istanbul"),
                    Map.entry("Europe/Kiev", "Europe/Kyiv"),
                    Map.entry("GB", "Europe/London"),
                    Map.entry("GB-Eire", "Europe/London"),
                    Map.entry("Eire", "Europe/Dublin"),
                    Map.entry("NZ", "Pacific/Auckland"),
                    Map.entry("US/Pacific", "America/Los_Angeles"),
                    Map.entry("US/Eastern", "America/New_York"),
                    Map.entry("US/Central", "America/Chicago"),
                    Map.entry("US/Mountain", "America/Denver"),
                    Map.entry("US/Arizona", "America/Phoenix"),
                    Map.entry("US/Alaska", "America/Anchorage"),
                    Map.entry("US/Hawaii", "Pacific/Honolulu"),
                    Map.entry("Canada/Pacific", "America/Vancouver"),
                    Map.entry("Canada/Eastern", "America/Toronto"),
                    Map.entry("Canada/Central", "America/Winnipeg"),
                    Map.entry("Canada/Mountain", "America/Edmonton"),
                    Map.entry("Canada/Atlantic", "America/Halifax"),
                    Map.entry("Canada/Newfoundland", "America/St_Johns"),
                    Map.entry("America/Montreal", "America/Toronto"),
                    Map.entry("America/Buenos_Aires", "America/Argentina/Buenos_Aires"),
                    Map.entry("Brazil/East", "America/Sao_Paulo"),
                    Map.entry("Mexico/General", "America/Mexico_City"),
                    Map.entry("Australia/NSW", "Australia/Sydney"),
                    Map.entry("Australia/ACT", "Australia/Sydney"),
                    Map.entry("Australia/Canberra", "Australia/Sydney"),
                    Map.entry("Australia/Victoria", "Australia/Melbourne"),
                    Map.entry("Australia/Queensland", "Australia/Brisbane"),
                    Map.entry("Australia/West", "Australia/Perth"),
                    Map.entry("Australia/South", "Australia/Adelaide"),
                    Map.entry("America/Indianapolis", "America/Indiana/Indianapolis"),
                    Map.entry("America/Fort_Wayne", "America/Indiana/Indianapolis"),
                    Map.entry("US/East-Indiana", "America/Indiana/Indianapolis"),
                    Map.entry("America/Louisville", "America/Kentucky/Louisville"),
                    Map.entry("Asia/Chongqing", "Asia/Shanghai"),
                    Map.entry("Asia/Chungking", "Asia/Shanghai"),
                    Map.entry("Asia/Harbin", "Asia/Shanghai"),
                    Map.entry("Asia/Ujung_Pandang", "Asia/Makassar"),
                    Map.entry("Asia/Ulan_Bator", "Asia/Ulaanbaatar"),
                    Map.entry("Asia/Thimbu", "Asia/Thimphu"),
                    Map.entry("Asia/Tel_Aviv", "Asia/Jerusalem"),
                    Map.entry("Israel", "Asia/Jerusalem"),
                    Map.entry("Iran", "Asia/Tehran"),
                    Map.entry("Egypt", "Africa/Cairo"),
                    Map.entry("Europe/Belfast", "Europe/London"),
                    Map.entry("Europe/Nicosia", "Asia/Nicosia"),
                    Map.entry("Atlantic/Faeroe", "Atlantic/Faroe"),
                    Map.entry("Pacific/Samoa", "Pacific/Pago_Pago"),
                    Map.entry("US/Samoa", "Pacific/Pago_Pago"),
                    Map.entry("Mexico/BajaNorte", "America/Tijuana"),
                    Map.entry("Brazil/West", "America/Manaus"),
                    Map.entry("Chile/Continental", "America/Santiago"),
                    Map.entry("Cuba", "America/Havana"),
                    Map.entry("Jamaica", "America/Jamaica"),
                    Map.entry("Poland", "Europe/Warsaw"),
                    Map.entry("Portugal", "Europe/Lisbon"),
                    Map.entry("Iceland", "Atlantic/Reykjavik"),
                    Map.entry("Libya", "Africa/Tripoli"),
                    Map.entry("Navajo", "America/Denver"),
                    Map.entry("US/Michigan", "America/Detroit"),
                    Map.entry("Canada/Saskatchewan", "America/Regina"),
                    Map.entry("Canada/Yukon", "America/Whitehorse"));

    private TimeZoneIds() {}

    /**
     * 저장할 정본 ID. 비었거나 오프셋만 있는 ID · 모르는 ID 면 비어 있다. deprecated 링크는 정본으로 바꾼다.
     *
     * @param value 요청 값. 앞뒤 공백은 무시한다
     */
    public static Optional<String> normalize(String value) {
        if (value == null) {
            return Optional.empty();
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_LENGTH) {
            return Optional.empty();
        }
        if (UTC_ALIASES.contains(trimmed)) {
            return Optional.of("UTC");
        }
        if (ETC_OFFSET.matcher(trimmed).matches()
                || POSIX_RULE.matcher(trimmed).matches()
                || !ZoneId.getAvailableZoneIds().contains(trimmed)) {
            return Optional.empty();
        }
        try {
            if (ZoneId.of(trimmed).normalized() instanceof ZoneOffset) {
                return Optional.empty();
            }
        } catch (DateTimeException e) {
            return Optional.empty();
        }
        return Optional.of(LINKS.getOrDefault(trimmed, trimmed));
    }

    public static boolean isValid(String value) {
        return normalize(value).isPresent();
    }

    /** 저장값을 읽을 때 — 무효면 {@code null}. */
    public static String normalizeOrNull(String value) {
        return normalize(value).orElse(null);
    }
}
