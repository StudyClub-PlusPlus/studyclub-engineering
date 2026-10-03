package com.studyclub.api.discord;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
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
import java.util.Collections;
import java.util.Comparator;
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
                                        // 그래도 겹치면 명부에 살아 있는 행을 우선한다 — 조회 순서에 따라
                                        // 탈퇴 행이 뽑혀서 정상 참가자가 notParticipant 로 빠지거나 리더가
                                        // 403 을 받는 걸 막는다.
                                        DiscordAttendanceService::preferAttendable));

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

        // 반 id 오름차순으로 잠근다. 요청의 discordUserIds 순서를 그대로 따라가면 같은 사람들을
        // 순서만 바꿔 보낸 두 요청이 서로의 회차 잠금을 기다려 교착한다.
        List<Long> groupIds = new ArrayList<>(classified.byGroupId().keySet());
        Collections.sort(groupIds);

        for (Long groupId : groupIds) {
            List<String> discordUserIds = classified.byGroupId().get(groupId);

            Optional<PickedMeeting> picked = pickMeeting(groupId);
            if (picked.isEmpty()) {
                // 옆 반 사람이 공부방에 앉아 있을 뿐인 흔한 경우다. 전체를 실패시키지 않는다.
                noMeeting.addAll(discordUserIds);
                continue;
            }
            Long meetingId = picked.get().meeting().getId();
            Instant now = Instant.now();

            List<String> marked = new ArrayList<>();
            for (String discordUserId : discordUserIds) {
                Long accountId = classified.accountIdByDiscordId().get(discordUserId);
                marked.add(discordUserId);
                // 조회 없이 한 문장으로 찍는다. 있으면 ABSENT 일 때만 올라가므로 LATE·EXCUSED 가
                // 살아남고, 겹쳐 들어온 요청도 유니크 제약을 때리지 않는다.
                studyAttendanceRepository.markPresent(
                        accountId, link.getStudyId(), groupId, meetingId, now);
            }
            groups.add(
                    new DiscordAttendanceResponse.MarkedGroup(
                            groupId, meetingId, picked.get().started(), marked));
        }

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
        Instant now = Instant.now();

        // 후보가 여럿이어도 거절하지 않는다. 한 스터디가 보이스 채널을 두 개 쓰고 각각 세션이 열려 있는 건
        // 깨진 데이터가 아니라 정상 운영이다 (2026-09-24 #111 리뷰, 김민정). 가장 최근에 시작한 회차 =
        // 지금 모이는 중인 세션으로 본다.
        Optional<StudyMeeting> inProgress =
                meetings.stream()
                        .filter(StudyMeeting::isInProgress)
                        .max(Comparator.comparing(StudyMeeting::getStartAt));
        if (inProgress.isPresent()) {
            return Optional.of(new PickedMeeting(inProgress.get(), false));
        }

        // 시작할 회차도 같은 규칙 — 예정 시각이 지금에 가장 가까운 것.
        Optional<StudyMeeting> startable =
                meetings.stream()
                        .filter(StudyMeeting::isNotStarted)
                        .filter(m -> withinWindow(m.getScheduledAt(), now))
                        .min(
                                Comparator.comparing(
                                        m -> Duration.between(m.getScheduledAt(), now).abs()));
        if (startable.isEmpty()) {
            return Optional.empty();
        }

        StudyMeeting meeting = startable.get();
        meeting.start(now);
        return Optional.of(new PickedMeeting(meeting, true));
    }

    private boolean withinWindow(Instant scheduledAt, Instant now) {
        return Duration.between(scheduledAt, now).abs().compareTo(MEETING_PICK_WINDOW) <= 0;
    }

    /** 같은 계정에 명부 행이 둘 이상이면 ACTIVE·PAUSED 를 우선한다. 둘 다 같은 등급이면 먼저 나온 행. */
    private static StudyParticipant preferAttendable(
            StudyParticipant first, StudyParticipant second) {
        boolean firstAlive = ATTENDABLE.contains(first.getStatus());
        boolean secondAlive = ATTENDABLE.contains(second.getStatus());
        return (!firstAlive && secondAlive) ? second : first;
    }

    private record Classified(
            Map<Long, List<String>> byGroupId,
            List<String> unmatched,
            List<String> notParticipant,
            Map<String, Long> accountIdByDiscordId) {}

    private record PickedMeeting(StudyMeeting meeting, boolean started) {}
}
