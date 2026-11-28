package com.studyclub.domain.event;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import java.util.List;

/**
 * 행사가 실제로 {@code CANCELLED} 로 바뀌었다 (specs/event-status 「도메인 이벤트」). 취소 트랜잭션 안에서 발행한다. 페이로드는 행사 ID 와
 * 함께 취소로 바뀐 신청 ID 뿐 — 연락처 · 답변 · 안내 본문은 싣지 않는다.
 *
 * <p>구독자: 분석(커밋 뒤 신청마다 {@code Event Registration Cancelled}). 메일 구독자는 두지 않는다 — 취소 안내는 캡틴이 직접 쓴다
 * (S2).
 */
public record ClubEventCancelledEvent(
        EventMeta meta, Long clubEventId, List<Long> cancelledRegistrationIds)
        implements DomainEvent {

    public static final String NAME = "club_event.cancelled";

    public ClubEventCancelledEvent {
        cancelledRegistrationIds = List.copyOf(cancelledRegistrationIds);
    }

    /** 행위자 = 행사를 취소한 캡틴. */
    public static ClubEventCancelledEvent of(
            Long clubEventId, List<Long> cancelledRegistrationIds, Long actorAccountId) {
        return new ClubEventCancelledEvent(
                EventMeta.now(actorAccountId), clubEventId, cancelledRegistrationIds);
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
