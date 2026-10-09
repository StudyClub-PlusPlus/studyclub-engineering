package com.studyclub.api.study;

import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import java.time.Instant;
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
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyProgramRepository studyProgramRepository;
    private final ObjectMapper objectMapper;

    public BackofficeStudyListService(
            BackofficeStudyDao backofficeStudyDao,
            StudyParticipantRepository studyParticipantRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyProgramRepository studyProgramRepository,
            ObjectMapper objectMapper) {
        this.backofficeStudyDao = backofficeStudyDao;
        this.studyParticipantRepository = studyParticipantRepository;
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

        // 정원 인원 = 명부 ACTIVE · 정원 역할 — 신청 검사와 같은 기준 (POL-0004)
        Map<Long, Long> applicantCounts =
                studyParticipantRepository
                        .countCapacityHoldersByStudyIds(studyIds, ParticipantRole.CAPACITY_ROLES)
                        .stream()
                        .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));

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
                                    long applicants =
                                            applicantCounts.getOrDefault(study.getId(), 0L);
                                    Integer capacity =
                                            recruitment != null
                                                    ? recruitment.getRecruitmentCapacity()
                                                    : null;
                                    Instant deadline =
                                            recruitment != null
                                                    ? recruitment.getRecruitDeadlineAt()
                                                    : null;
                                    return new BackofficeStudyListResponse.StudySummary(
                                            study.getId(),
                                            study.getProgramId(),
                                            study.getTitle(),
                                            study.getStatus(),
                                            study.getCategory(),
                                            programs.get(study.getProgramId()).getStudyKind(),
                                            capacity,
                                            applicants,
                                            // 모집 상태는 서버가 판정해 내려준다 — 프론트가 날짜·인원으로 다시 계산하지 않게
                                            study.recruitStatus(applicants, deadline, capacity),
                                            recruitment != null ? recruitment.getStartAt() : null,
                                            deadline,
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
            JsonNode questions = root.isArray() ? root : root.get("questions");
            return questions != null && questions.isArray() && questions.size() > 0;
        } catch (Exception e) {
            log.warn("신청 폼 파싱 실패 — 폼 없음으로 처리", e);
            return false;
        }
    }
}
