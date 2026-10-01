package com.studyclub.api.attendance;

import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.study.StudyMeeting;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** 개인 출석률 계산 공통 로직. 출석부·출석 저장·내 스터디가 같은 산식을 공유한다. */
public class AttendanceRateCalculator {

    static final double LATE_WEIGHT = 0.5;

    private AttendanceRateCalculator() {}

    /**
     * 개인 출석률의 분자·분모를 반환한다. 분모가 0이면 출석률은 null (화면에서 "–" 표시).
     *
     * @return double[]{numerator, denominator}
     */
    public static double[] components(
            StudyParticipant participant,
            List<StudyMeeting> meetings,
            Map<Long, StudyAttendance> attByMeetingId,
            Instant now) {
        double numerator = 0;
        long denominator = 0;
        for (StudyMeeting meeting : meetings) {
            if (!countsToward(participant, meeting, now)) continue;
            StudyAttendance att = attByMeetingId.get(meeting.getId());
            denominator++;
            if (att != null) {
                if (att.getStatus() == AttendanceStatus.PRESENT
                        || att.getStatus() == AttendanceStatus.EXCUSED) {
                    numerator += 1.0;
                } else if (att.getStatus() == AttendanceStatus.LATE) {
                    numerator += LATE_WEIGHT;
                }
            }
        }
        return new double[] {numerator, denominator};
    }

    /** 이 회차가 그 참여자의 출석률 분모에 들어가는지 — 참여 중단이 아니고, 예정 시각이 지났고, 편입 뒤의 회차. */
    public static boolean countsToward(
            StudyParticipant participant, StudyMeeting meeting, Instant now) {
        if (participant.getStatus() != ParticipantStatus.ACTIVE
                && participant.getStatus() != ParticipantStatus.PAUSED
                && participant.getStatus() != ParticipantStatus.COMPLETED) {
            return false;
        }
        return !meeting.getScheduledAt().isAfter(now)
                && !meeting.getScheduledAt().isBefore(participant.getJoinedAt());
    }

    public static Double rate(double[] components) {
        return components[1] == 0 ? null : components[0] / components[1];
    }
}
