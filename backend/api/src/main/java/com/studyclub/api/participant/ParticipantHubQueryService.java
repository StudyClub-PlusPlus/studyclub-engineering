package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubResponses.ParticipantHubOverviewResponse;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudyCohortDetailResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import org.springframework.stereotype.Service;

@Service
public class ParticipantHubQueryService {

    private final ParticipantHubDataProvider participantHubDataProvider;

    public ParticipantHubQueryService(ParticipantHubDataProvider participantHubDataProvider) {
        this.participantHubDataProvider = participantHubDataProvider;
    }

    public ParticipantHubOverviewResponse getParticipantHubOverview(Long accountId) {
        return participantHubDataProvider.getParticipantHubOverview(accountId);
    }

    public ParticipatingStudyCohortDetailResponse getParticipatingStudyCohortDetail(
            Long accountId, Long cohortId) {
        return participantHubDataProvider
                .findParticipatingStudyCohortDetail(accountId, cohortId)
                .orElseThrow(() -> inaccessibleStudyCohort(cohortId));
    }

    private BusinessException inaccessibleStudyCohort(Long cohortId) {
        if (participantHubDataProvider.studyCohortExists(cohortId)) {
            return new BusinessException(ErrorCode.FORBIDDEN, "참여 중인 스터디가 아닙니다.");
        }
        return new BusinessException(ErrorCode.NOT_FOUND, "스터디 기수를 찾을 수 없습니다.");
    }
}
