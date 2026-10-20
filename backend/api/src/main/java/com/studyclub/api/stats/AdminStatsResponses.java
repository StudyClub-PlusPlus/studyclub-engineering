package com.studyclub.api.stats;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.StudyCategory;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** 대시보드 stats API 응답 DTO. specs/dashboard/spec.md 4절. */
public final class AdminStatsResponses {

    private AdminStatsResponses() {}

    public record AggregateError(String errorCode, String errorMessage) {}

    public record SummaryResponse(
            Instant asOf,
            String timeZone,
            Map<String, AggregateError> errors,
            @JsonIgnore Map<String, Object> aggregateFields) {

        /**
         * 성공한 집계 묶음만 최상위 필드로 펼친다. 성공했지만 대상이 없는 값은 map 안의 명시적 {@code null} 로 직렬화하고, 실패한 묶음은 map에 넣지
         * 않아 필드를 생략한다.
         */
        @JsonAnyGetter
        public Map<String, Object> aggregateFields() {
            return aggregateFields;
        }
    }

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
