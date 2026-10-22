package com.studyclub.api.studygroup;

import com.studyclub.domain.participant.ParticipantRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 역할 일괄 변경 요청. specs/study-group/spec.md */
public record BulkUpdateParticipantRequest(
        @NotEmpty @Size(max = 200) @Valid List<ParticipantChange> changes) {

    public record ParticipantChange(
            @NotNull Long participantId, @NotNull ParticipantRole participantRole) {}
}
