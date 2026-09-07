package com.studyclub.api.participant;

import com.studyclub.domain.application.ApplicationStatusEnum;
import com.studyclub.domain.attendance.AttendanceStatusEnum;
import com.studyclub.domain.participant.ParticipantStatusEnum;
import com.studyclub.domain.study.StudyCohortStatusEnum;
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
            Long cohortId,
            Long studyId,
            String title,
            ParticipantStatusEnum participantStatus,
            Integer attendanceRate,
            Instant nextMeetingAt,
            String thumbnailUrl) {
    }

    public record ApplicationSummary(
            Long id,
            Long cohortId,
            Long studyId,
            String studyTitle,
            ApplicationStatusEnum status,
            Instant appliedAt) {
    }

    public record UpcomingMeeting(
            Long id,
            Long cohortId,
            Long studyId,
            String studyTitle,
            Instant scheduledAt) {
    }

    public record BookmarkSummary(
            Long id,
            Long studyId,
            String studyTitle,
            String thumbnailUrl) {
    }

    public record StudyDetail(
            Long cohortId,
            Long studyId,
            String title,
            StudyCohortStatusEnum cohortStatus,
            ParticipantStatusEnum participantStatus,
            String className,
            String timezone,
            String leaderName,
            int completedMeetingCount,
            int totalMeetingCount,
            Integer attendanceRate,
            LocalDate startsOn,
            UpcomingMeeting nextMeeting,
            List<AttendanceItem> attendance,
            String driveUrl) {
    }

    public record AttendanceItem(
            Long meetingId,
            Instant scheduledAt,
            Instant startsAt,
            Instant endsAt,
            AttendanceStatusEnum attendanceStatus) {
    }

}
