package com.studyclub.domain.application;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitment;
import java.time.Instant;
import java.util.List;

public class StudyEnrollment {

    private final StudyApplicationRepository applications;
    private final StudyParticipantRepository participants;

    public StudyEnrollment(
            StudyApplicationRepository applications, StudyParticipantRepository participants) {
        this.applications = applications;
        this.participants = participants;
    }

    public StudyApplication enroll(
            StudyApplication application,
            StudyRecruitment recruitment,
            Study study,
            Long accountId,
            Long studyGroupId,
            Instant now) {
        if (applications.existsByRecruitmentIdAndAccountId(recruitment.getId(), accountId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 신청한 스터디입니다.");
        }
        boolean alreadyParticipant =
                participants.existsByStudyIdAndAccountId(study.getId(), accountId);
        long activeParticipantCount =
                participants.countByStudyIdAndStatusIn(
                        study.getId(), List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED));
        if (!alreadyParticipant && study.isFull(activeParticipantCount)) {
            throw new BusinessException(ErrorCode.CONFLICT, "정원이 가득 찼습니다.");
        }

        StudyApplication saved = applications.save(application);
        if (!alreadyParticipant) {
            participants.save(
                    StudyParticipant.builder()
                            .accountId(accountId)
                            .studyGroupId(studyGroupId)
                            .studyId(study.getId())
                            .status(ParticipantStatus.ACTIVE)
                            .participantRole(ParticipantRole.MEMBER)
                            .joinedAt(now)
                            .build());
        }
        return saved;
    }
}
