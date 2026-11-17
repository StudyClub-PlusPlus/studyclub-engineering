package com.studyclub.domain.event;

import static com.studyclub.domain.event.EventInputs.invalid;
import static com.studyclub.domain.event.EventInputs.requireText;
import static com.studyclub.domain.event.EventInputs.trim;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * 참여 방식 하나의 입력값. 오프라인은 장소가 필수, 온라인은 참여 링크가 선택이다 (빈 링크 = 「추후 안내」). 만들 때 공백을 정리하고, {@link EventDraft}
 * 가 검증한다.
 *
 * <p>참여 링크는 확정자에게만 보이는 값이라 실패 메시지에도 로그에도 넣지 않는다.
 */
public record ChannelDraft(EventChannel channel, int capacity, String location, String onlineUrl) {

    public ChannelDraft {
        location = trim(location);
        onlineUrl = trim(onlineUrl);
        if (onlineUrl != null && onlineUrl.isEmpty()) {
            onlineUrl = null;
        }
    }

    public static ChannelDraft offline(int capacity, String location) {
        return new ChannelDraft(EventChannel.OFFLINE, capacity, location, null);
    }

    public static ChannelDraft online(int capacity, String onlineUrl) {
        return new ChannelDraft(EventChannel.ONLINE, capacity, null, onlineUrl);
    }

    void validate() {
        String prefix = channel.fieldName();
        if (capacity < EventLimits.CAPACITY_MIN || capacity > EventLimits.CAPACITY_MAX) {
            throw invalid(
                    prefix + ".capacity",
                    EventLimits.CAPACITY_MIN + " ~ " + EventLimits.CAPACITY_MAX + " 사이로 입력해 주세요.");
        }
        if (channel == EventChannel.OFFLINE) {
            requireText(prefix + ".location", location, EventLimits.LOCATION_MAX);
            return;
        }
        if (onlineUrl != null && !isHttpUrl(onlineUrl)) {
            throw invalid(
                    prefix + ".url",
                    "http·https 로 시작하는 " + EventLimits.ONLINE_URL_MAX + "자 이하의 주소를 입력해 주세요.");
        }
    }

    private static boolean isHttpUrl(String value) {
        if (value.length() > EventLimits.ONLINE_URL_MAX) {
            return false;
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            if (scheme == null || !uri.isAbsolute() || uri.getHost() == null) {
                return false;
            }
            String lower = scheme.toLowerCase(Locale.ROOT);
            return lower.equals("http") || lower.equals("https");
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
