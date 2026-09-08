package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubResponses.ParticipantHubOverviewResponse;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudyCohortDetailResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import org.springframework.stereotype.Service;

@Service
public class ParticipantHubQueryService {

    private final ParticipantHubDataProvider dataProvider;

    public ParticipantHubQueryService(ParticipantHubDataProvider dataProvider) {
        this.dataProvider = dataProvider;
    }

    public ParticipantHubOverviewResponse getParticipantHubOverview(String accountEmail) {
        return dataProvider.getParticipantHubOverview(accountEmail);
    }

    public ParticipatingStudyCohortDetailResponse getParticipatingStudyCohortDetail(
            String accountEmail, Long cohortId) {
        return dataProvider.findParticipatingStudyCohortDetail(accountEmail, cohortId)
                .orElseThrow(() -> inaccessibleStudyCohort(cohortId));
    }

    private BusinessException inaccessibleStudyCohort(Long cohortId) {
        if (dataProvider.studyCohortExists(cohortId)) {
            return new BusinessException(ErrorCode.FORBIDDEN, "참여 중인 스터디가 아닙니다.");
        }
        return new BusinessException(ErrorCode.NOT_FOUND, "스터디 기수를 찾을 수 없습니다.");
    }
}
