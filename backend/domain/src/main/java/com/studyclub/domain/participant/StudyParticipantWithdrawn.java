package com.studyclub.domain.participant;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 명부 행이 참여 중단(WITHDRAWN)됐다. 출석 저장 트랜잭션 안에서 행마다 하나 발행되고, 구독자는 커밋 뒤에 받는다
 * (specs/domain-events/spec.md). 이미 중단된 행을 다시 보내면 발행하지 않는다. 디스코드 스터디 role 회수(DSC-09)가 듣는다.
 *
 * @param participantRole 중단 직전 역할 — 네비게이터였으면 구독자가 네비게이터 role 도 본다
 */
public record StudyParticipantWithdrawn(
        EventMeta meta,
        Long studyId,
        Long participantId,
        Long accountId,
        ParticipantRole participantRole)
        implements DomainEvent {

    public static final String NAME = "study_participant.withdrawn";

    /** 행위자 = 중단시킨 사람(네비게이터·담당 캡틴). */
    public static StudyParticipantWithdrawn of(Long actorAccountId, StudyParticipant participant) {
        return new StudyParticipantWithdrawn(
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
