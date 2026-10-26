package com.studyclub.domain.participant;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 명부 행이 참여(ACTIVE)로 들어왔다 — 새 행이든, 빠졌던 옛 행을 되살렸든. 신청 제출 트랜잭션 안에서 발행되고, 구독자는 커밋 뒤에 받는다
 * (specs/domain-events/spec.md). 디스코드 스터디 role 부여(DSC-07)가 듣는다. 명부 입구는 디스코드 연동을 먼저 검사하므로 이 사람에게는
 * 디스코드 ID 가 있다.
 *
 * @param participantRole 들어온 때의 역할 — 신청으로 들어오면 늘 크루(MEMBER)
 */
public record StudyParticipantJoined(
        EventMeta meta,
        Long studyId,
        Long participantId,
        Long accountId,
        ParticipantRole participantRole)
        implements DomainEvent {

    public static final String NAME = "study_participant.joined";

    /** 행위자 = 명부에 넣은 사람. 신청 제출이면 신청자 본인이다. */
    public static StudyParticipantJoined of(Long actorAccountId, StudyParticipant participant) {
        return new StudyParticipantJoined(
                EventMeta.now(actorAccountId),
                participant.getStudyId(),
                participant.getId(),
                participant.getAccountId(),
                participant.getParticipantRole());
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String aggregateType() {
        return "study_participant";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(participantId);
    }
}
