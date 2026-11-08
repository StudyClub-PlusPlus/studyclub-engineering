package com.studyclub.api.attendance;

import java.time.Instant;
import java.util.List;

public record AttendanceResponse(
        StudySummary study,
        List<MeetingSummary> meetings,
        List<ParticipantAttendance> participants) {

    public record StudySummary(
            long id,
            String title,
            int participantCount,
            int totalMeetings,
            Double avgAttendanceRate) {}

    public record MeetingSummary(long id, Instant scheduledAt) {}

    public record ParticipantAttendance(
            long participantId,
            String displayName,
            /** 스터디클럽 디스코드 서버 별명. 연동 안 했거나 회원 탈퇴면 null (share D6). */
            String discordNickname,
            String participantRole,
            boolean captain,
            String participantStatus,
            Instant leftAt,
            List<AttendanceEntry> attendances,
            Double attendanceRate) {}

    public record AttendanceEntry(long meetingId, String status) {}
}
