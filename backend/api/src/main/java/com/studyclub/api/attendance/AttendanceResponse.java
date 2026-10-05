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
            List<AttendanceEntry> attendances,
            Double attendanceRate) {}

    public record AttendanceEntry(long meetingId, String status) {}
}
