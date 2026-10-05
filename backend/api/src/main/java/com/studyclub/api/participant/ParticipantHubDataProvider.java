package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudyDetailResponse;
import java.util.Optional;

public interface ParticipantHubDataProvider {

    Optional<ParticipatingStudyDetailResponse> findParticipatingStudyDetail(
            Long accountId, Long studyId);

    boolean studyExists(Long studyId);
}
