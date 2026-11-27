package com.studyclub.domain.event;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import java.util.List;

/**
 * 확인 대기 신청이 참가 불가가 됐다 — 실제로 바꾼 신청 ID 만 싣는다 (specs/event-participant 「참가 처리」 · 「행사 종료 시 확인 대기 자동
 * 전환」). 처리 트랜잭션 안에서 발행한다. 페이로드에 연락처 · 답변을 싣지 않는다.
 *
 * <p>구독자: 자동 메일(event-mail)이 {@code BEFORE_COMMIT} 으로 신청마다 참가 불가 안내 {@code NOTIFICATION} 행을 만든다.
 */
public record ClubEventRegistrationsDeclinedEvent(
        EventMeta meta, Long clubEventId, List<Long> registrationIds, Cause cause)
        implements DomainEvent {

    public static final String NAME = "club_event.registrations_declined";

    public enum Cause {
        /** 운영진 참가 불가. */
        ADMIN,
        /** 행사 종료 때 남은 확인 대기를 시스템이 바꿨다 — 행위자 없음. */
        EVENT_ENDED
    }

    public ClubEventRegistrationsDeclinedEvent {
        registrationIds = List.copyOf(registrationIds);
    }

    public static ClubEventRegistrationsDeclinedEvent of(
            Long clubEventId, List<Long> registrationIds, Cause cause, Long actorAccountId) {
        return new ClubEventRegistrationsDeclinedEvent(
                EventMeta.now(actorAccountId), clubEventId, registrationIds, cause);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String aggregateType() {
        return "club_event";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(clubEventId);
    }
}
