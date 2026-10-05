package com.studyclub.api.study;

import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** 백오피스 스터디 목록 조립. DRAFT 포함 전 상태를 반환하고, 모집 정원을 붙인다. */
@Service
@Transactional(readOnly = true)
public class BackofficeStudyListService {

    private static final Logger log = LoggerFactory.getLogger(BackofficeStudyListService.class);

    private final BackofficeStudyDao backofficeStudyDao;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyProgramRepository studyProgramRepository;
    private final ObjectMapper objectMapper;

    public BackofficeStudyListService(
            BackofficeStudyDao backofficeStudyDao,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyProgramRepository studyProgramRepository,
            ObjectMapper objectMapper) {
        this.backofficeStudyDao = backofficeStudyDao;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyProgramRepository = studyProgramRepository;
        this.objectMapper = objectMapper;
    }

    public BackofficeStudyListResponse getStudies(
            BackofficeStudyListFilter filter, int offset, int limit) {
        long total = backofficeStudyDao.count(filter);
        if (total == 0) {
            return new BackofficeStudyListResponse(List.of(), 0, offset, limit);
        }
        List<Study> studies = backofficeStudyDao.getStudies(filter, offset, limit);
        // offset 이 마지막 페이지를 넘으면 빈 페이지다 — 빈 IN () 조회로 넘기지 않는다
        if (studies.isEmpty()) {
            return new BackofficeStudyListResponse(List.of(), total, offset, limit);
        }

        List<Long> studyIds = studies.stream().map(Study::getId).toList();

        Map<Long, StudyRecruitment> latestRecruitments =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId, r -> r, (a, b) -> a));

        Map<Long, StudyProgram> programs =
                studyProgramRepository
                        .findAllByIdIn(
                                studies.stream().map(Study::getProgramId).distinct().toList())
                        .stream()
                        .collect(Collectors.toMap(StudyProgram::getId, p -> p));

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
                                            programs.get(study.getProgramId()).getStudyKind(),
                                            recruitment != null
                                                    ? recruitment.getRecruitmentCapacity()
                                                    : null,
                                            recruitment != null ? recruitment.getStartAt() : null,
                                            recruitment != null
                                                    ? recruitment.getRecruitDeadlineAt()
                                                    : null,
                                            study.getStartAt(),
                                            study.timezone(),
                                            hasQuestions(study.getApplicationForm()));
                                })
                        .toList();

        return new BackofficeStudyListResponse(items, total, offset, limit);
    }

    private boolean hasQuestions(String applicationForm) {
        if (applicationForm == null || applicationForm.isBlank()) return false;
        try {
            JsonNode root = objectMapper.readTree(applicationForm);
            if (root.isTextual()) {
                root = objectMapper.readTree(root.asText());
            }
            JsonNode questions = root.get("questions");
            return questions != null && questions.isArray() && questions.size() > 0;
        } catch (Exception e) {
            log.warn("신청 폼 파싱 실패 — 폼 없음으로 처리", e);
            return false;
        }
    }
}
