package com.studyclub.domain.participant;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 명부 행의 역할이 바뀌었다. 역할 일괄 변경 트랜잭션 안에서 실제로 역할이 달라진 행마다 하나 발행되고, 구독자는 커밋 뒤에 받는다
 * (specs/domain-events/spec.md).
 *
 * @param previousRole 변경 전 역할
 * @param newRole 변경 후 역할
 */
public record StudyParticipantRoleChanged(
        EventMeta meta,
        Long studyId,
        Long participantId,
        Long accountId,
        ParticipantRole previousRole,
        ParticipantRole newRole)
        implements DomainEvent {

    public static final String NAME = "study_participant.role_changed";

    public static StudyParticipantRoleChanged of(
            Long actorAccountId, StudyParticipant participant, ParticipantRole previousRole) {
        return new StudyParticipantRoleChanged(
                EventMeta.now(actorAccountId),
                participant.getStudyId(),
                participant.getId(),
                participant.getAccountId(),
                previousRole,
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
