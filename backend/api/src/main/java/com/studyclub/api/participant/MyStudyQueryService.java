package com.studyclub.api.participant;

import com.studyclub.api.attendance.AttendanceRateCalculator;
import com.studyclub.api.participant.ParticipantHubResponses.MyStudy;
import com.studyclub.api.participant.ParticipantHubResponses.MyStudyListResponse;
import com.studyclub.api.participant.ParticipantHubResponses.MyStudyMeeting;
import com.studyclub.api.participant.ParticipantHubResponses.MyStudyRelation;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.MeetingSchedule;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
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
    private final StudyProgramRepository studyProgramRepository;

    public MyStudyQueryService(
            StudyParticipantRepository studyParticipantRepository,
            StudyRepository studyRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            StudyProgramRepository studyProgramRepository) {
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRepository = studyRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.studyProgramRepository = studyProgramRepository;
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

        Map<Long, StudyProgram> programs =
                studyProgramRepository
                        .findAllByIdIn(
                                studyById.values().stream()
                                        .map(Study::getProgramId)
                                        .distinct()
                                        .toList())
                        .stream()
                        .collect(Collectors.toMap(StudyProgram::getId, p -> p));

        Instant now = Instant.now();
        List<MyStudy> items = new ArrayList<>();
        for (StudyParticipant participant : participants) {
            Study study = studyById.get(participant.getStudyId());
            if (study == null) {
                continue;
            }
            List<StudyMeeting> meetings =
                    meetingsByGroupId.getOrDefault(participant.getStudyGroupId(), List.of());
            StudyProgram program = programs.get(study.getProgramId());
            if (program == null) {
                continue;
            }
            items.add(
                    toMyStudy(
                            participant,
                            study,
                            program.getStudyKind(),
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

        // 킥오프는 0, 정규 회차는 1부터 — 스터디 일정 화면과 같은 번호 (specs/study-meeting/spec.md 결정 11)
        Map<Long, Integer> numbers = MeetingSchedule.numbersOf(meetings);
        List<MyStudyMeeting> meetingViews = new ArrayList<>();
        for (StudyMeeting meeting : meetings) {
            meetingViews.add(
                    new MyStudyMeeting(
                            meeting.getId(),
                            numbers.get(meeting.getId()),
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
            // 이 쿼리는 호출자 본인(accountId=me)의 명부만 보므로 DELETED(회원 탈퇴)는 실제로는 나올 수
            // 없다 — 탈퇴한 계정은 로그인 자체가 안 된다. 그래도 switch 를 완전하게 두기 위해 WITHDRAWN 과
            // 같은 화면 표시로 묶어 둔다.
            case WITHDRAWN, DELETED -> MyStudyRelation.WITHDRAWN;
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
