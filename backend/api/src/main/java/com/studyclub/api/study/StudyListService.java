package com.studyclub.api.study;

import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipantCounts;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.*;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
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

    /** 필터·정렬에 쓰는 값을 스터디 하나에 한 번만 계산해 묶어 둔다. */
    private record Row(
            Study study, StudyParticipantCounts counts, Instant deadline, StudyPhase phase) {}

    // ponytail: 필터·정렬·페이지네이션을 메모리에서 한다. 공개 스터디 수백 건을 넘기면 쿼리로 내린다
    public StudyListResponse list(StudyListCondition condition, int offset, int limit) {
        // DRAFT 는 공개 목록에 내보내지 않는다 (스펙 AC-2)
        List<Study> allStudies =
                (condition.category() != null)
                        ? studyRepository.findAllByIsHiddenFalseAndStatusNotAndCategory(
                                StudyStatus.DRAFT, condition.category())
                        : studyRepository.findAllByIsHiddenFalseAndStatusNot(StudyStatus.DRAFT);

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

        Map<Long, StudyParticipantCounts> counts =
                studyParticipantRepository.countByStudyIdsGroupByStatus(studyIds).stream()
                        .collect(
                                Collectors.groupingBy(
                                        row -> (Long) row[0],
                                        Collectors.collectingAndThen(
                                                Collectors.toMap(
                                                        row -> (ParticipantStatus) row[1],
                                                        row -> (Long) row[2]),
                                                StudyParticipantCounts::of)));

        // studyId → 가장 최근(id 최대) 모집 회차의 마감 시각 (DB에서 1건씩 추출)
        Map<Long, Instant> deadlines =
                studyRecruitmentRepository.findLatestByStudyIdIn(studyIds).stream()
                        .filter(recruitment -> recruitment.getRecruitDeadlineAt() != null)
                        .collect(
                                Collectors.toMap(
                                        StudyRecruitment::getStudyId,
                                        StudyRecruitment::getRecruitDeadlineAt));

        List<StudyListResponse.StudySummary> filtered =
                latestStudies.values().stream()
                        .map(
                                study -> {
                                    var studyCounts =
                                            counts.getOrDefault(
                                                    study.getId(), StudyParticipantCounts.EMPTY);
                                    Instant deadline = deadlines.get(study.getId());
                                    return new Row(
                                            study,
                                            studyCounts,
                                            deadline,
                                            study.phase(studyCounts.occupying(), deadline));
                                })
                        .filter(row -> matches(row, condition))
                        .sorted(comparator(condition.sort()))
                        .map(
                                row ->
                                        StudyListResponse.StudySummary.from(
                                                row.study(),
                                                row.counts(),
                                                row.deadline(),
                                                row.phase()))
                        .toList();

        long total = filtered.size();
        List<StudyListResponse.StudySummary> page =
                filtered.stream().skip(offset).limit(limit).toList();

        return new StudyListResponse(page, total, offset, limit);
    }

    private static boolean matches(Row row, StudyListCondition condition) {
        Study study = row.study();
        if (condition.status() != null && row.phase() != condition.status()) {
            return false;
        }
        if (condition.timezone() != null && study.timezone() != condition.timezone()) {
            return false;
        }
        String keyword = condition.keyword();
        if (keyword != null && !keyword.isBlank()) {
            String needle = keyword.trim().toLowerCase(Locale.ROOT);
            boolean hit =
                    study.getTitle().toLowerCase(Locale.ROOT).contains(needle)
                            || study.getOneLineSummary().toLowerCase(Locale.ROOT).contains(needle);
            if (!hit) {
                return false;
            }
        }
        // 종료 임박 — 지금 신청할 수 있는 스터디 중에서만 고른다
        if (condition.recruitDeadlineBefore() != null) {
            return row.phase() == StudyPhase.RECRUITING
                    && row.deadline() != null
                    && row.deadline().isBefore(condition.recruitDeadlineBefore());
        }
        return true;
    }

    private static Comparator<Row> comparator(StudyListSort sort) {
        Comparator<Row> newestFirst =
                Comparator.comparing((Row row) -> row.study().getId()).reversed();
        Comparator<Row> primary =
                switch (sort == null ? StudyListSort.DEFAULT : sort) {
                    case DEFAULT -> Comparator.comparing(Row::phase);
                    case DEADLINE ->
                            Comparator.comparing(
                                    Row::deadline, Comparator.nullsLast(Comparator.naturalOrder()));
                    case PARTICIPANTS ->
                            Comparator.comparingLong((Row row) -> row.counts().participated())
                                    .reversed();
                    case ENDED ->
                            Comparator.comparing(
                                    (Row row) -> row.study().getEndAt(),
                                    Comparator.nullsLast(Comparator.reverseOrder()));
                    case COMPLETION ->
                            Comparator.comparing(
                                    (Row row) -> row.counts().completionRate(),
                                    Comparator.nullsLast(Comparator.reverseOrder()));
                };
        return primary.thenComparing(newestFirst);
    }
}
