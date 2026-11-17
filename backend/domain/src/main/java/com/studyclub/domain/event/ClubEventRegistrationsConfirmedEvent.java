package com.studyclub.domain.event;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import java.util.List;

/**
 * 확정 방식을 {@code REVIEW → AUTO} 로 바꾼 수정이 확인 대기 신청을 참가 확정으로 바꿨다. 수정 트랜잭션 안에서 발행한다
 * (specs/event/spec.md 「확정 방식 전환」). 페이로드는 행사 ID 와 실제로 바꾼 신청 ID 뿐 — 신청자 연락처·답변은 싣지 않는다.
 *
 * <p>구독자: 아직 없다. 신청·메일 스펙이 확정되면 {@code BEFORE_COMMIT} 구독자가 신청마다 확정 안내 {@code NOTIFICATION} 행을 같은
 * 트랜잭션에 저장한다 (행 생성 실패 시 예외를 삼키지 않고 전체 롤백).
 */
public record ClubEventRegistrationsConfirmedEvent(
        EventMeta meta, Long clubEventId, List<Long> registrationIds) implements DomainEvent {

    public static final String NAME = "club_event.registrations_confirmed";

    public ClubEventRegistrationsConfirmedEvent {
        registrationIds = List.copyOf(registrationIds);
    }

    /** 행위자 = 확정 방식을 바꿔 저장한 캡틴. */
    public static ClubEventRegistrationsConfirmedEvent of(
            Long clubEventId, List<Long> registrationIds, Long actorAccountId) {
        return new ClubEventRegistrationsConfirmedEvent(
                EventMeta.now(actorAccountId), clubEventId, registrationIds);
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
