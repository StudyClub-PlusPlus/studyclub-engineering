package com.studyclub.api.study;

import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyCohort;
import com.studyclub.domain.study.StudyCohortRepository;
import com.studyclub.domain.study.StudyCohortStatus;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class StudyListService {

    private final StudyRepository studyRepository;
    private final StudyCohortRepository studyCohortRepository;
    private final StudyApplicationRepository studyApplicationRepository;

    public StudyListService(
            StudyRepository studyRepository,
            StudyCohortRepository studyCohortRepository,
            StudyApplicationRepository studyApplicationRepository) {
        this.studyRepository = studyRepository;
        this.studyCohortRepository = studyCohortRepository;
        this.studyApplicationRepository = studyApplicationRepository;
    }

    public StudyListResponse list(
            StudyCategory category,
            StudyCohortStatus status,
            String keyword,
            Instant recruitDeadlineBefore,
            int offset,
            int limit) {

        List<Study> allStudies =
                (category != null)
                        ? studyRepository.findAllByIsHiddenFalseAndCategory(category)
                        : studyRepository.findAllByIsHiddenFalse();

        if (allStudies.isEmpty()) {
            return new StudyListResponse(List.of(), 0, offset, limit);
        }

        List<Long> studyIds = allStudies.stream().map(Study::getId).toList();
        Map<Long, StudyCohort> latestCohorts =
                studyCohortRepository.findLatestByStudyIds(studyIds).stream()
                        .collect(Collectors.toMap(StudyCohort::getStudyId, Function.identity()));

        List<Long> cohortIds = latestCohorts.values().stream().map(StudyCohort::getId).toList();
        Map<Long, Long> applicantCounts = Map.of();
        if (!cohortIds.isEmpty()) {
            applicantCounts =
                    studyApplicationRepository.countByCohortIds(cohortIds).stream()
                            .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));
        }

        final Map<Long, Long> counts = applicantCounts;
        List<StudyListResponse.StudySummary> filtered =
                allStudies.stream()
                        .filter(s -> latestCohorts.containsKey(s.getId()))
                        .filter(
                                s ->
                                        keyword == null
                                                || keyword.isBlank()
                                                || s.getTitle()
                                                        .toLowerCase()
                                                        .contains(keyword.toLowerCase()))
                        .filter(
                                s -> {
                                    StudyCohort c = latestCohorts.get(s.getId());
                                    if (status != null && c.getStatus() != status) return false;
                                    if (recruitDeadlineBefore != null) {
                                        return c.getStatus() == StudyCohortStatus.OPEN
                                                && c.getRecruitDeadline() != null
                                                && c.getRecruitDeadline()
                                                        .isBefore(recruitDeadlineBefore);
                                    }
                                    return true;
                                })
                        .sorted(
                                Comparator.comparing(
                                        (Study s) ->
                                                latestCohorts.get(s.getId()).getRecruitDeadline(),
                                        Comparator.nullsLast(Comparator.reverseOrder())))
                        .map(
                                s -> {
                                    StudyCohort c = latestCohorts.get(s.getId());
                                    long count = counts.getOrDefault(c.getId(), 0L);
                                    return StudyListResponse.StudySummary.from(s, c, count);
                                })
                        .toList();

        long total = filtered.size();
        List<StudyListResponse.StudySummary> page =
                filtered.stream().skip(offset).limit(limit).toList();

        return new StudyListResponse(page, total, offset, limit);
    }
}
