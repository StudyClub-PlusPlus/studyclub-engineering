package com.studyclub.api.study;

import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 백오피스 스터디 목록 조립. DRAFT 포함 전 상태를 반환하고, 모집 정원을 붙인다. */
@Service
@Transactional(readOnly = true)
public class BackofficeStudyListService {

    private final BackofficeStudyDao backofficeStudyDao;
    private final StudyRecruitmentRepository studyRecruitmentRepository;

    public BackofficeStudyListService(
            BackofficeStudyDao backofficeStudyDao,
            StudyRecruitmentRepository studyRecruitmentRepository) {
        this.backofficeStudyDao = backofficeStudyDao;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
    }

    public BackofficeStudyListResponse getStudies(BackofficeStudyListFilter filter) {
        List<Study> studies = backofficeStudyDao.getStudies(filter);

        if (studies.isEmpty()) {
            return new BackofficeStudyListResponse(List.of());
        }

        List<Long> studyIds = studies.stream().map(Study::getId).toList();

        Map<Long, StudyRecruitment> latestRecruitments =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId, r -> r, (a, b) -> a));

        List<BackofficeStudyListResponse.StudySummary> items =
                studies.stream()
                        .map(
                                study -> {
                                    StudyRecruitment recruitment =
                                            latestRecruitments.get(study.getId());
                                    return new BackofficeStudyListResponse.StudySummary(
                                            study.getId(),
                                            study.getTitle(),
                                            study.getStatus(),
                                            study.getCategory(),
                                            study.getStudyKind(),
                                            recruitment != null
                                                    ? recruitment.getRecruitmentCapacity()
                                                    : null,
                                            recruitment != null ? recruitment.getStartAt() : null,
                                            recruitment != null
                                                    ? recruitment.getRecruitDeadlineAt()
                                                    : null,
                                            study.getStartAt(),
                                            study.timezone());
                                })
                        .toList();

        return new BackofficeStudyListResponse(items);
    }
}
