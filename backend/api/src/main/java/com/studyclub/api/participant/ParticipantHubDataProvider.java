package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubResponses.ParticipantHubOverviewResponse;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudyDetailResponse;
import java.util.Optional;

public interface ParticipantHubDataProvider {

    ParticipantHubOverviewResponse getParticipantHubOverview(Long accountId);

    Optional<ParticipatingStudyDetailResponse> findParticipatingStudyDetail(
            Long accountId, Long studyId);

    boolean studyExists(Long studyId);
}
