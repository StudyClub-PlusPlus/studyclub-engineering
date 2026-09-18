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

    public StudyListService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
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
                                        return study.getStatus() == StudyStatus.OPEN
                                                && study.getRecruitDeadline() != null
                                                && study.getRecruitDeadline()
                                                        .isBefore(recruitDeadlineBefore);
                                    }
                                    return true;
                                })
                        .sorted(
                                Comparator.comparing(
                                        Study::getRecruitDeadline,
                                        Comparator.nullsLast(Comparator.reverseOrder())))
                        .map(
                                study -> {
                                    long count = counts.getOrDefault(study.getId(), 0L);
                                    return StudyListResponse.StudySummary.from(study, count);
                                })
                        .toList();

        long total = filtered.size();
        List<StudyListResponse.StudySummary> page =
                filtered.stream().skip(offset).limit(limit).toList();

        return new StudyListResponse(page, total, offset, limit);
    }
}
