package com.studyclub.domain.event.mail;

import com.studyclub.domain.event.EventChannel;

/**
 * 운영자 메일의 받는 사람 범위. 안내는 {@code ALL} · {@code ONLINE} · {@code OFFLINE}, 취소 안내는 {@code
 * CANCELLED_ACTIVE} 만.
 */
public enum ClubEventMailAudience {
    ALL,
    ONLINE,
    OFFLINE,
    CANCELLED_ACTIVE;

    /** 참여 방식 하나로 좁히는 대상이면 그 방식, 아니면 null. */
    public EventChannel channel() {
        return switch (this) {
            case ONLINE -> EventChannel.ONLINE;
            case OFFLINE -> EventChannel.OFFLINE;
            default -> null;
        };
    }

    public boolean allowedFor(ClubEventMailType type) {
        return type == ClubEventMailType.CANCELLATION
                ? this == CANCELLED_ACTIVE
                : this != CANCELLED_ACTIVE;
    }
}
