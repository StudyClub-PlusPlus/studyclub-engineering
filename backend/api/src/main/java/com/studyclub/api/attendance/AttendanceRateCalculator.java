package com.studyclub.api.attendance;

import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.study.StudyMeeting;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** 개인 출석률 계산 공통 로직. QueryService 와 UpsertService 가 같은 산식을 공유한다. */
class AttendanceRateCalculator {

    static final double LATE_WEIGHT = 0.5;

    private AttendanceRateCalculator() {}

    /**
     * 개인 출석률의 분자·분모를 반환한다. 분모가 0이면 출석률은 null (화면에서 "–" 표시).
     *
     * @return double[]{numerator, denominator}
     */
    static double[] components(
            StudyParticipant participant,
            List<StudyMeeting> meetings,
            Map<Long, StudyAttendance> attByMeetingId,
            Instant now) {
        if (participant.getStatus() != ParticipantStatus.ACTIVE
                && participant.getStatus() != ParticipantStatus.PAUSED
                && participant.getStatus() != ParticipantStatus.COMPLETED) {
            return new double[] {0, 0};
        }
        double numerator = 0;
        long denominator = 0;
        for (StudyMeeting meeting : meetings) {
            if (meeting.getScheduledAt().isAfter(now)) continue;
            if (meeting.getScheduledAt().isBefore(participant.getJoinedAt())) continue;
            StudyAttendance att = attByMeetingId.get(meeting.getId());
            if (att != null && att.getStatus() == AttendanceStatus.EXCUSED) continue;
            denominator++;
            if (att != null) {
                if (att.getStatus() == AttendanceStatus.PRESENT) {
                    numerator += 1.0;
                } else if (att.getStatus() == AttendanceStatus.LATE) {
                    numerator += LATE_WEIGHT;
                }
            }
        }
        return new double[] {numerator, denominator};
    }

    static Double rate(double[] components) {
        return components[1] == 0 ? null : components[0] / components[1];
    }
}
