package com.studyclub.domain.event;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import java.util.List;

/**
 * 행사 신청이 취소됐다 — 실제로 바꾼 신청 ID 만 싣는다 (specs/event-registration 「본인 취소」, event-participant 제안 이벤트). 취소
 * 트랜잭션 안에서 발행한다. 회원 탈퇴로 취소한 신청은 이 이벤트를 내지 않는다 (P3). 행사 전체 취소도 내지 않는다 — 자동 취소 메일 구독자가 붙는 이벤트라 S2 를
 * 어긴다. 행사 취소는 {@link ClubEventCancelledEvent} 다.
 *
 * <p>구독자: 분석(커밋 뒤 {@code Event Registration Cancelled}). 자동 메일 구독자(event-mail)가 {@code
 * BEFORE_COMMIT} 으로 취소 안내를 만든다 (아직 없음).
 */
public record ClubEventRegistrationsCancelledEvent(
        EventMeta meta, Long clubEventId, List<Long> registrationIds, Cause cause)
        implements DomainEvent {

    public static final String NAME = "club_event.registrations_cancelled";

    /** 누가 취소했나 — 분석 {@code cancel_type} 과 같은 구분. */
    public enum Cause {
        /** 크루 본인 취소 (event-registration). */
        SELF,
        /** 운영진 개별 취소 (event-participant). */
        ADMIN
    }

    public ClubEventRegistrationsCancelledEvent {
        registrationIds = List.copyOf(registrationIds);
    }

    public static ClubEventRegistrationsCancelledEvent of(
            Long clubEventId, List<Long> registrationIds, Cause cause, Long actorAccountId) {
        return new ClubEventRegistrationsCancelledEvent(
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
