package com.studyclub.api.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 백오피스 스터디 목록 조립. DRAFT 포함 전 상태를 반환하고, 모집 상태는 최신 모집 회차의 <b>신청서 수</b>로 판정한다 — 공개 목록({@link
 * StudyListService})·대시보드와 같다 (specs/dashboard/spec.md · study-recruit-status).
 */
@Service
@Transactional(readOnly = true)
public class BackofficeStudyListService {

    private static final Logger log = LoggerFactory.getLogger(BackofficeStudyListService.class);

    private final BackofficeStudyDao backofficeStudyDao;
    private final StudyApplicationRepository studyApplicationRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyProgramRepository studyProgramRepository;
    private final AccountRepository accountRepository;
    private final ObjectMapper objectMapper;

    public BackofficeStudyListService(
            BackofficeStudyDao backofficeStudyDao,
            StudyApplicationRepository studyApplicationRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyProgramRepository studyProgramRepository,
            AccountRepository accountRepository,
            ObjectMapper objectMapper) {
        this.backofficeStudyDao = backofficeStudyDao;
        this.studyApplicationRepository = studyApplicationRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyProgramRepository = studyProgramRepository;
        this.accountRepository = accountRepository;
        this.objectMapper = objectMapper;
    }

    public BackofficeStudyListResponse getStudies(
            BackofficeStudyListFilter filter, int offset, int limit) {
        validate(filter, offset, limit);
        Instant asOf = Instant.now();

        if (needsInMemoryRecruitPipeline(filter)) {
            return listWithRecruitPipeline(filter, asOf, offset, limit);
        }

        long total = backofficeStudyDao.count(filter);
        if (total == 0) {
            return new BackofficeStudyListResponse(List.of(), 0, offset, limit);
        }
        List<Study> studies = backofficeStudyDao.getStudies(filter, offset, limit);
        if (studies.isEmpty()) {
            return new BackofficeStudyListResponse(List.of(), total, offset, limit);
        }
        return new BackofficeStudyListResponse(toSummaries(studies, asOf), total, offset, limit);
    }

