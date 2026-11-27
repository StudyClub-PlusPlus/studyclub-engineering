package com.studyclub.domain.event.mail;

import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventChannel;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventFormat;
import com.studyclub.domain.event.EventInputs;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 행사 메일 템플릿에 끼우는 값 (specs/event-mail 「렌더링 규칙」). 미리보기 · 보내기(api)와 자동 메일(notification)이 같은 값을 쓰도록 한
 * 곳에 둔다. 공통 본문 값에는 {@code nickname} 키가 없다 — 렌더러가 모르는 변수를 원문으로 남겨 {@code {{nickname}}} 이 그대로 보인다.
 */
public final class EventMailValues {

    static final String ONLINE_URL_PENDING = "온라인 참여 링크는 추후 안내드립니다.";

    private static final DateTimeFormatter DATE =
            DateTimeFormatter.ofPattern("M월 d일 (E) HH:mm", Locale.KOREAN);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final ZoneId VANCOUVER = ZoneId.of("America/Vancouver");

    /**
     * B.C. 는 2026-03-08 10:00 UTC 의 마지막 서머타임 시작 뒤 UTC−7 로 고정했다. 옛 tzdata 는 11월에 되돌리므로 형식을 만들 때 직접
     * 고정하고 약어는 PCT 다 (프로토 {@code time-zone-rules.ts} 와 같은 기준).
     */
    private static final Instant VANCOUVER_PERMANENT_TIME_START =
            Instant.parse("2026-03-08T10:00:00Z");

    private static final ZoneOffset VANCOUVER_PERMANENT_OFFSET = ZoneOffset.ofHours(-7);

    private EventMailValues() {}

    /** 개인별 일정의 시간대 — 수신자 프로필 → 신청 당시 시간대 → 행사 시간대 (M3). 비었거나 읽을 수 없는 값은 건너뛴다. */
    public static ZoneId recipientZone(
            String accountTimeZone, String applicantTimeZone, String eventTimeZone) {
        for (String candidate :
                List.of(nullToEmpty(accountTimeZone), nullToEmpty(applicantTimeZone))) {
            if (!candidate.isBlank()) {
                try {
                    return ZoneId.of(candidate);
                } catch (DateTimeException ignored) {
                    // 다음 후보로
                }
            }
        }
        return ZoneId.of(eventTimeZone);
    }

    /**
     * 종료가 있으면 {@code {시작} {약어} ~ {종료} {약어}}, 없으면 {@code {시작} {약어}}. 약어는 각 시각의 것이다 (프로토 {@code
     * formatDate}).
     */
    public static String schedule(ClubEvent event, ZoneId zone) {
        Instant start = event.getStartsAt();
        Instant end = event.getEndsAt();
        if (end == null) {
            return format(start, zone) + " " + abbreviation(zone, start);
        }
        return format(start, zone)
                + " "
                + abbreviation(zone, start)
                + " ~ "
                + format(end, zone)
                + " "
                + abbreviation(zone, end);
    }

    /** 서울 KST, 북미는 그 시각의 서머타임 여부로 EST · EDT · PST · PDT, 고정 뒤 밴쿠버는 PCT. */
    public static String abbreviation(ZoneId zone, Instant at) {
        if (zone.equals(SEOUL)) {
            return "KST";
        }
        if (usesVancouverPermanentTime(zone, at)) {
            return "PCT";
        }
        boolean dst = zone.getRules().isDaylightSavings(at);
        return switch (zone.getId()) {
            case "America/Toronto", "America/New_York" -> dst ? "EDT" : "EST";
            case "America/Vancouver", "America/Los_Angeles" -> dst ? "PDT" : "PST";
            default -> zone.getDisplayName(TextStyle.SHORT, Locale.US);
        };
    }

    public static String channelName(EventChannel channel) {
        return channel == EventChannel.ONLINE ? "온라인" : "오프라인";
    }

    public static String formatName(EventFormat format) {
        return switch (format) {
            case ONLINE -> "온라인";
            case OFFLINE -> "오프라인";
            case HYBRID -> "온라인·오프라인";
        };
    }

