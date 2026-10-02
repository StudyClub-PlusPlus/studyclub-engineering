package com.studyclub.api.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 목록 조회 조립 — {@link StudyListDao} 가 가져온 결과에 파생값(모집 상태·종료 임박·단계)을 붙여 응답으로 만든다. 판정 자체는 {@link Study}
 * 가 한다.
 */
@Service
@Transactional(readOnly = true)
public class StudyListService {

    private final StudyListDao studyListDao;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final StudyProgramRepository studyProgramRepository;

    public StudyListService(
            StudyListDao studyListDao,
            StudyParticipantRepository studyParticipantRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            StudyProgramRepository studyProgramRepository) {
        this.studyListDao = studyListDao;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.studyProgramRepository = studyProgramRepository;
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

        List<StudyRecruitment> latestRecruitments =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds);

        Map<Long, Instant> deadlines =
                latestRecruitments.stream()
                        .filter(recruitment -> recruitment.getRecruitDeadlineAt() != null)
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId,
                                        StudyRecruitment::getRecruitDeadlineAt));

        Map<Long, Integer> capacities =
                latestRecruitments.stream()
                        .filter(recruitment -> recruitment.getRecruitmentCapacity() != null)
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId,
                                        StudyRecruitment::getRecruitmentCapacity));

        Map<Long, StudyProgram> programs =
                studyProgramRepository
                        .findAllByIdIn(
                                studies.stream().map(Study::getProgramId).distinct().toList())
                        .stream()
                        .collect(Collectors.toMap(StudyProgram::getId, p -> p));

        List<StudyListResponse.StudySummary> items =
                studies.stream()
                        .map(
                                study ->
                                        StudyListResponse.StudySummary.from(
                                                study,
                                                Optional.ofNullable(
                                                                programs.get(study.getProgramId()))
                                                        .orElseThrow(
                                                                () ->
                                                                        new BusinessException(
                                                                                ErrorCode.NOT_FOUND,
                                                                                "스터디 프로그램을 찾을 수 없습니다: "
                                                                                        + study
                                                                                                .getProgramId()))
                                                        .getStudyKind(),
                                                applicants.getOrDefault(study.getId(), 0L),
                                                deadlines.get(study.getId()),
                                                capacities.get(study.getId())))
                        .toList();

        return new StudyListResponse(items, total, offset, limit);
    }
}
