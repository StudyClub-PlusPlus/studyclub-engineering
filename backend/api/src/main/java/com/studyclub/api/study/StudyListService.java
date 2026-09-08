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

/**
 * 스터디 목록 조회 — 애플리케이션 서비스.
 * 리포지토리로 데이터를 가져오고, 필터링·정렬·DTO 변환만 한다.
 */
@Service
@Transactional(readOnly = true)
public class StudyListService {

    private final StudyRepository studies;
    private final StudyCohortRepository cohorts;
    private final StudyApplicationRepository applications;

    public StudyListService(StudyRepository studies,
                            StudyCohortRepository cohorts,
                            StudyApplicationRepository applications) {
        this.studies = studies;
        this.cohorts = cohorts;
        this.applications = applications;
    }

    public StudyListResponse list(StudyCategory category,
                                  StudyCohortStatus status,
                                  String keyword,
                                  Instant recruitDeadlineBefore,
                                  int offset,
                                  int limit) {

        // 1. 리포지토리에서 공개 스터디 조회
        List<Study> allStudies = (category != null)
                ? studies.findAllByIsHiddenFalseAndCategory(category)
                : studies.findAllByIsHiddenFalse();

        if (allStudies.isEmpty()) {
            return new StudyListResponse(List.of(), 0, offset, limit);
        }

        // 2. 스터디별 최신 코호트 조회
        List<Long> studyIds = allStudies.stream().map(Study::getId).toList();
        Map<Long, StudyCohort> latestCohorts = cohorts.findLatestByStudyIds(studyIds)
                .stream()
                .collect(Collectors.toMap(StudyCohort::getStudyId, Function.identity()));

        // 3. 코호트별 신청자 수
        List<Long> cohortIds = latestCohorts.values().stream().map(StudyCohort::getId).toList();
        Map<Long, Long> applicantCounts = Map.of();
        if (!cohortIds.isEmpty()) {
            applicantCounts = applications.countByCohortIds(cohortIds)
                    .stream()
                    .collect(Collectors.toMap(
                            row -> (Long) row[0],
                            row -> (Long) row[1]));
        }

        // 4. 필터 (키워드·상태·마감일)
        final Map<Long, Long> counts = applicantCounts;
        List<StudyListResponse.StudySummary> filtered = allStudies.stream()
                .filter(s -> latestCohorts.containsKey(s.getId()))
                .filter(s -> keyword == null || keyword.isBlank()
                        || s.getTitle().toLowerCase().contains(keyword.toLowerCase()))
                .filter(s -> {
                    StudyCohort c = latestCohorts.get(s.getId());
                    if (status != null && c.getStatus() != status) return false;
                    if (recruitDeadlineBefore != null) {
                        return c.getStatus() == StudyCohortStatus.OPEN
                                && c.getRecruitDeadline() != null
                                && c.getRecruitDeadline().isBefore(recruitDeadlineBefore);
                    }
                    return true;
                })
                .sorted(Comparator.comparing(
                        (Study s) -> latestCohorts.get(s.getId()).getRecruitDeadline(),
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(s -> {
                    StudyCohort c = latestCohorts.get(s.getId());
                    long count = counts.getOrDefault(c.getId(), 0L);
                    return StudyListResponse.StudySummary.from(s, c, count);
                })
                .toList();

        // 5. 페이지네이션
        long total = filtered.size();
        List<StudyListResponse.StudySummary> page = filtered.stream()
                .skip(offset)
                .limit(limit)
                .toList();

        return new StudyListResponse(page, total, offset, limit);
    }
}
