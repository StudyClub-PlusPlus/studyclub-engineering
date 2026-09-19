package com.studyclub.api.web;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudyService {

    private final StudyRepository studyRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;

    public StudyService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyRecruitmentRepository studyRecruitmentRepository) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
    }

    @Transactional(readOnly = true)
    public StudyDetailResponse getDetail(Long studyId) {
        var study =
                studyRepository
                        .findByIdAndIsHiddenFalse(studyId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));
        Instant recruitDeadlineAt =
                studyRecruitmentRepository
                        .findFirstByStudyIdOrderByIdDesc(study.getId())
                        .map(StudyRecruitment::getRecruitDeadlineAt)
                        .orElse(null);
        return StudyDetailResponse.from(study, applicantCount(study), recruitDeadlineAt);
    }

    /** 목록과 같은 쿼리를 쓴다 — 정원을 차지하는 상태 목록이 두 군데로 갈라지면 목록과 상세의 모집 상태가 어긋난다. */
    private long applicantCount(Study study) {
        if (study == null) {
            return 0;
        }
        return studyParticipantRepository.countByStudyIds(List.of(study.getId())).stream()
                .findFirst()
                .map(row -> (Long) row[1])
                .orElse(0L);
    }
}
