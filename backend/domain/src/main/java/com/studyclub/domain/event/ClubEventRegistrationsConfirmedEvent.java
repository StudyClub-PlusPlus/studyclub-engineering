package com.studyclub.domain.event;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import java.util.List;

/**
 * 확인 대기 신청이 참가 확정이 됐다 — 확정 방식 {@code REVIEW → AUTO} 수정의 일괄 확정(specs/event 「확정 방식 전환」)과 운영진 참가
 * 확정(specs/event-participant 「참가 처리」). 처리 트랜잭션 안에서 발행한다. 페이로드는 행사 ID 와 실제로 바꾼 신청 ID 뿐 — 신청자 연락처·답변은
 * 싣지 않는다.
 *
 * <p>구독자: 자동 메일(event-mail) {@code BEFORE_COMMIT} 구독자가 신청마다 확정 안내 {@code NOTIFICATION} 행을 같은 트랜잭션에
 * 저장한다 (행 생성 실패 시 예외를 삼키지 않고 전체 롤백).
 */
public record ClubEventRegistrationsConfirmedEvent(
        EventMeta meta, Long clubEventId, List<Long> registrationIds) implements DomainEvent {

    public static final String NAME = "club_event.registrations_confirmed";

    public ClubEventRegistrationsConfirmedEvent {
        registrationIds = List.copyOf(registrationIds);
    }

    /** 행위자 = 확정 방식을 바꿔 저장했거나 참가를 확정한 캡틴. */
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
