package com.studyclub.domain.application;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitment;
import java.util.List;

public class StudyApplicationSubmission {

    private final StudyApplicationRepository applications;
    private final StudyParticipantRepository participants;

    public StudyApplicationSubmission(
            StudyApplicationRepository applications, StudyParticipantRepository participants) {
        this.applications = applications;
        this.participants = participants;
    }

    public StudyApplication submit(
            StudyApplication application,
            StudyRecruitment recruitment,
            Study study,
            Long accountId) {
        if (applications.existsByRecruitmentIdAndAccountId(recruitment.getId(), accountId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 신청한 스터디입니다.");
        }
        long activeParticipantCount =
                participants.countByStudyIdAndStatusIn(
                        study.getId(), List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED));
        if (study.isFull(activeParticipantCount)) {
            throw new BusinessException(ErrorCode.CONFLICT, "정원이 가득 찼습니다.");
        }
        return applications.save(application);
    }
}
