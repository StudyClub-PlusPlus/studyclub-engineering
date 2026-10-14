package com.studyclub.common.event;

import java.time.Instant;
import java.util.UUID;

/** 이벤트 메타 — id·발생 시각(UTC)·행위자. {@link #now(Object)} 로 만든다. */
public record EventMeta(UUID eventId, Instant occurredAt, String actorId) {

    public static EventMeta now(Object actorId) {
        return new EventMeta(
                UUID.randomUUID(), Instant.now(), actorId == null ? null : actorId.toString());
    }
}
