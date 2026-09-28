package com.studyclub.api.participant;

import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ParticipantHubResponses {

    private ParticipantHubResponses() {}

    public record ParticipantHubOverviewResponse(
            List<ParticipatingStudySummary> activeStudies,
            List<ParticipatingStudySummary> pastStudies,
            List<StudyApplicationSummary> applications,
            List<UpcomingStudyMeeting> upcomingMeetings,
            List<BookmarkedStudySummary> bookmarks) {}

    /**
     * {@code participantRole} · {@code isActiveNavigator} 는 회원 탈퇴 화면의 "맡은 진행 중인 스터디" 경고에
     * 쓴다(specs/user-leave/spec.md). {@code isActiveNavigator} 는 서버가 이미 판정을 끝낸 값이다 — {@code
     * participantRole IN (LEADER, CO_LEADER) AND STUDY.STATUS = OPEN} 조합을 프론트가 다시 알 필요가 없게 한다.
     */
    public record ParticipatingStudySummary(
            Long cohortId,
            Long studyId,
            String title,
            ParticipantStatus participantStatus,
            Integer attendanceRate,
            Instant nextMeetingAt,
            String thumbnailUrl,
            ParticipantRole participantRole,
            boolean isActiveNavigator) {}

    public record StudyApplicationSummary(
            Long id, Long cohortId, Long studyId, String studyTitle, Instant appliedAt) {}

    public record UpcomingStudyMeeting(
            Long id, Long cohortId, Long studyId, String studyTitle, Instant scheduledAt) {}

    public record BookmarkedStudySummary(
            Long id, Long studyId, String studyTitle, String thumbnailUrl) {}

    public record ParticipatingStudyDetailResponse(
            Long cohortId,
            Long studyId,
            String title,
            StudyStatus studyStatus,
            ParticipantStatus participantStatus,
            String className,
            String timezone,
            String leaderName,
            int completedMeetingCount,
            int totalMeetingCount,
            Integer attendanceRate,
            LocalDate startsOn,
            UpcomingStudyMeeting nextMeeting,
            List<StudyMeetingAttendance> attendance,
            String driveUrl) {}

    public record StudyMeetingAttendance(
            Long meetingId,
            Instant scheduledAt,
            Instant startsAt,
            Instant endsAt,
            AttendanceStatus attendanceStatus) {}
}
