package com.studyclub.api.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.time.TimeZoneLabels;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.RecruitmentTimeZones;
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

    /**
     * @param displayTimeZone {@code *Formatted} 를 만들 시간대 — 컨트롤러가 정한다
     */
    public StudyListResponse list(
            StudyListFilter filter, int offset, int limit, String displayTimeZone) {
        Instant now = Instant.now();
        List<Study> studies = studyListDao.search(filter, offset, limit);
        long total = studyListDao.count(filter);
        if (studies.isEmpty()) {
            return new StudyListResponse(List.of(), total, offset, limit, displayTimeZone);
        }

        List<Long> studyIds = studies.stream().map(Study::getId).toList();

        List<StudyRecruitment> latestRecruitments =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds);

        // 정원을 차지하는 인원 — 명부 ACTIVE 중 정원 역할 (결정 D4-A, study-recruit-status/spec.md)
        Map<Long, Long> crewCounts =
                studyParticipantRepository
                        .countCapacityHoldersByStudyIds(studyIds, ParticipantRole.CAPACITY_ROLES)
                        .stream()
                        .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));

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

        // 모집 회차 지역은 @BatchSize 로 한 번에 읽힌다
        Map<Long, RecruitmentTimeZones> timeZones =
                latestRecruitments.stream()
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId, StudyRecruitment::timeZones));

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
                                                crewCounts.getOrDefault(study.getId(), 0L),
                                                deadlines.get(study.getId()),
                                                capacities.get(study.getId()),
                                                timeZones.getOrDefault(
                                                        study.getId(), RecruitmentTimeZones.UNSET),
                                                displayTimeZone,
                                                now))
                        .toList();

        return new StudyListResponse(items, total, offset, limit, displayTimeZone);
    }

    /**
     * 사이트 목록의 모집 시간대 필터 후보 — 공개 스터디 전체(종료 포함)의 {@code selected} 지역. 다른 필터 · 페이지와 무관하다
     * (specs/timezone/spec.md §3.2).
     */
    public RecruitmentZoneCandidatesResponse recruitmentZoneCandidates() {
        return new RecruitmentZoneCandidatesResponse(
                TimeZoneLabels.sorted(studyListDao.recruitmentZones()).stream()
                        .map(RecruitmentZoneCandidatesResponse.Item::of)
                        .toList());
    }
}
