package com.studyclub.api.study;

import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
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
    private final StudyProgramRepository studyProgramRepository;
    private final StudyRepository studyRepository;
    private final StudyParticipantRepository studyParticipantRepository;

    public StudyListService(
            StudyRepository studyRepository,
            StudyProgramRepository studyProgramRepository,
            StudyParticipantRepository studyParticipantRepository) {
        this.studyRepository = studyRepository;
        this.studyProgramRepository = studyProgramRepository;
        this.studyParticipantRepository = studyParticipantRepository;
    }

    public StudyListResponse list(
            StudyCategory category,
            StudyStatus status,
            String keyword,
            Instant recruitDeadlineBefore,
            int offset,
            int limit) {

        List<StudyProgram> allStudyPrograms =
                (category != null)
                        ? studyProgramRepository.findAllByIsHiddenFalseAndCategory(category)
                        : studyProgramRepository.findAllByIsHiddenFalse();

        if (allStudyPrograms.isEmpty()) {
            return new StudyListResponse(List.of(), 0, offset, limit);
        }

        List<Long> studyProgramIds = allStudyPrograms.stream().map(StudyProgram::getId).toList();
        Map<Long, Study> latestStudies =
                studyRepository.findLatestByProgramIds(studyProgramIds).stream()
                        .collect(Collectors.toMap(Study::getProgramId, Function.identity()));

        List<Long> studyIds = latestStudies.values().stream().map(Study::getId).toList();
        Map<Long, Long> counts =
                studyParticipantRepository.countByCohortIds(studyIds).stream()
                        .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));
        List<StudyListResponse.StudySummary> filtered =
                allStudyPrograms.stream()
                        .filter(studyProgram -> latestStudies.containsKey(studyProgram.getId()))
                        .filter(
                                studyProgram ->
                                        keyword == null
                                                || keyword.isBlank()
                                                || studyProgram
                                                        .getTitle()
                                                        .toLowerCase()
                                                        .contains(keyword.toLowerCase()))
                        .filter(
                                studyProgram -> {
                                    Study s = latestStudies.get(studyProgram.getId());
                                    if (status != null && s.getStatus() != status) return false;
                                    if (recruitDeadlineBefore != null) {
                                        return s.getStatus() == StudyStatus.OPEN
                                                && s.getRecruitDeadline() != null
                                                && s.getRecruitDeadline()
                                                        .isBefore(recruitDeadlineBefore);
                                    }
                                    return true;
                                })
                        .sorted(
                                Comparator.comparing(
                                        (StudyProgram studyProgram) ->
                                                latestStudies
                                                        .get(studyProgram.getId())
                                                        .getRecruitDeadline(),
                                        Comparator.nullsLast(Comparator.reverseOrder())))
                        .map(
                                studyProgram -> {
                                    Study study = latestStudies.get(studyProgram.getId());
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
