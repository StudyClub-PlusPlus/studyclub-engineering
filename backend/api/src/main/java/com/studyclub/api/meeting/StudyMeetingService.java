package com.studyclub.api.meeting;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.MeetingSchedule;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 네비게이터의 분반 회차 조회·추가·수정·삭제 (specs/study-meeting/spec.md).
 *
 * <p>쓰기는 분반 행 → 분반 회차 순으로 잠근 뒤 검증한다. 디스코드 출석이 같은 회차 잠금으로 회차를 자동 시작하므로, 잠금을 쥔 뒤에 「시작한 회차」 를 판정해야 판정
 * 직후 디스코드가 그 회차를 여는 일이 없다.
 */
@Service
public class StudyMeetingService {

    // 휴가·쉼 중인 사람도 회차의 출석 칸은 있어야 한다. 하차·완주한 사람은 앞으로의 회차에 오지 않는다
    private static final List<ParticipantStatus> ROSTER_STATUSES =
            List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED);
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final String FORBIDDEN_MESSAGE = "이 분반의 회차를 관리할 권한이 없습니다.";

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final StudyCaptainGuard studyCaptainGuard;

    public StudyMeetingService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            StudyCaptainGuard studyCaptainGuard) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.studyCaptainGuard = studyCaptainGuard;
    }

    @Transactional(readOnly = true)
    public StudyMeetingListResponse list(Long accountId, Long studyId, Long studyGroupId) {
        assertStudyExists(studyId);
        Long groupId = studyGroupId != null ? studyGroupId : myGroupId(accountId, studyId);
        StudyGroup group =
                studyGroupRepository
                        .findById(groupId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "분반을 찾을 수 없습니다."));
        if (!group.getStudyId().equals(studyId)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "이 스터디의 분반이 아닙니다.");
        }
        studyCaptainGuard.assertCaptainOrGroupNavigator(accountId, groupId, FORBIDDEN_MESSAGE);

        Instant now = Instant.now();
        List<StudyMeeting> meetings =
                studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(groupId);
        List<StudyMeetingListResponse.MeetingView> views = new ArrayList<>(meetings.size());
        for (int i = 0; i < meetings.size(); i++) {
            StudyMeeting meeting = meetings.get(i);
            views.add(
                    new StudyMeetingListResponse.MeetingView(
                            meeting.getId(),
                            i + 1,
                            meeting.getScheduledAt(),
                            meeting.getTitle(),
                            meeting.isStarted(now)));
        }
        var zone = MeetingSchedule.zoneOf(group.getTimezone());
        String startTime =
                group.getStartAt() == null ? null : group.getStartAt().atZone(zone).format(HH_MM);
        return new StudyMeetingListResponse(
                new StudyMeetingListResponse.StudyGroupView(
                        group.getId(), group.getName(), zone.getId(), startTime),
                views);
    }

    @Transactional
    public void create(Long accountId, Long studyId, StudyMeetingRequests.Create request) {
        // 분반 잠금을 트랜잭션의 첫 조회로 둔다. REPEATABLE READ 스냅샷은 첫 일반 조회 때 잡히므로, 잠금을 쥔 뒤에 읽어야 먼저 끝난 같은 분반 추가가
        // 보인다
        StudyGroup group = lockGroup(request.studyGroupId());
        assertStudyExists(studyId);
        if (!group.getStudyId().equals(studyId)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "이 스터디의 분반이 아닙니다.");
        }
        studyCaptainGuard.assertCaptainOrGroupNavigator(
                accountId, group.getId(), FORBIDDEN_MESSAGE);

        // 회차 행은 잠그지 않는다 — 분반 잠금이 이미 줄을 세운다. 회차 범위를 FOR UPDATE 로 잡으면 회차 없는 두 분반이 같은 인덱스 끝 gap 을 함께
        // 잡고
        // 서로의 INSERT 를 기다리다 교착한다. 추가는 시작 판정이 없어 디스코드 잠금과 맞출 일도 없다
        List<StudyMeeting> existing =
                studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(group.getId());
        new MeetingSchedule(group.getTimezone(), existing)
                .checkAdd(request.scheduledAts(), Instant.now());

        List<StudyMeeting> created =
                studyMeetingRepository.saveAll(
                        // 예정 시각 오름차순으로 넣는다. 디스코드 출석은 여러 분반의 회차를 차례로 잠그는데, 그 잠금이 이 분반 앞 gap 을 쥔 상태에서
                        // 뒤쪽 회차를 먼저 넣어 두면 디스코드는 그 미커밋 행을, 이쪽은 앞쪽 gap 을 서로 기다려 교착한다. 앞에서부터 넣으면 아무 행도
                        // 넣기 전에 기다린다
                        request.scheduledAts().stream()
                                .sorted()
                                .map(
                                        at ->
                                                StudyMeeting.schedule(
                                                        group.getId(), at, request.title()))
                                .toList());
        // 시작 전 ABSENT 는 결석이 아니다 — 내 스터디는 빈칸으로 보이고, 출석률은 지난 회차만 센다
        List<StudyParticipant> roster =
                studyParticipantRepository.findByStudyGroupIdAndStatusIn(
                        group.getId(), ROSTER_STATUSES);
        List<StudyAttendance> absences = new ArrayList<>(created.size() * roster.size());
        for (StudyMeeting meeting : created) {
            for (StudyParticipant participant : roster) {
                absences.add(
                        StudyAttendance.builder()
                                .accountId(participant.getAccountId())
                                .studyId(studyId)
                                .studyGroupId(group.getId())
                                .studyMeetingId(meeting.getId())
                                .status(AttendanceStatus.ABSENT)
                                .build());
            }
        }
        studyAttendanceRepository.saveAll(absences);
    }

    @Transactional
    public void update(
            Long accountId, Long studyId, Long meetingId, StudyMeetingRequests.Update request) {
        LockedMeeting locked = lockMeeting(accountId, studyId, meetingId);
        // 잠금을 기다리는 동안 예정 시각이 지날 수 있어 잠근 뒤에 잰다
        locked.meeting().reschedule(request.scheduledAt(), request.title(), Instant.now());
        locked.schedule().checkReschedule(locked.meeting(), request.scheduledAt());
    }

    @Transactional
    public void delete(Long accountId, Long studyId, Long meetingId) {
        LockedMeeting locked = lockMeeting(accountId, studyId, meetingId);
        locked.meeting().assertNotStarted(Instant.now());
        // 출석 → 회차 외래키가 없어 DB 가 지워 주지 않는다. 휴가는 출석 행의 EXCUSED 라 함께 사라진다
        // 일괄 DELETE 가 영속성 컨텍스트를 비우므로 회차를 먼저 지운다 (DELETE 전에 flush 된다)
        studyMeetingRepository.delete(locked.meeting());
        studyAttendanceRepository.deleteByStudyMeetingId(meetingId);
    }

    /**
     * 회차를 엔티티로 읽기 전에 분반부터 잠근다. 먼저 읽어 두면 잠근 뒤 다시 조회해도 영속성 컨텍스트의 낡은 값(START_AT 등)이 남는다. 다른 스터디의 회차는
     * 없는 회차로 본다 (404).
     */
    private LockedMeeting lockMeeting(Long accountId, Long studyId, Long meetingId) {
        assertStudyExists(studyId);
        Long groupId =
                studyMeetingRepository
                        .findStudyGroupIdById(meetingId)
                        .orElseThrow(this::meetingNotFound);
        StudyGroup group = lockGroup(groupId);
        if (!group.getStudyId().equals(studyId)) {
            throw meetingNotFound();
        }
        studyCaptainGuard.assertCaptainOrGroupNavigator(accountId, groupId, FORBIDDEN_MESSAGE);

        List<StudyMeeting> meetings = lockMeetings(groupId);
        StudyMeeting meeting =
                meetings.stream()
                        .filter(m -> m.getId().equals(meetingId))
                        .findFirst()
                        .orElseThrow(this::meetingNotFound);
        return new LockedMeeting(meeting, new MeetingSchedule(group.getTimezone(), meetings));
    }

    private StudyGroup lockGroup(Long groupId) {
        return studyGroupRepository
                .findByIdForUpdate(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "분반을 찾을 수 없습니다."));
    }

    private List<StudyMeeting> lockMeetings(Long groupId) {
        return studyMeetingRepository.findByStudyGroupIdForUpdate(groupId);
    }

    // 분반을 안 주면 이 스터디의 내 명부 행이 속한 분반 — 명부에 없는 캡틴은 분반을 골라 와야 한다
    private Long myGroupId(Long accountId, Long studyId) {
        return studyParticipantRepository
                .findFirstByStudyIdAndAccountId(studyId, accountId)
                .map(StudyParticipant::getStudyGroupId)
                .orElseThrow(
                        () ->
                                new BusinessException(
                                        ErrorCode.INVALID_INPUT, "studyGroupId 를 지정해 주세요."));
    }

    private void assertStudyExists(Long studyId) {
        if (!studyRepository.existsById(studyId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
        }
    }

    private BusinessException meetingNotFound() {
        return new BusinessException(ErrorCode.NOT_FOUND, "회차를 찾을 수 없습니다.");
    }

    private record LockedMeeting(StudyMeeting meeting, MeetingSchedule schedule) {}
}
