package com.studyclub.api.stats;

import com.studyclub.api.stats.AdminStatsResponses.AggregateError;
import com.studyclub.api.stats.AdminStatsResponses.AttendanceTrendResponse;
import com.studyclub.api.stats.AdminStatsResponses.CategoryCount;
import com.studyclub.api.stats.AdminStatsResponses.CrewTimezonesResponse;
import com.studyclub.api.stats.AdminStatsResponses.StudiesByCategoryResponse;
import com.studyclub.api.stats.AdminStatsResponses.StudyBoardItem;
import com.studyclub.api.stats.AdminStatsResponses.StudyBoardResponse;
import com.studyclub.api.stats.AdminStatsResponses.SummaryResponse;
import com.studyclub.api.stats.AdminStatsResponses.TimeZoneGroup;
import com.studyclub.api.stats.AdminStatsResponses.TrendPoint;
import com.studyclub.api.stats.DashboardSummaryAggregateService.AttendanceResult;
import com.studyclub.api.stats.DashboardSummaryAggregateService.ParticipationResult;
import com.studyclub.api.study.BackofficeStudyListFilter;
import com.studyclub.api.study.BackofficeStudyListResponse;
import com.studyclub.api.study.BackofficeStudyListService;
import com.studyclub.api.study.BackofficeStudySort;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 운영 대시보드 집계. specs/dashboard/spec.md */
@Service
@Transactional(readOnly = true)
public class AdminStatsService {

    private static final Logger log = LoggerFactory.getLogger(AdminStatsService.class);
    private static final int TREND_WEEKS = 12;

    private final DashboardTimeZoneResolver timeZoneResolver;
    private final DashboardAttendanceAggregator attendanceAggregator;
    private final DashboardSummaryAggregateService summaryAggregateService;
    private final BackofficeStudyListService backofficeStudyListService;
    private final StudyParticipantRepository studyParticipantRepository;
    private final AccountRepository accountRepository;
    private final StudyRepository studyRepository;

    public AdminStatsService(
            DashboardTimeZoneResolver timeZoneResolver,
            DashboardAttendanceAggregator attendanceAggregator,
            DashboardSummaryAggregateService summaryAggregateService,
            BackofficeStudyListService backofficeStudyListService,
            StudyParticipantRepository studyParticipantRepository,
            AccountRepository accountRepository,
            StudyRepository studyRepository) {
        this.timeZoneResolver = timeZoneResolver;
        this.attendanceAggregator = attendanceAggregator;
        this.summaryAggregateService = summaryAggregateService;
        this.backofficeStudyListService = backofficeStudyListService;
        this.studyParticipantRepository = studyParticipantRepository;
        this.accountRepository = accountRepository;
        this.studyRepository = studyRepository;
    }

    @Transactional(
            propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public SummaryResponse summary(String timeZoneQuery, Long accountId) {
        Instant asOf = Instant.now();
        ZoneId zone = timeZoneResolver.resolve(timeZoneQuery, accountId);
        Map<String, AggregateError> errors = new LinkedHashMap<>();
        Map<String, Object> fields = new LinkedHashMap<>();

        try {
            ParticipationResult participation = summaryAggregateService.participation();
            fields.put("activeCrew", participation.activeCrew());
            fields.put("activeEnrollments", participation.activeEnrollments());
            fields.put("studiesPerCrew", participation.studiesPerCrew());
        } catch (RuntimeException e) {
            log.error("대시보드 participation 집계 실패", e);
            errors.put("participation", new AggregateError("INTERNAL_ERROR", "참여 정보를 불러오지 못했습니다."));
        }

        try {
            fields.put("communityMembers", summaryAggregateService.communityMembers());
        } catch (RuntimeException e) {
            log.error("대시보드 communityMembers 집계 실패", e);
            errors.put(
                    "communityMembers", new AggregateError("INTERNAL_ERROR", "회원 정보를 불러오지 못했습니다."));
        }

        try {
            AttendanceResult attendance = summaryAggregateService.attendance(asOf, zone);
            fields.put("attendanceRate", attendance.attendanceRate());
            fields.put("attendanceComparison", attendance.attendanceComparison());
        } catch (RuntimeException e) {
            log.error("대시보드 attendance 집계 실패", e);
            errors.put("attendance", new AggregateError("INTERNAL_ERROR", "출석 정보를 불러오지 못했습니다."));
        }

        if (errors.size() == 3) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "대시보드 요약을 불러오지 못했습니다.");
        }

