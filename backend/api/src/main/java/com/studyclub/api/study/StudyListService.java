package com.studyclub.api.study;

import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyListFilter;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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

    public StudyListResponse list(StudyListFilter filter, int offset, int limit) {
        List<Study> studies = studyRepository.search(filter, offset, limit);
        if (studies.isEmpty()) {
            return new StudyListResponse(List.of(), studyRepository.count(filter), offset, limit);
        }

        List<Long> studyIds = studies.stream().map(Study::getId).toList();

        Map<Long, Long> applicants =
                studyParticipantRepository.countByStudyIds(studyIds).stream()
                        .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));

        Map<Long, Instant> deadlines =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds).stream()
                        .filter(recruitment -> recruitment.getRecruitDeadlineAt() != null)
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId,
                                        StudyRecruitment::getRecruitDeadlineAt));

        List<StudyListResponse.StudySummary> items =
                studies.stream()
                        .map(
                                study ->
                                        StudyListResponse.StudySummary.from(
                                                study,
                                                applicants.getOrDefault(study.getId(), 0L),
                                                deadlines.get(study.getId())))
                        .toList();

        return new StudyListResponse(items, studyRepository.count(filter), offset, limit);
    }
}
