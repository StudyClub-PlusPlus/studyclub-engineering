package com.studyclub.api.studygroup;

import com.studyclub.domain.participant.ParticipantRole;
import java.util.List;

/** 역할·반 일괄 변경 응답. specs/study-group/spec.md */
public record BulkUpdateParticipantResponse(List<ParticipantResult> participants) {

    public record ParticipantResult(
            Long participantId, ParticipantRole participantRole, Long groupId) {}
}
