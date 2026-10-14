package com.studyclub.api.participant;

import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ParticipantHubResponses {

    private ParticipantHubResponses() {}

    /** 내 스터디 목록 — specs/my-studies/spec.md. */
    public record MyStudyListResponse(List<MyStudy> items) {}

    /**
     * 회원 탈퇴 화면의 "맡은 진행 중인 스터디" 경고(specs/user-leave/spec.md)도 이 목록을 그대로 쓴다 — {@code participantRole
     * == LEADER} 이고 {@code relation == ONGOING} 인 행이 있으면 경고를 띄운다 (판정 로직은 프론트, {@code lib/me.ts:
     * getActiveNavigatorStudies}).
     */
    public record MyStudy(
            Long studyId,
            String title,
            StudyCategory category,
            StudyKind studyKind,
            Instant startAt,
            Instant endAt,
            MyStudyRelation relation,
            ParticipantStatus participantStatus,
            ParticipantRole participantRole,
            String discordChannelUrl,
            String driveUrl,
            Double attendanceRate,
            List<MyStudyMeeting> meetings) {}

    public record MyStudyMeeting(
            Long meetingId,
            int sequence,
            Instant scheduledAt,
            Instant startAt,
            Instant endAt,
            AttendanceStatus attendanceStatus,
            boolean countedInRate) {}

    /** 나와의 관계 — 화면의 참여 상태 탭·배지. */
    public enum MyStudyRelation {
        UPCOMING,
        ONGOING,
        COMPLETED,
        WITHDRAWN
    }

    public record UpcomingStudyMeeting(
            Long id, Long cohortId, Long studyId, String studyTitle, Instant scheduledAt) {}

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
