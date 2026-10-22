package com.studyclub.api.studygroup;

import com.studyclub.domain.participant.ParticipantRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 역할·반 일괄 변경 요청. specs/study-group/spec.md */
public record BulkUpdateParticipantRequest(
        @NotEmpty @Size(max = 200) List<@Valid ParticipantChange> changes) {

    /** participantRole·groupId 는 둘 다 옵셔널이지만 적어도 하나는 있어야 한다. 서비스에서 검증한다. */
    public record ParticipantChange(
            @NotNull Long participantId, ParticipantRole participantRole, Long groupId) {}
}
