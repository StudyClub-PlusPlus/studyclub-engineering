package com.studyclub.api.web;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCohortRepository;
import com.studyclub.domain.study.StudyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudyService {

    private final StudyRepository studyRepository;
    private final StudyCohortRepository studyCohortRepository;

    public StudyService(
            StudyRepository studyRepository, StudyCohortRepository studyCohortRepository) {
        this.studyRepository = studyRepository;
        this.studyCohortRepository = studyCohortRepository;
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
        return StudyDetailResponse.from(study, cohort);
    }
}
