package com.studyclub.common.event;

import java.time.Instant;
import java.util.UUID;

/**
 * 모든 도메인 이벤트의 공통 계약 (specs/domain-events/spec.md §공통 계약).
 *
 * <p>구현은 {@code record} 이고 첫 컴포넌트로 {@link EventMeta} 를 갖는다. {@link #name()} 은 {@code
 * aggregate.past_tense} (예: {@code user.registered}) 상수다.
 */
public interface DomainEvent {

    EventMeta meta();

    String name();

    String aggregateType();

    String aggregateId();

    default UUID eventId() {
        return meta().eventId();
    }

    default Instant occurredAt() {
        return meta().occurredAt();
    }

    /** 사실을 일으킨 계정. 시스템이 일으켰으면 null. */
    default String actorId() {
        return meta().actorId();
    }
}
