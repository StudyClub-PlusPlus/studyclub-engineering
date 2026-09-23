package com.studyclub.api.study.query;

import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 목록 조회 조립 — 조회 결과에 파생값(모집 상태·종료 임박·단계)을 붙여 응답으로 만든다. 판정 자체는 {@link Study} 가 한다. */
@Service
@Transactional(readOnly = true)
public class StudyListQueryService {

    private final StudyListDao studyListDao;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;

    public StudyListQueryService(
            StudyListDao studyListDao,
            StudyParticipantRepository studyParticipantRepository,
            StudyRecruitmentRepository studyRecruitmentRepository) {
        this.studyListDao = studyListDao;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
    }

    public StudyListResponse list(StudyListFilter filter, int offset, int limit) {
        List<Study> studies = studyListDao.search(filter, offset, limit);
        long total = studyListDao.count(filter);
        if (studies.isEmpty()) {
            return new StudyListResponse(List.of(), total, offset, limit);
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

        return new StudyListResponse(items, total, offset, limit);
    }
}
