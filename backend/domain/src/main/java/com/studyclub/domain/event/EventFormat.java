package com.studyclub.domain.event;

import java.util.EnumSet;
import java.util.Set;

/** 행사 참여 방식 구성. 저장하지 않고 {@code CLUB_EVENT_CHANNEL} 행 조합에서 계산한다. */
public enum EventFormat {
    ONLINE(EnumSet.of(EventChannel.ONLINE)),
    OFFLINE(EnumSet.of(EventChannel.OFFLINE)),
    HYBRID(EnumSet.of(EventChannel.ONLINE, EventChannel.OFFLINE));

    private final Set<EventChannel> channels;

    EventFormat(Set<EventChannel> channels) {
        this.channels = channels;
    }

    public Set<EventChannel> channels() {
        return EnumSet.copyOf(channels);
    }

    public boolean includes(EventChannel channel) {
        return channels.contains(channel);
    }

    /** 참여 방식 조합 → 구성. 방식이 하나도 없으면 행사가 성립하지 않는다. */
    public static EventFormat of(Set<EventChannel> present) {
        for (EventFormat format : values()) {
            if (format.channels.equals(present)) {
                return format;
            }
        }
        throw new IllegalStateException("참여 방식이 없는 행사입니다.");
    }
}
