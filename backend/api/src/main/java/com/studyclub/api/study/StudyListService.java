package com.studyclub.api.study;

import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.*;
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
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;

    public StudyListService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyRecruitmentRepository studyRecruitmentRepository) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
    }

    public StudyListResponse list(
            StudyCategory category,
            StudyStatus status,
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

        // TODO: come back to this logic. There is a caveat with this approach. It is possible that
        // a study 1 is active (i.e. on going)
        // and study 2 is accepting participant for near future. Then this will only show study 2
        // when we want study 1 as well.
        // Not touching in table-structure task as this is business logic and it is not the
        // restructure scope.
        Map<Long, Study> latestStudies =
                allStudies.stream()
                        .collect(
                                Collectors.toMap(
                                        Study::getProgramId,
                                        Function.identity(),
                                        (a, b) -> a.getId() > b.getId() ? a : b));

        List<Long> studyIds = latestStudies.values().stream().map(Study::getId).toList();

        Map<Long, Long> counts =
                studyParticipantRepository.countByStudyIds(studyIds).stream()
                        .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));

        // studyId → 가장 최근(id 최대) 모집 회차의 마감 시각 (DB에서 1건씩 추출)
        Map<Long, Instant> deadlines =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId,
                                        StudyRecruitment::getRecruitDeadlineAt));

        List<StudyListResponse.StudySummary> filtered =
                latestStudies.values().stream()
                        .filter(
                                study ->
                                        keyword == null
                                                || keyword.isBlank()
                                                || study.getTitle()
                                                        .toLowerCase()
                                                        .contains(keyword.toLowerCase()))
                        .filter(
                                study -> {
                                    if (status != null && study.getStatus() != status) return false;
                                    if (recruitDeadlineBefore != null) {
                                        Instant deadline = deadlines.get(study.getId());
                                        return study.getStatus() == StudyStatus.OPEN
                                                && deadline != null
                                                && deadline.isBefore(recruitDeadlineBefore);
                                    }
                                    return true;
                                })
                        .sorted(
                                Comparator.comparing(
                                        study -> deadlines.get(study.getId()),
                                        Comparator.nullsLast(Comparator.reverseOrder())))
                        .map(
                                study -> {
                                    long count = counts.getOrDefault(study.getId(), 0L);
                                    Instant deadline = deadlines.get(study.getId());
                                    return StudyListResponse.StudySummary.from(
                                            study, count, deadline);
                                })
                        .toList();

        long total = filtered.size();
        List<StudyListResponse.StudySummary> page =
                filtered.stream().skip(offset).limit(limit).toList();

        return new StudyListResponse(page, total, offset, limit);
    }
}
