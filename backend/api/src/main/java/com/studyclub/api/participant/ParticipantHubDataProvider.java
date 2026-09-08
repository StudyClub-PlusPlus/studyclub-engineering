package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubResponses.ParticipantHubOverviewResponse;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudyCohortDetailResponse;
import java.util.Optional;

public interface ParticipantHubDataProvider {

    ParticipantHubOverviewResponse getParticipantHubOverview(String accountEmail);

    Optional<ParticipatingStudyCohortDetailResponse> findParticipatingStudyCohortDetail(
            String accountEmail, Long cohortId);

    boolean studyCohortExists(Long cohortId);
}
