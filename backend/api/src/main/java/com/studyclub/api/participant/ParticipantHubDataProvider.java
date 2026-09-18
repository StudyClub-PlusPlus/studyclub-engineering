package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubResponses.ParticipantHubOverviewResponse;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudyCohortDetailResponse;
import java.util.Optional;

public interface ParticipantHubDataProvider {

    ParticipantHubOverviewResponse getParticipantHubOverview(Long accountId);

    Optional<ParticipatingStudyCohortDetailResponse> findParticipatingStudyCohortDetail(
            Long accountId, Long cohortId);

    boolean studyCohortExists(Long cohortId);
}
