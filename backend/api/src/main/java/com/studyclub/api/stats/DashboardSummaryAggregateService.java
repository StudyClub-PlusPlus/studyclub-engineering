package com.studyclub.api.stats;

import com.studyclub.api.stats.AdminStatsResponses.AttendanceComparison;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 요약 API의 독립 집계 세 묶음.
 *
 * <p>각 메서드는 별도 트랜잭션을 쓴다. 한 JPA 조회가 트랜잭션을 rollback-only 로 만들어도 다른 집계와 요약 응답까지 함께 실패하지 않는다.
 */
@Service
class DashboardSummaryAggregateService {

    private final DashboardAttendanceAggregator attendanceAggregator;
    private final StudyParticipantRepository studyParticipantRepository;
    private final AccountRepository accountRepository;

    DashboardSummaryAggregateService(
            DashboardAttendanceAggregator attendanceAggregator,
            StudyParticipantRepository studyParticipantRepository,
            AccountRepository accountRepository) {
        this.attendanceAggregator = attendanceAggregator;
        this.studyParticipantRepository = studyParticipantRepository;
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    ParticipationResult participation() {
        List<StudyParticipant> actives = studyParticipantRepository.findActiveInOngoingStudies();
        Set<String> enrollments =
                actives.stream()
                        .map(p -> p.getAccountId() + ":" + p.getStudyId())
                        .collect(Collectors.toSet());
        long crewCount =
                actives.stream()
                        .map(StudyParticipant::getAccountId)
                        .filter(Objects::nonNull)
                        .distinct()
                        .count();
        Double studiesPerCrew = crewCount == 0 ? null : (double) enrollments.size() / crewCount;
        return new ParticipationResult(crewCount, enrollments.size(), studiesPerCrew);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    long communityMembers() {
        return accountRepository.countByOnboardingCompletedAtIsNotNull();
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    AttendanceResult attendance(Instant asOf, ZoneId zone) {
        Double rate = attendanceAggregator.ratePercent(asOf, meeting -> true);
        AttendanceComparison comparison = buildComparison(asOf, zone);
        return new AttendanceResult(rate, comparison);
    }

    private AttendanceComparison buildComparison(Instant asOf, ZoneId zone) {
        LocalDate currentMonday =
                asOf.atZone(zone)
                        .toLocalDate()
                        .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate previousMonday = currentMonday.minusWeeks(1);
        Instant currentStart = currentMonday.atStartOfDay(zone).toInstant();
        Instant previousStart = previousMonday.atStartOfDay(zone).toInstant();

        Double currentRate =
                attendanceAggregator.ratePercent(
                        asOf,
                        DashboardAttendanceAggregator.scheduledBetween(
                                currentStart, asOf.plusNanos(1)));
        Double previousRate =
                attendanceAggregator.ratePercent(
                        asOf,
                        DashboardAttendanceAggregator.scheduledBetween(
                                previousStart, currentStart));
        Double delta =
                currentRate == null || previousRate == null ? null : currentRate - previousRate;
        return new AttendanceComparison(
                currentMonday.toString(),
                previousMonday.toString(),
                currentRate,
                previousRate,
                delta);
    }

    record ParticipationResult(long activeCrew, long activeEnrollments, Double studiesPerCrew) {}

    record AttendanceResult(Double attendanceRate, AttendanceComparison attendanceComparison) {}
}
