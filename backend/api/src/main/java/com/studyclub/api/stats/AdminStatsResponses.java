package com.studyclub.api.stats;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.StudyCategory;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** 대시보드 stats API 응답 DTO. specs/dashboard/spec.md 4절. */
public final class AdminStatsResponses {

    private AdminStatsResponses() {}

    public record AggregateError(String errorCode, String errorMessage) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SummaryResponse(
            Instant asOf,
            String timeZone,
            Long activeCrew,
            Long activeEnrollments,
            Double studiesPerCrew,
            Long communityMembers,
            Double attendanceRate,
            AttendanceComparison attendanceComparison,
            Map<String, AggregateError> errors) {}

    public record AttendanceComparison(
            String currentWeekStart,
            String previousWeekStart,
            Double currentRate,
            Double previousRate,
            Double deltaPercentagePoints) {}

    public record StudyBoardResponse(
            Instant asOf,
            String timeZone,
            StudyBoardView view,
            long total,
            int offset,
            int limit,
            List<StudyBoardItem> items) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record StudyBoardItem(
            Long studyId,
            Long programId,
            String title,
            RecruitStatus recruitStatus,
            Instant recruitDeadlineAt,
            DashboardDeadlineBadge deadlineBadge) {}

    public record CrewTimezonesResponse(
            Instant asOf, long totalCrew, List<TimeZoneGroup> timeZoneGroups) {}

    public record TimeZoneGroup(CrewTimeZoneGroupCode code, long count, Double percentage) {}

    public record AttendanceTrendResponse(
            Instant asOf, String timeZone, Double averageRate, List<TrendPoint> points) {}

    public record TrendPoint(
            String weekStart,
            boolean isCurrentWeek,
            double weightedAttended,
            long eligibleCount,
            Double rate) {}

    public record StudiesByCategoryResponse(Instant asOf, List<CategoryCount> categories) {}

    public record CategoryCount(StudyCategory code, long ongoingCount, long totalCount) {}
}
