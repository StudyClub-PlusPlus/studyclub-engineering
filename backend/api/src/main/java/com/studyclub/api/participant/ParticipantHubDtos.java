package com.studyclub.api.participant;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ParticipantHubDtos {

    private ParticipantHubDtos() {
    }

    public record HubResponse(
            List<StudySummary> activeStudies,
            List<StudySummary> pastStudies,
            List<ApplicationSummary> applications,
            List<UpcomingMeeting> upcomingMeetings,
            List<BookmarkSummary> bookmarks) {
    }

    public record StudySummary(
            Long id,
            String title,
            String cohortName,
            String status,
            Integer attendanceRate,
            Instant nextMeetingAt,
            String thumbnailUrl) {
    }

    public record ApplicationSummary(
            Long id,
            Long studyId,
            String studyTitle,
            String cohortName,
            String status,
            Instant appliedAt) {
    }

    public record UpcomingMeeting(
            Long id,
            Long studyId,
            String studyTitle,
            int sessionNumber,
            Instant scheduledAt) {
    }

    public record BookmarkSummary(
            Long id,
            Long studyId,
            String studyTitle,
            String thumbnailUrl,
            LocalDate recruitDeadline) {
    }

    public record StudyDetail(
            Long id,
            String title,
            String cohortName,
            String status,
            String className,
            String timezone,
            String leaderName,
            int completedMeetingCount,
            int totalMeetingCount,
            Integer attendanceRate,
            LocalDate startsOn,
            UpcomingMeeting nextMeeting,
            List<AttendanceItem> attendance,
            LeaveRequest leaveRequest,
            List<WeeklyTask> weeklyTasks,
            List<ResourceItem> resources) {
    }

    public record AttendanceItem(
            Long meetingId,
            int sessionNumber,
            Instant scheduledAt,
            String status) {
    }

    public record LeaveRequest(
            Long id,
            Long meetingId,
            Instant meetingAt,
            String status) {
    }

    public record WeeklyTask(
            Long id,
            String title,
            Instant dueAt,
            String status,
            String submissionUrl) {
    }

    public record ResourceItem(
            Long id,
            String title,
            String type,
            String url,
            Instant publishedAt) {
    }
}