    /**
     * 참여 안내 — {@code channel} 이 null 이면(대상 {@code ALL}) 행사의 모든 방식을, 둘이면 온라인 먼저 {@code 방식: 값} 두 줄로.
     * 오프라인은 장소, 온라인은 참여 링크(없으면 추후 안내 문구).
     */
    public static String participation(ClubEvent event, EventChannel channel) {
        List<EventChannel> modes = new ArrayList<>();
        if (channel != null) {
            modes.add(channel);
        } else {
            for (EventChannel each : List.of(EventChannel.ONLINE, EventChannel.OFFLINE)) {
                if (event.findChannel(each).isPresent()) {
                    modes.add(each);
                }
            }
        }
        List<String> lines = new ArrayList<>();
        for (EventChannel mode : modes) {
            String detail = detail(event, mode);
            lines.add(modes.size() > 1 ? channelName(mode) + ": " + detail : detail);
        }
        return String.join("\n", lines);
    }

    /** 안내 메일 공통 본문 · 미리보기 — {@code channel} null 이면 대상 {@code ALL}. */
    public static Map<String, Object> announcement(
            ClubEvent event, EventChannel channel, ZoneId zone, String notice) {
        Map<String, Object> values = new HashMap<>();
        values.put("eventTitle", event.getTitle());
        values.put("channel", channel == null ? formatName(event.format()) : channelName(channel));
        values.put("eventSchedule", schedule(event, zone));
        values.put("participation", participation(event, channel));
        values.put("notice", noticeOf(notice));
        return values;
    }

    /** 안내 메일 수신자 한 명 — 그 사람의 방식 하나와 그 사람 시간대로. */
    public static Map<String, Object> announcementFor(
            ClubEvent event, EventChannel channel, ZoneId zone, String notice, String nickname) {
        Map<String, Object> values = announcement(event, channel, zone, notice);
        values.put("nickname", nickname);
        return values;
    }

    /** 취소 안내 공통 본문 · 미리보기 — 행사명과 안내 내용만. 일정 · 장소 · 링크는 만들지 않는다. */
    public static Map<String, Object> cancellation(ClubEvent event, String notice) {
        Map<String, Object> values = new HashMap<>();
        values.put("eventTitle", event.getTitle());
        values.put("notice", noticeOf(notice));
        return values;
    }

    public static Map<String, Object> cancellationFor(
            ClubEvent event, String notice, String nickname) {
        Map<String, Object> values = cancellation(event, notice);
        values.put("nickname", nickname);
        return values;
    }

    /** 자동 메일 — 참여 안내는 참가 확정 메일에만 채우고 그 밖은 빈 문자열. */
    public static Map<String, Object> automatic(
            ClubEvent event,
            EventChannel channel,
            ZoneId zone,
            String nickname,
            boolean confirmed) {
        Map<String, Object> values = new HashMap<>();
        values.put("nickname", nickname);
        values.put("eventTitle", event.getTitle());
        values.put("eventSchedule", schedule(event, zone));
        values.put("channel", channelName(channel));
        values.put("participation", confirmed ? participation(event, channel) : "");
        return values;
    }

    private static String detail(ClubEvent event, EventChannel mode) {
        ClubEventChannel row = event.findChannel(mode).orElse(null);
        if (mode == EventChannel.OFFLINE) {
            return row == null || row.getLocation() == null ? "" : row.getLocation();
        }
        String url = row == null ? null : row.getOnlineUrl();
        return url == null || url.isBlank() ? ONLINE_URL_PENDING : url;
    }

    private static String format(Instant at, ZoneId zone) {
        ZoneId effective = usesVancouverPermanentTime(zone, at) ? VANCOUVER_PERMANENT_OFFSET : zone;
        return DATE.format(at.atZone(effective));
    }

    private static boolean usesVancouverPermanentTime(ZoneId zone, Instant at) {
        return zone.equals(VANCOUVER) && !at.isBefore(VANCOUVER_PERMANENT_TIME_START);
    }

    private static String noticeOf(String notice) {
        String trimmed = EventInputs.trim(notice);
        return trimmed == null ? "" : trimmed;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
