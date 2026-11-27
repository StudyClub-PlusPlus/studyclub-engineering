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

    /**
     * tzdata {@code backward} 의 옛 이름 · 분류 이름 링크 → 같은 곳의 정본 ID. JDK 에는 링크 → 정본 API 가 없어 표로 둔다 — JDK
     * 를 올려 새 링크가 생기면 {@code TimeZoneIdsTest} 의 전수 검사가 잡는다.
     *
     * <p>tzdata 가 다른 나라의 존으로 합친 도시(Europe/Amsterdam → Europe/Brussels 등)는 링크로 보지 않는다 — 같은 오프셋의 다른
     * 지역을 합치지 않는다(§3.1).
     */
    static final Map<String, String> LINKS =
            Map.ofEntries(
                    Map.entry("ROK", "Asia/Seoul"),
                    Map.entry("Japan", "Asia/Tokyo"),
                    Map.entry("PRC", "Asia/Shanghai"),
                    Map.entry("Hongkong", "Asia/Hong_Kong"),
                    Map.entry("Singapore", "Asia/Singapore"),
                    Map.entry("Cuba", "America/Havana"),
                    Map.entry("Egypt", "Africa/Cairo"),
                    Map.entry("Eire", "Europe/Dublin"),
                    Map.entry("GB", "Europe/London"),
                    Map.entry("GB-Eire", "Europe/London"),
                    Map.entry("Iceland", "Atlantic/Reykjavik"),
                    Map.entry("Iran", "Asia/Tehran"),
                    Map.entry("Israel", "Asia/Jerusalem"),
                    Map.entry("Jamaica", "America/Jamaica"),
                    Map.entry("Kwajalein", "Pacific/Kwajalein"),
                    Map.entry("Libya", "Africa/Tripoli"),
                    Map.entry("NZ", "Pacific/Auckland"),
                    Map.entry("NZ-CHAT", "Pacific/Chatham"),
                    Map.entry("Navajo", "America/Denver"),
                    Map.entry("Poland", "Europe/Warsaw"),
                    Map.entry("Portugal", "Europe/Lisbon"),
                    Map.entry("Turkey", "Europe/Istanbul"),
                    Map.entry("W-SU", "Europe/Moscow"),
                    Map.entry("US/Alaska", "America/Anchorage"),
                    Map.entry("US/Aleutian", "America/Adak"),
                    Map.entry("US/Arizona", "America/Phoenix"),
                    Map.entry("US/Central", "America/Chicago"),
                    Map.entry("US/East-Indiana", "America/Indiana/Indianapolis"),
                    Map.entry("US/Eastern", "America/New_York"),
                    Map.entry("US/Hawaii", "Pacific/Honolulu"),
                    Map.entry("US/Indiana-Starke", "America/Indiana/Knox"),
                    Map.entry("US/Michigan", "America/Detroit"),
                    Map.entry("US/Mountain", "America/Denver"),
                    Map.entry("US/Pacific", "America/Los_Angeles"),
                    Map.entry("US/Samoa", "Pacific/Pago_Pago"),
                    Map.entry("Canada/Atlantic", "America/Halifax"),
                    Map.entry("Canada/Central", "America/Winnipeg"),
                    Map.entry("Canada/Eastern", "America/Toronto"),
                    Map.entry("Canada/Mountain", "America/Edmonton"),
                    Map.entry("Canada/Newfoundland", "America/St_Johns"),
                    Map.entry("Canada/Pacific", "America/Vancouver"),
                    Map.entry("Canada/Saskatchewan", "America/Regina"),
                    Map.entry("Canada/Yukon", "America/Whitehorse"),
                    Map.entry("Brazil/Acre", "America/Rio_Branco"),
                    Map.entry("Brazil/DeNoronha", "America/Noronha"),
                    Map.entry("Brazil/East", "America/Sao_Paulo"),
                    Map.entry("Brazil/West", "America/Manaus"),
                    Map.entry("Chile/Continental", "America/Santiago"),
                    Map.entry("Chile/EasterIsland", "Pacific/Easter"),
                    Map.entry("Mexico/BajaNorte", "America/Tijuana"),
                    Map.entry("Mexico/BajaSur", "America/Mazatlan"),
                    Map.entry("Mexico/General", "America/Mexico_City"),
                    Map.entry("Australia/ACT", "Australia/Sydney"),
                    Map.entry("Australia/Canberra", "Australia/Sydney"),
                    Map.entry("Australia/Currie", "Australia/Hobart"),
                    Map.entry("Australia/LHI", "Australia/Lord_Howe"),
                    Map.entry("Australia/NSW", "Australia/Sydney"),
                    Map.entry("Australia/North", "Australia/Darwin"),
                    Map.entry("Australia/Queensland", "Australia/Brisbane"),
                    Map.entry("Australia/South", "Australia/Adelaide"),
                    Map.entry("Australia/Tasmania", "Australia/Hobart"),
                    Map.entry("Australia/Victoria", "Australia/Melbourne"),
                    Map.entry("Australia/West", "Australia/Perth"),
                    Map.entry("Australia/Yancowinna", "Australia/Broken_Hill"),
                    Map.entry("Africa/Asmera", "Africa/Asmara"),
                    Map.entry("Africa/Timbuktu", "Africa/Bamako"),
                    Map.entry("America/Argentina/ComodRivadavia", "America/Argentina/Catamarca"),
                    Map.entry("America/Atka", "America/Adak"),
                    Map.entry("America/Buenos_Aires", "America/Argentina/Buenos_Aires"),
                    Map.entry("America/Catamarca", "America/Argentina/Catamarca"),
                    Map.entry("America/Coral_Harbour", "America/Atikokan"),
                    Map.entry("America/Cordoba", "America/Argentina/Cordoba"),
                    Map.entry("America/Ensenada", "America/Tijuana"),
                    Map.entry("America/Fort_Wayne", "America/Indiana/Indianapolis"),
                    Map.entry("America/Godthab", "America/Nuuk"),
                    Map.entry("America/Indianapolis", "America/Indiana/Indianapolis"),
                    Map.entry("America/Jujuy", "America/Argentina/Jujuy"),
                    Map.entry("America/Knox_IN", "America/Indiana/Knox"),
                    Map.entry("America/Louisville", "America/Kentucky/Louisville"),
                    Map.entry("America/Mendoza", "America/Argentina/Mendoza"),
                    Map.entry("America/Montreal", "America/Toronto"),
                    Map.entry("America/Nipigon", "America/Toronto"),
                    Map.entry("America/Pangnirtung", "America/Iqaluit"),
                    Map.entry("America/Porto_Acre", "America/Rio_Branco"),
                    Map.entry("America/Rainy_River", "America/Winnipeg"),
                    Map.entry("America/Rosario", "America/Argentina/Cordoba"),
                    Map.entry("America/Santa_Isabel", "America/Tijuana"),
                    Map.entry("America/Shiprock", "America/Denver"),
                    Map.entry("America/Thunder_Bay", "America/Toronto"),
                    Map.entry("America/Virgin", "America/St_Thomas"),
                    Map.entry("America/Yellowknife", "America/Edmonton"),
                    Map.entry("Antarctica/South_Pole", "Antarctica/McMurdo"),
                    Map.entry("Asia/Ashkhabad", "Asia/Ashgabat"),
                    Map.entry("Asia/Calcutta", "Asia/Kolkata"),
                    Map.entry("Asia/Choibalsan", "Asia/Ulaanbaatar"),
                    Map.entry("Asia/Chongqing", "Asia/Shanghai"),
                    Map.entry("Asia/Chungking", "Asia/Shanghai"),
                    Map.entry("Asia/Dacca", "Asia/Dhaka"),
                    Map.entry("Asia/Harbin", "Asia/Shanghai"),
                    Map.entry("Asia/Istanbul", "Europe/Istanbul"),
                    Map.entry("Asia/Kashgar", "Asia/Urumqi"),
                    Map.entry("Asia/Katmandu", "Asia/Kathmandu"),
                    Map.entry("Asia/Macao", "Asia/Macau"),
                    Map.entry("Asia/Rangoon", "Asia/Yangon"),
                    Map.entry("Asia/Saigon", "Asia/Ho_Chi_Minh"),
                    Map.entry("Asia/Tel_Aviv", "Asia/Jerusalem"),
                    Map.entry("Asia/Thimbu", "Asia/Thimphu"),
                    Map.entry("Asia/Ujung_Pandang", "Asia/Makassar"),
                    Map.entry("Asia/Ulan_Bator", "Asia/Ulaanbaatar"),
                    Map.entry("Atlantic/Faeroe", "Atlantic/Faroe"),
                    Map.entry("Atlantic/Jan_Mayen", "Europe/Oslo"),
                    Map.entry("Europe/Belfast", "Europe/London"),
                    Map.entry("Europe/Kiev", "Europe/Kyiv"),
                    Map.entry("Europe/Nicosia", "Asia/Nicosia"),
                    Map.entry("Europe/Tiraspol", "Europe/Chisinau"),
                    Map.entry("Europe/Uzhgorod", "Europe/Kyiv"),
                    Map.entry("Europe/Zaporozhye", "Europe/Kyiv"),
                    Map.entry("Pacific/Enderbury", "Pacific/Kanton"),
                    Map.entry("Pacific/Johnston", "Pacific/Honolulu"),
                    Map.entry("Pacific/Ponape", "Pacific/Pohnpei"),
                    Map.entry("Pacific/Samoa", "Pacific/Pago_Pago"),
                    Map.entry("Pacific/Truk", "Pacific/Chuuk"),
                    Map.entry("Pacific/Yap", "Pacific/Chuuk"));

    // 지역이 아니라 규칙 이름이다 (중부 · 동부 · 서부 유럽 시간)
    private static final Set<String> RULE_NAMES = Set.of("CET", "EET", "MET", "WET");

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
                || RULE_NAMES.contains(trimmed)
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
