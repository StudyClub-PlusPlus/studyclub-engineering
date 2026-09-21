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
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
 *
 * <p><b>반은 요청이 정하지 않는다.</b> 봇은 카테고리 ID 하나만 보내고 반이 여러 개라도 공부방(보이스)은 하나라, 어느 채널에서 쳤는지로는 반을 가를 수 없다.
 * 스냅샷에 찍힌 사람 각자의 명부 소속으로 가른다.
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
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final AccountRepository accountRepository;

    public DiscordAttendanceService(
            StudyDiscordLinkRepository studyDiscordLinkRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            AccountRepository accountRepository) {
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
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

        Map<Long, StudyParticipant> participantByAccountId =
                studyParticipantRepository.findByStudyId(link.getStudyId()).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyParticipant::getAccountId,
                                        Function.identity(),
                                        // 같은 기수의 두 반에 동시 소속은 앱 레벨 금지라 정상 데이터에서는 안 겹친다.
                                        // 그래도 겹치면 먼저 나온 행을 쓴다 — 여기서 터뜨릴 일은 아니다.
                                        (first, second) -> first));

        Map<String, Long> accountIdByDiscordId =
                loadAccountIds(request.callerDiscordUserId(), request.discordUserIds());
        requireLeader(request.callerDiscordUserId(), accountIdByDiscordId, participantByAccountId);

        Classified classified =
                classify(request.discordUserIds(), accountIdByDiscordId, participantByAccountId);
        return markByGroup(classified, link);
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
     *
     * <p>공부방을 여러 반이 같이 쓰므로 "그 스터디의 반장" 까지만 본다. 반장이 옆 반 멤버까지 한 번에 체크하는 게 정상 흐름이다.
     *
     * <p>역할만 보면 안 된다. 하차·완주는 행을 지우지 않고 STATUS 만 바꾸므로 PARTICIPANT_ROLE 은 LEADER 로 남는다 — 지난 기수 반장이 계속
     * 출석을 찍을 수 있게 된다. 명부에 살아 있는지를 같이 본다.
     */
    private void requireLeader(
            String callerDiscordId,
            Map<String, Long> accountIdByDiscordId,
            Map<Long, StudyParticipant> participantByAccountId) {
        Long callerAccountId = accountIdByDiscordId.get(callerDiscordId);
        StudyParticipant caller =
                callerAccountId == null ? null : participantByAccountId.get(callerAccountId);
        if (caller == null
                || !ATTENDABLE.contains(caller.getStatus())
                || !LEADER_ROLES.contains(caller.getParticipantRole())) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    /** 스냅샷을 반별 버킷과 제외 목록으로 가른다. 반은 각자의 명부 소속이 정한다. */
    private Classified classify(
            List<String> discordUserIds,
            Map<String, Long> accountIdByDiscordId,
            Map<Long, StudyParticipant> participantByAccountId) {
        Map<Long, List<String>> byGroupId = new LinkedHashMap<>();
        List<String> unmatched = new ArrayList<>();
        List<String> notParticipant = new ArrayList<>();

        for (String discordUserId : discordUserIds.stream().distinct().toList()) {
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
            byGroupId
                    .computeIfAbsent(participant.getStudyGroupId(), k -> new ArrayList<>())
                    .add(discordUserId);
        }
        return new Classified(byGroupId, unmatched, notParticipant, accountIdByDiscordId);
    }

    private DiscordAttendanceResponse markByGroup(Classified classified, StudyDiscordLink link) {
        List<DiscordAttendanceResponse.MarkedGroup> groups = new ArrayList<>();
        List<String> noMeeting = new ArrayList<>();
        List<StudyAttendance> toSave = new ArrayList<>();

        for (Map.Entry<Long, List<String>> entry : classified.byGroupId().entrySet()) {
            Long groupId = entry.getKey();
            List<String> discordUserIds = entry.getValue();

            Optional<PickedMeeting> picked = pickMeeting(groupId);
            if (picked.isEmpty()) {
                // 옆 반 사람이 공부방에 앉아 있을 뿐인 흔한 경우다. 전체를 실패시키지 않는다.
                noMeeting.addAll(discordUserIds);
                continue;
            }
            Long meetingId = picked.get().meeting().getId();
            Map<Long, StudyAttendance> existingByAccountId =
                    studyAttendanceRepository.findByStudyMeetingIdIn(List.of(meetingId)).stream()
                            .collect(
                                    Collectors.toMap(
                                            StudyAttendance::getAccountId, Function.identity()));

            List<String> marked = new ArrayList<>();
            for (String discordUserId : discordUserIds) {
                Long accountId = classified.accountIdByDiscordId().get(discordUserId);
                marked.add(discordUserId);

                StudyAttendance existing = existingByAccountId.get(accountId);
                if (existing == null) {
                    toSave.add(
                            StudyAttendance.builder()
                                    .accountId(accountId)
                                    .studyId(link.getStudyId())
                                    .studyGroupId(groupId)
                                    .studyMeetingId(meetingId)
                                    .status(AttendanceStatus.PRESENT)
                                    .build());
                } else if (existing.getStatus() == AttendanceStatus.ABSENT) {
                    // LATE·EXCUSED 는 반장이 손으로 고쳐 둔 값이다. 스냅샷 한 번에 날리지 않는다.
                    existing.updateStatus(AttendanceStatus.PRESENT);
                    toSave.add(existing);
                }
            }
            groups.add(
                    new DiscordAttendanceResponse.MarkedGroup(
                            groupId, meetingId, picked.get().started(), marked));
        }

        studyAttendanceRepository.saveAll(toSave);
        return new DiscordAttendanceResponse(
                groups, classified.unmatched(), classified.notParticipant(), noMeeting);
    }

    /**
     * 진행 중인 회차가 있으면 그것, 없으면 예정 시각이 지금 ±2h 인 아직 시작 안 한 회차를 열어 쓴다. 반장이 {@code !시작} 을 빼먹었을 때 출석이 통째로
     * 날아가는 걸 막으려고 커맨드를 하나로 둔다. 둘 다 없으면 이 반은 지금 모이는 중이 아니라는 뜻이라 비어서 돌아간다.
     */
    private Optional<PickedMeeting> pickMeeting(Long studyGroupId) {
        // 잠금 조회 — 여기부터 출석 쓰기까지가 한 덩어리라 반 단위로 직렬화한다.
        List<StudyMeeting> meetings =
                studyMeetingRepository.findByStudyGroupIdForUpdate(studyGroupId);

        List<StudyMeeting> inProgress =
                meetings.stream().filter(StudyMeeting::isInProgress).toList();
        if (inProgress.size() > 1) {
            throw new BusinessException(ErrorCode.CONFLICT, "진행 중인 회차가 여러 개입니다.");
        }
        if (inProgress.size() == 1) {
            return Optional.of(new PickedMeeting(inProgress.get(0), false));
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
            return Optional.empty();
        }

        StudyMeeting meeting = startable.get(0);
        meeting.start(now);
        return Optional.of(new PickedMeeting(meeting, true));
    }

    private boolean withinWindow(Instant scheduledAt, Instant now) {
        return Duration.between(scheduledAt, now).abs().compareTo(MEETING_PICK_WINDOW) <= 0;
    }

    private record Classified(
            Map<Long, List<String>> byGroupId,
            List<String> unmatched,
            List<String> notParticipant,
            Map<String, Long> accountIdByDiscordId) {}

    private record PickedMeeting(StudyMeeting meeting, boolean started) {}
}
