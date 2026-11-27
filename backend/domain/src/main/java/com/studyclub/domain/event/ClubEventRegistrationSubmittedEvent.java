package com.studyclub.domain.event;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;

/**
 * 크루가 행사에 신청했다 (CLUB_EVENT_REGISTRATION 저장). 신청 트랜잭션 안에서 발행한다 (specs/event-registration 「도메인 이벤트와
 * 자동 메일」). 페이로드는 ID 와 접수 상태뿐 — 연락처 · 답변은 싣지 않는다.
 *
 * <p>구독자: 분석(커밋 뒤 {@code Event Registration Completed}). 자동 메일 구독자(event-mail)가 {@code
 * BEFORE_COMMIT} 으로 {@code PENDING} → 접수 안내, {@code CONFIRMED} → 확정 안내 {@code NOTIFICATION} 행을 같은
 * 트랜잭션에 만든다.
 *
 * @param status {@code PENDING} 또는 {@code CONFIRMED}
 */
public record ClubEventRegistrationSubmittedEvent(
        EventMeta meta, Long clubEventId, Long registrationId, ClubEventRegistrationStatus status)
        implements DomainEvent {

    public static final String NAME = "club_event.registration_submitted";

    /** 행위자 = 신청한 크루. */
    public static ClubEventRegistrationSubmittedEvent of(
            Long clubEventId,
            Long registrationId,
            ClubEventRegistrationStatus status,
            Long applicantAccountId) {
        return new ClubEventRegistrationSubmittedEvent(
                EventMeta.now(applicantAccountId), clubEventId, registrationId, status);
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
