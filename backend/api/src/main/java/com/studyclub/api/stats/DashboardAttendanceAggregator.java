package com.studyclub.api.stats;

import com.studyclub.api.attendance.AttendanceRateCalculator;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 대시보드 출석 집계 — {@link AttendanceRateCalculator} 의 분자·분모를 참여자별로 합산한다 (specs/dashboard/spec.md 2-2).
 */
@Component
public class DashboardAttendanceAggregator {

    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;

    public DashboardAttendanceAggregator(
            StudyParticipantRepository studyParticipantRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository) {
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
    }

    /** 전기간(또는 회차 필터) 출석률 — 분모 0이면 null. 값은 0~100. */
    public Double ratePercent(Instant asOf, Predicate<StudyMeeting> meetingFilter) {
        double[] components = sumComponents(asOf, meetingFilter);
        Double ratio = AttendanceRateCalculator.rate(components);
        return ratio == null ? null : ratio * 100.0;
    }

    public record Components(double weightedAttended, long eligibleCount, Double ratePercent) {}

    public Components components(Instant asOf, Predicate<StudyMeeting> meetingFilter) {
        double[] pair = sumComponents(asOf, meetingFilter);
        Double ratio = AttendanceRateCalculator.rate(pair);
        return new Components(pair[0], (long) pair[1], ratio == null ? null : ratio * 100.0);
    }

    private double[] sumComponents(Instant asOf, Predicate<StudyMeeting> meetingFilter) {
        List<StudyParticipant> participants = studyParticipantRepository.findAll();
        if (participants.isEmpty()) {
            return new double[] {0, 0};
        }

        Map<Long, List<StudyParticipant>> byGroup =
                participants.stream()
                        .filter(p -> p.getStudyGroupId() != null)
                        .collect(Collectors.groupingBy(StudyParticipant::getStudyGroupId));

        List<Long> groupIds = List.copyOf(byGroup.keySet());
        List<StudyMeeting> allMeetings =
                groupIds.isEmpty()
                        ? List.of()
                        : studyMeetingRepository.findByStudyGroupIdInOrderByScheduledAt(groupIds);

        Map<Long, List<StudyMeeting>> meetingsByGroup =
                allMeetings.stream()
                        .filter(meetingFilter == null ? m -> true : meetingFilter)
                        .collect(Collectors.groupingBy(StudyMeeting::getStudyGroupId));

        List<Long> meetingIds =
                meetingsByGroup.values().stream()
                        .flatMap(Collection::stream)
                        .map(StudyMeeting::getId)
                        .filter(Objects::nonNull)
                        .toList();

        Map<Long, Map<Long, StudyAttendance>> attendanceByAccount =
                meetingIds.isEmpty()
                        ? Map.of()
                        : studyAttendanceRepository.findByStudyMeetingIdIn(meetingIds).stream()
                                .collect(
                                        Collectors.groupingBy(
                                                StudyAttendance::getAccountId,
                                                Collectors.toMap(
                                                        StudyAttendance::getStudyMeetingId,
                                                        a -> a,
                                                        (a, b) -> a)));

        double numerator = 0;
        long denominator = 0;
        for (Map.Entry<Long, List<StudyParticipant>> entry : byGroup.entrySet()) {
            List<StudyMeeting> meetings = meetingsByGroup.getOrDefault(entry.getKey(), List.of());
            if (meetings.isEmpty()) {
                continue;
            }
            for (StudyParticipant participant : entry.getValue()) {
                Map<Long, StudyAttendance> att =
                        attendanceByAccount.getOrDefault(participant.getAccountId(), Map.of());
                // 그룹 회차만 넘긴다 — calculator 가 kickoff·JOINED_AT·LEFT_AT 을 거른다
                double[] pair =
                        AttendanceRateCalculator.components(participant, meetings, att, asOf);
                numerator += pair[0];
                denominator += (long) pair[1];
            }
        }
        return new double[] {numerator, denominator};
    }

    /** 회차 귀속 주 필터용 — scheduledAt 이 [start, end) 인 회차만. */
    public static Predicate<StudyMeeting> scheduledBetween(
            Instant startInclusive, Instant endExclusive) {
        return meeting -> {
            Instant at = meeting.getScheduledAt();
            return at != null && !at.isBefore(startInclusive) && at.isBefore(endExclusive);
        };
    }
}
