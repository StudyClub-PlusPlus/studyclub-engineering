package com.studyclub.api.participant;

import com.studyclub.api.attendance.AttendanceRateCalculator;
import com.studyclub.api.participant.ParticipantHubResponses.MyStudy;
import com.studyclub.api.participant.ParticipantHubResponses.MyStudyListResponse;
import com.studyclub.api.participant.ParticipantHubResponses.MyStudyMeeting;
import com.studyclub.api.participant.ParticipantHubResponses.MyStudyRelation;
import com.studyclub.api.study.StudyProgramLookup;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 스터디 목록 — 명부 행마다 스터디 하나, 내 반의 회차와 회차별 내 출석을 붙인다 (specs/my-studies/spec.md). 탭·페이징은 화면이 한다.
 *
 * <p>쿼리는 명부 · 스터디 · 회차 · 출석 네 번이다. 명부 행 수와 무관하다.
 */
@Service
public class MyStudyQueryService {

    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyRepository studyRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final StudyProgramLookup studyProgramLookup;

    public MyStudyQueryService(
            StudyParticipantRepository studyParticipantRepository,
            StudyRepository studyRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            StudyProgramLookup studyProgramLookup) {
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRepository = studyRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.studyProgramLookup = studyProgramLookup;
    }

    @Transactional(readOnly = true)
    public MyStudyListResponse getMyStudies(Long accountId) {
        List<StudyParticipant> participants = studyParticipantRepository.findByAccountId(accountId);
        if (participants.isEmpty()) {
            return new MyStudyListResponse(List.of());
        }
        List<Long> studyIds = participants.stream().map(StudyParticipant::getStudyId).toList();
        List<Long> groupIds = participants.stream().map(StudyParticipant::getStudyGroupId).toList();

        Map<Long, Study> studyById =
                studyRepository.findAllById(studyIds).stream()
                        .collect(Collectors.toMap(Study::getId, Function.identity()));
        Map<Long, List<StudyMeeting>> meetingsByGroupId =
                studyMeetingRepository.findByStudyGroupIdInOrderByScheduledAt(groupIds).stream()
                        .collect(Collectors.groupingBy(StudyMeeting::getStudyGroupId));
        Map<Long, StudyAttendance> attendanceByMeetingId =
                studyAttendanceRepository.findByAccountIdAndStudyIdIn(accountId, studyIds).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyAttendance::getStudyMeetingId, Function.identity()));

        // 종류는 프로그램이 갖는다 — 행마다 따로 읽지 않고 한 번에 묶는다
        Map<Long, StudyProgram> programs = studyProgramLookup.forStudies(studyById.values());

        Instant now = Instant.now();
        List<MyStudy> items = new ArrayList<>();
        for (StudyParticipant participant : participants) {
            Study study = studyById.get(participant.getStudyId());
            if (study == null) {
                continue;
            }
            List<StudyMeeting> meetings =
                    meetingsByGroupId.getOrDefault(participant.getStudyGroupId(), List.of());
            items.add(
                    toMyStudy(
                            participant,
                            study,
                            StudyProgramLookup.kindOf(programs, study),
                            meetings,
                            attendanceByMeetingId,
                            now));
        }
        items.sort(
                Comparator.comparing(
                        MyStudy::startAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return new MyStudyListResponse(items);
    }

    private MyStudy toMyStudy(
            StudyParticipant participant,
            Study study,
            StudyKind studyKind,
            List<StudyMeeting> meetings,
            Map<Long, StudyAttendance> attendanceByMeetingId,
            Instant now) {
        MyStudyRelation relation = relation(participant.getStatus(), study.getStartAt(), now);
        boolean withdrawn = relation == MyStudyRelation.WITHDRAWN;

        List<MyStudyMeeting> meetingViews = new ArrayList<>();
        for (int i = 0; i < meetings.size(); i++) {
            StudyMeeting meeting = meetings.get(i);
            meetingViews.add(
                    new MyStudyMeeting(
                            meeting.getId(),
                            i + 1,
                            meeting.getScheduledAt(),
                            meeting.getStartAt(),
                            meeting.getEndAt(),
                            visibleStatus(meeting, attendanceByMeetingId.get(meeting.getId()), now),
                            AttendanceRateCalculator.countsToward(participant, meeting, now)));
        }

        return new MyStudy(
                study.getId(),
                study.getTitle(),
                study.getCategory(),
                studyKind,
                study.getStartAt(),
                study.getEndAt(),
                relation,
                participant.getStatus(),
                participant.getParticipantRole(),
                withdrawn ? null : study.getDiscordChannelUrl(),
                withdrawn ? null : study.getDriveUrl(),
                AttendanceRateCalculator.rate(
                        AttendanceRateCalculator.components(
                                participant, meetings, attendanceByMeetingId, now)),
                meetingViews);
    }

    // PAUSED 의 탭은 미정이라 확정 전까지 ACTIVE 와 같이 날짜로 나눈다 (spec 미확정)
    static MyStudyRelation relation(ParticipantStatus status, Instant studyStartAt, Instant now) {
        return switch (status) {
            case COMPLETED -> MyStudyRelation.COMPLETED;
            case WITHDRAWN -> MyStudyRelation.WITHDRAWN;
            case ACTIVE, PAUSED ->
                    studyStartAt != null && now.isBefore(studyStartAt)
                            ? MyStudyRelation.UPCOMING
                            : MyStudyRelation.ONGOING;
        };
    }

    // 회차 생성 때 깔린 ABSENT 는 시작 전엔 결석이 아니다. 사전 휴가(EXCUSED)는 시작 전에도 보여 준다
    private static AttendanceStatus visibleStatus(
            StudyMeeting meeting, StudyAttendance attendance, Instant now) {
        if (attendance == null) {
            return null;
        }
        boolean notStarted = meeting.isNotStarted() && meeting.getScheduledAt().isAfter(now);
        if (notStarted && attendance.getStatus() == AttendanceStatus.ABSENT) {
            return null;
        }
        return attendance.getStatus();
    }
}
