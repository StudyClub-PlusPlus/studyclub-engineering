package com.studyclub.api.studygroup;

import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import java.time.Instant;
import java.util.List;

/** 백오피스 참여 명단. 이메일은 이 백오피스 응답에만 싣는다. specs/study-group/spec.md 「참여 명단」 */
public record StudyParticipantsResponse(
        Long studyId,
        int participantCount,
        Integer recruitmentCapacity,
        List<Group> groups,
        List<Participant> participants) {

    public record Group(Long groupId, String name, boolean isDefault, boolean canDelete) {}

    public record Participant(
            Long participantId,
            Long accountId,
            String nickname,
            String discordNickname,
            String email,
            String regionGroup,
            Long groupId,
            ParticipantRole participantRole,
            ParticipantStatus status,
            boolean captain,
            Instant joinedAt) {}
}
