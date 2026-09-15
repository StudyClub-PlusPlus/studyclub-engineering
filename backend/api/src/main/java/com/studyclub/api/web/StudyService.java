package com.studyclub.api.web;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCohort;
import com.studyclub.domain.study.StudyCohortRepository;
import com.studyclub.domain.study.StudyRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudyService {

    private final StudyRepository studyRepository;
    private final StudyCohortRepository studyCohortRepository;
    private final StudyApplicationRepository studyApplicationRepository;

    public StudyService(
            StudyRepository studyRepository,
            StudyCohortRepository studyCohortRepository,
            StudyApplicationRepository studyApplicationRepository) {
        this.studyRepository = studyRepository;
        this.studyCohortRepository = studyCohortRepository;
        this.studyApplicationRepository = studyApplicationRepository;
    }

    @Transactional(readOnly = true)
    public StudyDetailResponse getDetail(Long studyId) {
        Study study =
                studyRepository
                        .findByIdAndIsHiddenFalse(studyId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));

        var cohort = studyCohortRepository.findFirstByStudyIdOrderByIdDesc(studyId).orElse(null);
        return StudyDetailResponse.from(study, cohort, applicantCount(cohort));
    }

    /** 목록과 같은 쿼리를 쓴다 — 정원을 차지하는 상태 목록이 두 군데로 갈라지면 목록과 상세의 모집 상태가 어긋난다. */
    private long applicantCount(StudyCohort cohort) {
        if (cohort == null) {
            return 0;
        }
        return studyApplicationRepository.countByCohortIds(List.of(cohort.getId())).stream()
                .findFirst()
                .map(row -> (Long) row[1])
                .orElse(0L);
    }
}
