package com.studyclub.api.study;

import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import java.util.List;
import java.util.Map;
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

    public StudyListService(
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

        // 회차를 통째로 담는다 — 마감 시각과 정원이 둘 다 이 회차 소관이라, 둘을 따로 모으면 서로 다른 회차의 값이 섞일 수 있다
        Map<Long, StudyRecruitment> latestRecruitments =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId, r -> r, (a, b) -> a));

        List<StudyListResponse.StudySummary> items =
                studies.stream()
                        .map(
                                study -> {
                                    StudyRecruitment recruitment =
                                            latestRecruitments.get(study.getId());
                                    return StudyListResponse.StudySummary.from(
                                            study,
                                            applicants.getOrDefault(study.getId(), 0L),
                                            recruitment != null
                                                    ? recruitment.getRecruitDeadlineAt()
                                                    : null,
                                            recruitment != null
                                                    ? recruitment.getRecruitmentCapacity()
                                                    : null);
                                })
                        .toList();

        return new StudyListResponse(items, total, offset, limit);
    }
}
