package com.studyclub.api.participant;

import com.studyclub.domain.application.ApplicationStatusEnum;
import com.studyclub.domain.attendance.AttendanceStatusEnum;
import com.studyclub.domain.participant.ParticipantStatusEnum;
import com.studyclub.domain.study.StudyCohortStatusEnum;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ParticipantHubResponses {

    private ParticipantHubResponses() {
    }

    public record ParticipantHubOverviewResponse(
            List<ParticipatingStudySummary> activeStudies,
            List<ParticipatingStudySummary> pastStudies,
            List<StudyApplicationSummary> applications,
            List<UpcomingStudyMeeting> upcomingMeetings,
            List<BookmarkedStudySummary> bookmarks) {
    }

    public record ParticipatingStudySummary(
            Long cohortId,
            Long studyId,
            String title,
            ParticipantStatusEnum participantStatus,
            Integer attendanceRate,
            Instant nextMeetingAt,
            String thumbnailUrl) {
    }

    public record StudyApplicationSummary(
            Long id,
            Long cohortId,
            Long studyId,
            String studyTitle,
            ApplicationStatusEnum status,
            Instant appliedAt) {
    }

    public record UpcomingStudyMeeting(
            Long id,
            Long cohortId,
            Long studyId,
            String studyTitle,
            Instant scheduledAt) {
    }

    public record BookmarkedStudySummary(
            Long id,
            Long studyId,
            String studyTitle,
            String thumbnailUrl) {
    }

    public record ParticipatingStudyCohortDetailResponse(
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
            UpcomingStudyMeeting nextMeeting,
            List<StudyMeetingAttendance> attendance,
            String driveUrl) {
    }

    public record StudyMeetingAttendance(
            Long meetingId,
            Instant scheduledAt,
            Instant startsAt,
            Instant endsAt,
            AttendanceStatusEnum attendanceStatus) {
    }

}
