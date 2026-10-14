package com.studyclub.api.attendance;

import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
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

    /**
     * 이 회차가 그 참여자의 출석률 분모에 들어가는지 — 편입 뒤의 회차이고, 예정 시각이 상한을 넘지 않을 때.
     *
     * <p>상한은 ACTIVE/PAUSED/COMPLETED 면 지금(now), WITHDRAWN·DELETED(하차·회원 탈퇴)면 떠난 시각({@code
     * leftAt})이다 — 하차 이후 회차까지 결석(0점)으로 깔면 "하차"와 "결석"이라는 서로 다른 사실이 같은 숫자로 섞인다. {@code leftAt} 이 없는
     * WITHDRAWN·DELETED(떠난 시각을 모르는 과거 데이터)는 안전하게 전체를 제외한다 — 어디까지가 "떠나기 전"인지 알 수 없기
     * 때문이다(specs/user-leave/spec.md).
     */
    public static boolean countsToward(
            StudyParticipant participant, StudyMeeting meeting, Instant now) {
        Instant upperBound =
                switch (participant.getStatus()) {
                    case ACTIVE, PAUSED, COMPLETED -> now;
                    case WITHDRAWN, DELETED -> participant.getLeftAt();
                };
        // 킥오프는 출석을 찍지만 출석률에 넣지 않는다 (specs/study-meeting/spec.md 결정 11)
        if (upperBound == null || meeting.isKickoff()) {
            return false;
        }
        return !meeting.getScheduledAt().isAfter(upperBound)
                && !meeting.getScheduledAt().isBefore(participant.getJoinedAt());
    }

    public static Double rate(double[] components) {
        return components[1] == 0 ? null : components[0] / components[1];
    }
}