        return new SummaryResponse(asOf, zone.getId(), errors, fields);
    }

    public StudyBoardResponse studyBoard(
            StudyBoardView view, Integer limitParam, String timeZoneQuery, Long accountId) {
        if (view == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "view 가 필요합니다.");
        }
        int limit = limitParam == null ? 4 : limitParam;
        if (limit < 1 || limit > 4) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "limit 은 1 이상 4 이하여야 합니다.");
        }
        Instant asOf = Instant.now();
        ZoneId zone = timeZoneResolver.resolve(timeZoneQuery, accountId);

        if (view == StudyBoardView.ONGOING) {
            return ongoingBoard(asOf, zone, limit);
        }
        return recruitmentBoard(asOf, zone, limit);
    }

    public CrewTimezonesResponse crewTimezones() {
        Instant asOf = Instant.now();
        ActiveCrewStats crew = activeCrewStats();
        Set<Long> accountIds = crew.accountIds();
        Map<CrewTimeZoneGroupCode, Long> counts = new EnumMap<>(CrewTimeZoneGroupCode.class);
        for (CrewTimeZoneGroupCode code : CrewTimeZoneGroupCode.values()) {
            counts.put(code, 0L);
        }
        if (!accountIds.isEmpty()) {
            for (Account account : accountRepository.findAllById(accountIds)) {
                CrewTimeZoneGroupCode code = classifyTimeZone(account.getTimeZone());
                counts.merge(code, 1L, Long::sum);
            }
        }
        long total = crew.crewCount();
        List<TimeZoneGroup> groups = new ArrayList<>();
        for (CrewTimeZoneGroupCode code : CrewTimeZoneGroupCode.values()) {
            long count = counts.getOrDefault(code, 0L);
            Double percentage = total == 0 ? null : (count * 100.0) / total;
            groups.add(new TimeZoneGroup(code, count, percentage));
        }
        return new CrewTimezonesResponse(asOf, total, groups);
    }

    public AttendanceTrendResponse attendanceTrend(
            Integer weeksParam, String timeZoneQuery, Long accountId) {
        int weeks = weeksParam == null ? TREND_WEEKS : weeksParam;
        if (weeks != TREND_WEEKS) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "weeks 는 12만 허용합니다.");
        }
        Instant asOf = Instant.now();
        ZoneId zone = timeZoneResolver.resolve(timeZoneQuery, accountId);
        LocalDate currentMonday =
                asOf.atZone(zone)
                        .toLocalDate()
                        .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        List<TrendPoint> points = new ArrayList<>(weeks);
        List<Double> ratesForAverage = new ArrayList<>();
        for (int i = weeks - 1; i >= 0; i--) {
            LocalDate monday = currentMonday.minusWeeks(i);
            Instant weekStart = monday.atStartOfDay(zone).toInstant();
            Instant weekEnd = monday.plusWeeks(1).atStartOfDay(zone).toInstant();
            boolean isCurrent = i == 0;
            Instant endExclusive = isCurrent ? asOf.plusNanos(1) : weekEnd;
            // current week: [monday, asOf] inclusive on asOf — use endExclusive = asOf + epsilon
            // Actually scheduledAt <= asOf for current: use !isAfter(asOf) via endExclusive =
            // asOf.plusNanos(1)
            // and start = weekStart. For previous: [weekStart, weekEnd)
            if (isCurrent) {
                endExclusive = asOf.isBefore(weekStart) ? weekStart : asOf.plusNanos(1);
            }
            var components =
                    attendanceAggregator.components(
                            asOf,
                            DashboardAttendanceAggregator.scheduledBetween(
                                    weekStart, endExclusive));
            if (components.ratePercent() != null) {
                ratesForAverage.add(components.ratePercent());
            }
            points.add(
                    new TrendPoint(
                            monday.toString(),
                            isCurrent,
                            components.weightedAttended(),
                            components.eligibleCount(),
                            components.ratePercent()));
        }
        Double average =
                ratesForAverage.isEmpty()
                        ? null
                        : ratesForAverage.stream()
                                .mapToDouble(Double::doubleValue)
                                .average()
                                .orElse(0);
        return new AttendanceTrendResponse(asOf, zone.getId(), average, points);
    }

    public StudiesByCategoryResponse studiesByCategory() {
        Instant asOf = Instant.now();
        List<Study> studies =
                studyRepository.findByStatusIn(
                        List.of(
                                StudyStatus.OPEN,
                                StudyStatus.ONGOING,
                                StudyStatus.ENDED,
                                StudyStatus.CLOSED));
        Map<StudyCategory, long[]> counts = new EnumMap<>(StudyCategory.class);
        for (Study study : studies) {
            long[] pair = counts.computeIfAbsent(study.getCategory(), c -> new long[2]);
            pair[1]++; // total
            if (study.getStatus() == StudyStatus.ONGOING) {
                pair[0]++;
            }
        }
        List<CategoryCount> categories =
                counts.entrySet().stream()
                        .map(e -> new CategoryCount(e.getKey(), e.getValue()[0], e.getValue()[1]))
                        .sorted(
                                Comparator.comparingLong(CategoryCount::totalCount)
                                        .reversed()
                                        .thenComparing(c -> c.code().name()))
                        .toList();
        return new StudiesByCategoryResponse(asOf, categories);
    }

    private StudyBoardResponse ongoingBoard(Instant asOf, ZoneId zone, int limit) {
        BackofficeStudyListResponse page =
                backofficeStudyListService.getStudies(
                        new BackofficeStudyListFilter(
                                null,
                                null,
                                StudyStatus.ONGOING,
                                null,
                                null,
                                null,
                                BackofficeStudySort.TITLE_ASC),
                        0,
                        limit,
                        asOf);
        List<StudyBoardItem> items =
                page.items().stream()
                        .map(
                                study ->
                                        new StudyBoardItem(
                                                study.studyId(),
                                                study.programId(),
                                                study.title(),
                                                null,
                                                null,
                                                null))
                        .toList();
        return new StudyBoardResponse(
                asOf, zone.getId(), StudyBoardView.ONGOING, page.total(), 0, limit, items);
    }

    /** 모집 보드와 전체 보기는 같은 DB 정렬을 사용한다. 전체 후보를 메모리에 적재하지 않는다. */
    private StudyBoardResponse recruitmentBoard(Instant asOf, ZoneId zone, int limit) {
        BackofficeStudyListResponse page =
                backofficeStudyListService.getStudies(
                        new BackofficeStudyListFilter(
                                null,
                                null,
                                StudyStatus.OPEN,
                                null,
                                null,
                                null,
                                BackofficeStudySort.RECRUITMENT),
                        0,
                        limit,
                        asOf);
        Map<Long, Study> studies =
                studyRepository
                        .findAllById(
                                page.items().stream()
                                        .map(BackofficeStudyListResponse.StudySummary::studyId)
                                        .toList())
                        .stream()
                        .collect(Collectors.toMap(Study::getId, s -> s));
        List<StudyBoardItem> items =
                page.items().stream()
                        .map(
                                s ->
                                        new StudyBoardItem(
                                                s.studyId(),
                                                s.programId(),
                                                s.title(),
                                                s.recruitStatus(),
                                                s.recruitDeadlineAt(),
                                                deadlineBadge(
                                                        studies.get(s.studyId()),
                                                        s.currentApplicants(),
                                                        s.recruitDeadlineAt(),
                                                        s.recruitmentCapacity(),
                                                        asOf)))
                        .toList();
        return new StudyBoardResponse(
                asOf, zone.getId(), StudyBoardView.RECRUITMENT, page.total(), 0, limit, items);
    }

    static DashboardDeadlineBadge deadlineBadge(
            Study study, long applicants, Instant deadline, Integer capacity, Instant asOf) {
        if (deadline != null && !asOf.isBefore(deadline)) {
            return DashboardDeadlineBadge.DEADLINE_PASSED;
        }
        if (capacity != null && applicants >= capacity) {
            return DashboardDeadlineBadge.CAPACITY_FULL;
        }
        if (deadline == null) {
            return DashboardDeadlineBadge.DEADLINE_MISSING;
        }
        if (study.isClosingSoon(deadline, asOf)) {
            return DashboardDeadlineBadge.CLOSING_SOON;
        }
        return DashboardDeadlineBadge.NORMAL;
    }

    private ActiveCrewStats activeCrewStats() {
        List<StudyParticipant> actives = studyParticipantRepository.findActiveInOngoingStudies();
        Set<String> enrollments =
                actives.stream()
                        .map(p -> p.getAccountId() + ":" + p.getStudyId())
                        .collect(Collectors.toSet());
        Set<Long> accounts =
                actives.stream()
                        .map(StudyParticipant::getAccountId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
        return new ActiveCrewStats(accounts, enrollments.size());
    }

    static CrewTimeZoneGroupCode classifyTimeZone(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            return CrewTimeZoneGroupCode.UNKNOWN;
        }
        return switch (timeZone) {
            case "Asia/Seoul" -> CrewTimeZoneGroupCode.KST;
            case "America/New_York", "America/Toronto" -> CrewTimeZoneGroupCode.ET;
            case "America/Vancouver", "America/Los_Angeles" -> CrewTimeZoneGroupCode.PT;
            default -> {
                try {
                    ZoneId.of(timeZone);
                    yield CrewTimeZoneGroupCode.UNKNOWN;
                } catch (Exception e) {
                    yield CrewTimeZoneGroupCode.UNKNOWN;
                }
            }
        };
    }

    private record ActiveCrewStats(Set<Long> accountIds, long enrollmentCount) {
        long crewCount() {
            return accountIds.size();
        }
    }
}
