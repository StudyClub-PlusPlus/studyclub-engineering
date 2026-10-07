package com.studyclub.api.meeting;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.MeetingSchedule;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자 사이트 「스터디 일정」 — 분반 회차 조회·추가·수정·삭제, 발표 신청, 규칙 저장 (specs/study-meeting/spec.md).
 *
 * <p>쓰기는 분반 행 → 분반 회차 순으로 잠근 뒤 검증한다. 디스코드 출석이 같은 회차 잠금으로 회차를 자동 시작하므로, 잠금을 쥔 뒤에 「시작한 회차」 를 판정해야 판정
 * 직후 디스코드가 그 회차를 여는 일이 없다.
 */
@Service
public class StudyMeetingService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final String EDIT_FORBIDDEN = "이 분반의 회차를 관리할 권한이 없습니다.";
    private static final String VIEW_FORBIDDEN = "이 스터디의 일정을 볼 수 없습니다.";
    private static final String MEMBER_FORBIDDEN = "이 분반 참여자만 발표를 신청할 수 있습니다.";

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final AccountRepository accountRepository;
    private final StudyCaptainGuard studyCaptainGuard;

    public StudyMeetingService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            AccountRepository accountRepository,
            StudyCaptainGuard studyCaptainGuard) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.accountRepository = accountRepository;
        this.studyCaptainGuard = studyCaptainGuard;
    }

    @Transactional(readOnly = true)
    public StudyMeetingListResponse list(Long accountId, Long studyId, Long studyGroupId) {
        Study study = study(studyId);
        Long groupId = studyGroupId != null ? studyGroupId : myGroupId(accountId, studyId);
        StudyGroup group =
                studyGroupRepository
                        .findById(groupId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "분반을 찾을 수 없습니다."));
        if (!group.getStudyId().equals(studyId)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "이 스터디의 분반이 아닙니다.");
        }
        boolean canEdit =
                studyCaptainGuard.assertCanViewGroup(
                        accountId, study.getCreatedBy(), groupId, VIEW_FORBIDDEN);

        List<StudyParticipant> roster = studyParticipantRepository.findByStudyGroupId(groupId);
        List<StudyMeeting> meetings =
                studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(groupId);
        Map<Long, StudyParticipant> participantById =
                roster.stream()
                        .collect(Collectors.toMap(StudyParticipant::getId, Function.identity()));
        Map<Long, String> nameByAccount = nicknames(roster);

        Instant now = Instant.now();
        Map<Long, Integer> numbers = MeetingSchedule.numbersOf(meetings);
        List<StudyMeetingListResponse.MeetingView> meetingViews = new ArrayList<>(meetings.size());
        for (StudyMeeting meeting : meetings) {
            meetingViews.add(
                    new StudyMeetingListResponse.MeetingView(
                            meeting.getId(),
                            meeting.getMeetingType().name(),
                            numbers.get(meeting.getId()),
                            meeting.getScheduledAt(),
                            meeting.getTitle(),
                            presenter(
                                    meeting.getPresenter1ParticipantId(),
                                    participantById,
                                    nameByAccount),
                            presenter(
                                    meeting.getPresenter2ParticipantId(),
                                    participantById,
                                    nameByAccount),
                            meeting.isStarted(now)));
        }

        List<StudyMeetingListResponse.ParticipantView> candidates =
                roster.stream()
                        .filter(p -> StudyCaptainGuard.ROSTER_STATUSES.contains(p.getStatus()))
                        .map(
                                p ->
                                        new StudyMeetingListResponse.ParticipantView(
                                                p.getId(), nameByAccount.get(p.getAccountId())))
                        .sorted(
                                Comparator.comparing(
                                        StudyMeetingListResponse.ParticipantView::name,
                                        Comparator.nullsLast(Comparator.naturalOrder())))
                        .toList();
        String navigatorName =
                roster.stream()
                        .filter(p -> p.getParticipantRole() == ParticipantRole.LEADER)
                        .filter(p -> StudyCaptainGuard.ROSTER_STATUSES.contains(p.getStatus()))
                        .map(p -> nameByAccount.get(p.getAccountId()))
                        .filter(Objects::nonNull)
                        .findFirst()
                        .orElse(null);
        Long myParticipantId =
                roster.stream()
                        .filter(p -> accountId.equals(p.getAccountId()))
                        .filter(p -> StudyCaptainGuard.ROSTER_STATUSES.contains(p.getStatus()))
                        .map(StudyParticipant::getId)
                        .findFirst()
                        .orElse(null);

        var zone = MeetingSchedule.zoneOf(group.getTimezone());
        String startTime =
                group.getStartAt() == null ? null : group.getStartAt().atZone(zone).format(HH_MM);
        return new StudyMeetingListResponse(
                new StudyMeetingListResponse.StudyView(
                        study.getId(),
                        study.getTitle(),
                        study.getDiscordChannelUrl(),
                        study.getDriveUrl()),
                new StudyMeetingListResponse.StudyGroupView(
                        group.getId(),
                        group.getName(),
                        zone.getId(),
                        startTime,
                        navigatorName,
                        group.getRules()),
                new StudyMeetingListResponse.MeView(myParticipantId, canEdit),
                candidates,
                meetingViews);
    }

    @Transactional
    public void create(Long accountId, Long studyId, StudyMeetingRequests.Create request) {
        // 분반 잠금을 트랜잭션의 첫 조회로 둔다. REPEATABLE READ 스냅샷은 첫 일반 조회 때 잡히므로, 잠금을 쥔 뒤에 읽어야 먼저 끝난 같은 분반 추가가
        // 보인다
        StudyGroup group = lockGroup(request.studyGroupId());
        Study study = study(studyId);
        if (!group.getStudyId().equals(studyId)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "이 스터디의 분반이 아닙니다.");
        }
        studyCaptainGuard.assertCanEditGroup(
                accountId, study.getCreatedBy(), group.getId(), EDIT_FORBIDDEN);

        // 회차 행은 잠그지 않는다 — 분반 잠금이 이미 줄을 세운다. 회차 범위를 FOR UPDATE 로 잡으면 회차 없는 두 분반이 같은 인덱스 끝 gap 을 함께
        // 잡고 서로의 INSERT 를 기다리다 교착한다. 추가는 시작 판정이 없어 디스코드 잠금과 맞출 일도 없다
        List<StudyMeeting> existing =
                studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(group.getId());
        new MeetingSchedule(group.getTimezone(), existing)
                .checkAdd(request.scheduledAts(), Instant.now());

        // 반복(2개 이상)은 묶음 ID 를 남긴다 — 나중의 묶음 단위 수정·삭제를 위해 (결정 2)
        String seriesId = request.scheduledAts().size() > 1 ? UUID.randomUUID().toString() : null;
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
                                                        group.getId(),
                                                        at,
                                                        request.title(),
                                                        seriesId))
                                .toList());
        // 시작 전 ABSENT 는 결석이 아니다 — 내 스터디는 빈칸으로 보이고, 출석률은 지난 회차만 센다
        List<StudyParticipant> roster =
                studyParticipantRepository.findByStudyGroupIdAndStatusIn(
                        group.getId(), StudyCaptainGuard.ROSTER_STATUSES);
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
        LockedMeeting locked = lockMeetingForEdit(accountId, studyId, meetingId);
        StudyMeeting meeting = locked.meeting();
        // 잠금을 기다리는 동안 예정 시각이 지날 수 있어 잠근 뒤에 잰다
        meeting.reschedule(request.getScheduledAt(), request.getTitle(), Instant.now());
        locked.schedule().checkReschedule(meeting, request.getScheduledAt());

        // 발표자는 보낸 칸만 바꾼다 — 화면을 연 사이 크루가 신청한 칸을 덮지 않는다
        Long presenter1 =
                request.presenter1Sent()
                        ? request.getPresenter1ParticipantId()
                        : meeting.getPresenter1ParticipantId();
        Long presenter2 =
                request.presenter2Sent()
                        ? request.getPresenter2ParticipantId()
                        : meeting.getPresenter2ParticipantId();
        Set<Long> changed = new HashSet<>();
        if (request.presenter1Sent() && presenter1 != null) {
            changed.add(presenter1);
        }
        if (request.presenter2Sent() && presenter2 != null) {
            changed.add(presenter2);
        }
        assertActiveRoster(meeting.getStudyGroupId(), changed);
        meeting.assignPresenters(presenter1, presenter2);
    }

    @Transactional
    public void delete(Long accountId, Long studyId, Long meetingId) {
        LockedMeeting locked = lockMeetingForEdit(accountId, studyId, meetingId);
        locked.meeting().assertDeletable(Instant.now());
        // 출석 → 회차 외래키가 없어 DB 가 지워 주지 않는다. 휴가는 출석 행의 EXCUSED 라 함께 사라진다
        // 일괄 DELETE 가 영속성 컨텍스트를 비우므로 회차를 먼저 지운다 (DELETE 전에 flush 된다)
        studyMeetingRepository.delete(locked.meeting());
        studyAttendanceRepository.deleteByStudyMeetingId(meetingId);
    }

    /** 크루가 빈 발표자 칸에 자기를 넣는다. 같은 칸에 동시에 신청하면 회차 잠금을 먼저 쥔 쪽이 이긴다. */
    @Transactional
    public void signUpPresenter(Long accountId, Long studyId, Long meetingId, int slot) {
        LockedPresenter locked = lockMeetingForPresenter(accountId, studyId, meetingId);
        locked.meeting().signUpPresenter(slot, locked.participantId(), Instant.now());
    }

    @Transactional
    public void cancelPresenter(Long accountId, Long studyId, Long meetingId, int slot) {
        LockedPresenter locked = lockMeetingForPresenter(accountId, studyId, meetingId);
        locked.meeting().cancelPresenter(slot, locked.participantId(), Instant.now());
    }

    @Transactional
    public void saveRules(Long accountId, Long studyId, Long groupId, String rules) {
        StudyGroup group = lockGroup(groupId);
        Study study = study(studyId);
        if (!group.getStudyId().equals(studyId)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "이 스터디의 분반이 아닙니다.");
        }
        studyCaptainGuard.assertCanEditGroup(
                accountId, study.getCreatedBy(), groupId, "이 분반의 규칙을 고칠 권한이 없습니다.");
        group.changeRules(rules);
    }

    /**
     * 회차를 엔티티로 읽기 전에 분반부터 잠근다. 먼저 읽어 두면 잠근 뒤 다시 조회해도 영속성 컨텍스트의 낡은 값(START_AT 등)이 남는다. 다른 스터디의 회차는
     * 없는 회차로 본다 (404).
     */
    private LockedMeeting lockMeetingForEdit(Long accountId, Long studyId, Long meetingId) {
        Long groupId =
                studyMeetingRepository
                        .findStudyGroupIdById(meetingId)
                        .orElseThrow(this::meetingNotFound);
        StudyGroup group = lockGroup(groupId);
        Study study = study(studyId);
        if (!group.getStudyId().equals(studyId)) {
            throw meetingNotFound();
        }
        studyCaptainGuard.assertCanEditGroup(
                accountId, study.getCreatedBy(), groupId, EDIT_FORBIDDEN);
        List<StudyMeeting> meetings = studyMeetingRepository.findByStudyGroupIdForUpdate(groupId);
        return new LockedMeeting(
                find(meetings, meetingId), new MeetingSchedule(group.getTimezone(), meetings));
    }

    /** 발표 신청은 명부 행이 있어야 한다 — 캡틴 우회 없음. 넣을 명부 행이 없으면 신청할 수 없다. */
    private LockedPresenter lockMeetingForPresenter(Long accountId, Long studyId, Long meetingId) {
        Long groupId =
                studyMeetingRepository
                        .findStudyGroupIdById(meetingId)
                        .orElseThrow(this::meetingNotFound);
        StudyGroup group = lockGroup(groupId);
        study(studyId);
        if (!group.getStudyId().equals(studyId)) {
            throw meetingNotFound();
        }
        account(accountId);
        Long participantId =
                studyParticipantRepository
                        .findByStudyGroupIdAndAccountId(groupId, accountId)
                        .filter(p -> StudyCaptainGuard.ROSTER_STATUSES.contains(p.getStatus()))
                        .map(StudyParticipant::getId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.FORBIDDEN, MEMBER_FORBIDDEN));
        List<StudyMeeting> meetings = studyMeetingRepository.findByStudyGroupIdForUpdate(groupId);
        return new LockedPresenter(find(meetings, meetingId), participantId);
    }

    // 발표자로 넣을 사람은 그 분반의 활성 참여자여야 한다 — 다른 분반·참여 중단한 사람은 400
    private void assertActiveRoster(Long groupId, Set<Long> participantIds) {
        if (participantIds.isEmpty()) {
            return;
        }
        Set<Long> active =
                studyParticipantRepository
                        .findByStudyGroupIdAndStatusIn(groupId, StudyCaptainGuard.ROSTER_STATUSES)
                        .stream()
                        .map(StudyParticipant::getId)
                        .collect(Collectors.toSet());
        if (!active.containsAll(participantIds)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "이 분반 참여자만 발표자로 고를 수 있습니다.");
        }
    }

    private StudyMeetingListResponse.PresenterView presenter(
            Long participantId,
            Map<Long, StudyParticipant> participantById,
            Map<Long, String> nameByAccount) {
        if (participantId == null) {
            return null;
        }
        StudyParticipant participant = participantById.get(participantId);
        if (participant == null) {
            return new StudyMeetingListResponse.PresenterView(participantId, null, false);
        }
        return new StudyMeetingListResponse.PresenterView(
                participantId,
                nameByAccount.get(participant.getAccountId()),
                StudyCaptainGuard.ROSTER_STATUSES.contains(participant.getStatus()));
    }

    private Map<Long, String> nicknames(List<StudyParticipant> roster) {
        List<Long> accountIds = roster.stream().map(StudyParticipant::getAccountId).toList();
        return accountRepository.findAllById(accountIds).stream()
                .filter(a -> a.getNickname() != null)
                .collect(Collectors.toMap(Account::getId, Account::getNickname));
    }

    private StudyMeeting find(List<StudyMeeting> meetings, Long meetingId) {
        return meetings.stream()
                .filter(m -> m.getId().equals(meetingId))
                .findFirst()
                .orElseThrow(this::meetingNotFound);
    }

    private StudyGroup lockGroup(Long groupId) {
        return studyGroupRepository
                .findByIdForUpdate(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "분반을 찾을 수 없습니다."));
    }

    // 분반을 안 주면 이 스터디의 내 명부 행이 속한 분반 — 명부에 없는 캡틴은 분반을 골라 와야 한다
    private Long myGroupId(Long accountId, Long studyId) {
        account(accountId);
        return studyParticipantRepository
                .findFirstByStudyIdAndAccountId(studyId, accountId)
                .map(StudyParticipant::getStudyGroupId)
                .orElseThrow(
                        () ->
                                new BusinessException(
                                        ErrorCode.INVALID_INPUT, "studyGroupId 를 지정해 주세요."));
    }

    private void account(Long accountId) {
        if (accountId == null || !accountRepository.existsById(accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
    }

    private Study study(Long studyId) {
        return studyRepository
                .findById(studyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));
    }

    private BusinessException meetingNotFound() {
        return new BusinessException(ErrorCode.NOT_FOUND, "회차를 찾을 수 없습니다.");
    }

    private record LockedMeeting(StudyMeeting meeting, MeetingSchedule schedule) {}

    private record LockedPresenter(StudyMeeting meeting, Long participantId) {}
}