    private void validate(BackofficeStudyListFilter filter, int offset, int limit) {
        if (offset < 0 || limit < 1 || limit > 100) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset·limit 이 올바르지 않습니다.");
        }
        if (filter.effectiveSort() == BackofficeStudySort.RECRUITMENT
                && filter.status() != StudyStatus.OPEN) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "sort=RECRUITMENT 는 status=OPEN 과 함께 요청해야 합니다.");
        }
    }

    private static boolean needsInMemoryRecruitPipeline(BackofficeStudyListFilter filter) {
        return filter.recruitStatus() != null
                || filter.effectiveSort() == BackofficeStudySort.RECRUITMENT;
    }

    private BackofficeStudyListResponse listWithRecruitPipeline(
            BackofficeStudyListFilter filter, Instant asOf, int offset, int limit) {
        List<Study> studies = backofficeStudyDao.getAllMatching(filter);
        List<BackofficeStudyListResponse.StudySummary> all = toSummaries(studies, asOf);

        if (filter.recruitStatus() != null) {
            all = all.stream().filter(s -> s.recruitStatus() == filter.recruitStatus()).toList();
        }

        if (filter.effectiveSort() == BackofficeStudySort.RECRUITMENT) {
            all = all.stream().sorted(recruitmentComparator()).toList();
        } else if (filter.effectiveSort() == BackofficeStudySort.TITLE_ASC) {
            all =
                    all.stream()
                            .sorted(
                                    Comparator.comparing(
                                                    BackofficeStudyListResponse.StudySummary::title,
                                                    Comparator.nullsLast(String::compareTo))
                                            .thenComparing(
                                                    BackofficeStudyListResponse.StudySummary
                                                            ::studyId))
                            .toList();
        } else {
            all =
                    all.stream()
                            .sorted(
                                    Comparator.comparing(
                                                    BackofficeStudyListResponse.StudySummary
                                                            ::studyId)
                                            .reversed())
                            .toList();
        }

        long total = all.size();
        int from = Math.min(offset, all.size());
        int to = Math.min(offset + limit, all.size());
        return new BackofficeStudyListResponse(all.subList(from, to), total, offset, limit);
    }

    private List<BackofficeStudyListResponse.StudySummary> toSummaries(
            List<Study> studies, Instant asOf) {
        if (studies.isEmpty()) {
            return List.of();
        }
        List<Long> studyIds = studies.stream().map(Study::getId).toList();

        Map<Long, StudyRecruitment> latestRecruitments =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId, r -> r, (a, b) -> a));

        List<Long> recruitmentIds =
                latestRecruitments.values().stream().map(StudyRecruitment::getId).toList();
        Map<Long, Long> applicationsByRecruitmentId =
                recruitmentIds.isEmpty()
                        ? Map.of()
                        : studyApplicationRepository.countByRecruitmentIdIn(recruitmentIds).stream()
                                .collect(
                                        Collectors.toMap(
                                                row -> (Long) row[0], row -> (Long) row[1]));

        Map<Long, StudyProgram> programs =
                studyProgramRepository
                        .findAllByIdIn(
                                studies.stream().map(Study::getProgramId).distinct().toList())
                        .stream()
                        .collect(Collectors.toMap(StudyProgram::getId, p -> p));

        // 작성자 닉네임 — 한 번에 받는다(행마다 부르면 N+1)
        List<Long> authorIds =
                studies.stream()
                        .map(Study::getCreatedBy)
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList();
        Map<Long, String> authorNicknames =
                authorIds.isEmpty()
                        ? Map.of()
                        : accountRepository.findAllById(authorIds).stream()
                                .filter(a -> a.getNickname() != null)
                                .collect(Collectors.toMap(Account::getId, Account::getNickname));

        return studies.stream()
                .map(
                        study -> {
                            StudyRecruitment recruitment = latestRecruitments.get(study.getId());
                            Integer capacity =
                                    recruitment != null
                                            ? recruitment.getRecruitmentCapacity()
                                            : null;
                            Instant deadline =
                                    recruitment != null ? recruitment.getRecruitDeadlineAt() : null;
                            long applicants =
                                    recruitment == null
                                            ? 0L
                                            : applicationsByRecruitmentId.getOrDefault(
                                                    recruitment.getId(), 0L);
                            return new BackofficeStudyListResponse.StudySummary(
                                    study.getId(),
                                    study.getProgramId(),
                                    study.getTitle(),
                                    study.getStatus(),
                                    study.getCategory(),
                                    programs.get(study.getProgramId()).getStudyKind(),
                                    capacity,
                                    applicants,
                                    study.recruitStatus(applicants, deadline, capacity, asOf),
                                    recruitment != null ? recruitment.getStartAt() : null,
                                    deadline,
                                    study.getStartAt(),
                                    study.getTimezone(),
                                    hasQuestions(study.getApplicationForm()),
                                    study.getCreatedBy() == null
                                            ? null
                                            : authorNicknames.get(study.getCreatedBy()));
                        })
                .toList();
    }

    /** 모집 보드와 같은 정렬 — RECRUITING 먼저, 마감 시각 오름차순(없으면 마지막), 동률은 제목·기수 ID. */
    static Comparator<BackofficeStudyListResponse.StudySummary> recruitmentComparator() {
        return Comparator.comparingInt(
                        (BackofficeStudyListResponse.StudySummary s) ->
                                s.recruitStatus() == RecruitStatus.RECRUITING ? 0 : 1)
                .thenComparing(s -> s.recruitDeadlineAt() == null ? 1 : 0)
                .thenComparing(
                        BackofficeStudyListResponse.StudySummary::recruitDeadlineAt,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(
                        BackofficeStudyListResponse.StudySummary::title,
                        Comparator.nullsLast(String::compareTo))
                .thenComparing(BackofficeStudyListResponse.StudySummary::studyId);
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
