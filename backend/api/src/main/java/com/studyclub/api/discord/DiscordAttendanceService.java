package com.studyclub.api.discord;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 디스코드 보이스 채널 참가자 스냅샷으로 출석을 찍는다 (specs/discord-attendance/spec.md).
 *
 * <p>화면에서 찍는 경로({@code AttendanceUpsertService})와 같은 테이블을 쓰지만 진입점이 다르다 — 회차를 호출자가 고르지 않고 여기서 판정하며,
 * 인증도 JWT 가 아니라 서비스 키다.
 */
@Service
public class DiscordAttendanceService {

    /** 예정 회차를 자동으로 시작시켜 줄 여유 폭. 운영 정책이라 스키마와 무관하다. */
    static final Duration MEETING_PICK_WINDOW = Duration.ofHours(2);

    private static final Set<ParticipantRole> LEADER_ROLES =
            EnumSet.of(ParticipantRole.LEADER, ParticipantRole.CO_LEADER);

    /** 명부에 살아 있는 상태. WITHDRAWN·COMPLETED 는 출석 대상이 아니다. */
    private static final Set<ParticipantStatus> ATTENDABLE =
            EnumSet.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED);

    private final StudyDiscordLinkRepository studyDiscordLinkRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final AccountRepository accountRepository;

    public DiscordAttendanceService(
            StudyDiscordLinkRepository studyDiscordLinkRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            AccountRepository accountRepository) {
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.accountRepository = accountRepository;
    }

    @Transactional
    public DiscordAttendanceResponse mark(String discordStudyId, DiscordAttendanceRequest request) {
        StudyDiscordLink link =
                studyDiscordLinkRepository
                        .findByDiscordStudyId(discordStudyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        StudyGroup group = onlyGroupOf(link.getStudyId());
        Map<Long, StudyParticipant> participantByAccountId =
                studyParticipantRepository.findByStudyGroupId(group.getId()).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyParticipant::getAccountId, Function.identity()));

        Map<String, Long> accountIdByDiscordId =
                loadAccountIds(request.callerDiscordUserId(), request.discordUserIds());
        requireLeader(request.callerDiscordUserId(), accountIdByDiscordId, participantByAccountId);

        PickedMeeting picked = pickMeeting(group.getId());
        return markAll(picked, group, link, request, accountIdByDiscordId, participantByAccountId);
    }

    /**
     * 분반은 이번 범위 밖이다. 봇의 create-study 가 스터디당 보이스 채널을 하나만 만들어, 반이 둘 이상이면 discordStudyId 만으로 어느 반인지 정할
     * 수 없다. 조용히 아무 반이나 고르면 엉뚱한 명부에 출석이 찍히므로 거절한다.
     */
    private StudyGroup onlyGroupOf(Long studyId) {
        List<StudyGroup> groups = studyGroupRepository.findByStudyId(studyId);
        if (groups.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        if (groups.size() > 1) {
            throw new BusinessException(
                    ErrorCode.CONFLICT, "분반이 여러 개인 스터디는 아직 디스코드 출석을 지원하지 않습니다.");
        }
        return groups.get(0);
    }

    private Map<String, Long> loadAccountIds(String callerDiscordId, List<String> discordUserIds) {
        Set<String> all = new HashSet<>(discordUserIds);
        all.add(callerDiscordId);
        return accountRepository.findByDiscordIdIn(all).stream()
                .collect(Collectors.toMap(Account::getDiscordId, Account::getId));
    }

    /**
     * 그 스터디의 반장인지는 백엔드만 안다 — 봇의 captain·navigator 역할은 길드 전체에 하나뿐이라 스터디를 구분하지 못한다 (봇 계약 summary.md §
     * 역할).
     */
    private void requireLeader(
            String callerDiscordId,
            Map<String, Long> accountIdByDiscordId,
            Map<Long, StudyParticipant> participantByAccountId) {
        Long callerAccountId = accountIdByDiscordId.get(callerDiscordId);
        StudyParticipant caller =
                callerAccountId == null ? null : participantByAccountId.get(callerAccountId);
        if (caller == null || !LEADER_ROLES.contains(caller.getParticipantRole())) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    /**
     * 진행 중인 회차가 있으면 그것, 없으면 예정 시각이 지금 ±2h 인 아직 시작 안 한 회차를 열어 쓴다. 반장이 {@code !시작} 을 빼먹었을 때 출석이 통째로
     * 날아가는 걸 막으려고 커맨드를 하나로 둔다.
     */
    private PickedMeeting pickMeeting(Long studyGroupId) {
        List<StudyMeeting> meetings =
                studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(studyGroupId);

        List<StudyMeeting> inProgress =
                meetings.stream().filter(StudyMeeting::isInProgress).toList();
        if (inProgress.size() > 1) {
            throw new BusinessException(ErrorCode.CONFLICT, "진행 중인 회차가 여러 개입니다.");
        }
        if (inProgress.size() == 1) {
            return new PickedMeeting(inProgress.get(0), false);
        }

        Instant now = Instant.now();
        List<StudyMeeting> startable =
                meetings.stream()
                        .filter(StudyMeeting::isNotStarted)
                        .filter(m -> withinWindow(m.getScheduledAt(), now))
                        .toList();
        if (startable.size() > 1) {
            throw new BusinessException(ErrorCode.CONFLICT, "시작할 수 있는 회차가 여러 개입니다.");
        }
        if (startable.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "지금 출석을 찍을 회차가 없습니다.");
        }

        StudyMeeting meeting = startable.get(0);
        meeting.start(now);
        return new PickedMeeting(meeting, true);
    }

    private boolean withinWindow(Instant scheduledAt, Instant now) {
        return Duration.between(scheduledAt, now).abs().compareTo(MEETING_PICK_WINDOW) <= 0;
    }

    private DiscordAttendanceResponse markAll(
            PickedMeeting picked,
            StudyGroup group,
            StudyDiscordLink link,
            DiscordAttendanceRequest request,
            Map<String, Long> accountIdByDiscordId,
            Map<Long, StudyParticipant> participantByAccountId) {
        Long meetingId = picked.meeting().getId();
        Map<Long, StudyAttendance> existingByAccountId =
                studyAttendanceRepository.findByStudyMeetingIdIn(List.of(meetingId)).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyAttendance::getAccountId, Function.identity()));

        List<String> marked = new ArrayList<>();
        List<String> unmatched = new ArrayList<>();
        List<String> notParticipant = new ArrayList<>();
        List<StudyAttendance> toSave = new ArrayList<>();

        for (String discordUserId : request.discordUserIds().stream().distinct().toList()) {
            Long accountId = accountIdByDiscordId.get(discordUserId);
            if (accountId == null) {
                unmatched.add(discordUserId);
                continue;
            }
            StudyParticipant participant = participantByAccountId.get(accountId);
            if (participant == null || !ATTENDABLE.contains(participant.getStatus())) {
                notParticipant.add(discordUserId);
                continue;
            }
            marked.add(discordUserId);

            StudyAttendance existing = existingByAccountId.get(accountId);
            if (existing == null) {
                toSave.add(
                        StudyAttendance.builder()
                                .accountId(accountId)
                                .studyId(link.getStudyId())
                                .studyGroupId(group.getId())
                                .studyMeetingId(meetingId)
                                .status(AttendanceStatus.PRESENT)
                                .build());
            } else if (existing.getStatus() == AttendanceStatus.ABSENT) {
                // LATE·EXCUSED 는 반장이 손으로 고쳐 둔 값이다. 스냅샷 한 번에 날리지 않는다.
                existing.updateStatus(AttendanceStatus.PRESENT);
                toSave.add(existing);
            }
        }

        studyAttendanceRepository.saveAll(toSave);
        return new DiscordAttendanceResponse(
                meetingId, picked.started(), marked, unmatched, notParticipant);
    }

    private record PickedMeeting(StudyMeeting meeting, boolean started) {
        private PickedMeeting {
            Objects.requireNonNull(meeting);
        }
    }
}
