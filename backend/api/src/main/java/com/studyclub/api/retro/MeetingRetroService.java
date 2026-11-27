package com.studyclub.api.retro;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.retro.RetroSection;
import com.studyclub.domain.retro.StudyMeetingRetro;
import com.studyclub.domain.retro.StudyMeetingRetroLike;
import com.studyclub.domain.retro.StudyMeetingRetroLikeRepository;
import com.studyclub.domain.retro.StudyMeetingRetroRepository;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 미팅 회고 조회·작성·공감 (specs/meeting-retro/spec.md).
 *
 * <p>권한 판정: 반 참여자·네비게이터·캡틴 → {@link StudyCaptainGuard#assertCaptainNavigatorOrMemberOfGroup}. 쓰기는
 * 거기서 한 단계 더 좁혀 「쓸 사람」(회차 시작 때 반에 있던 비캡틴 참여자)만 허용한다.
 */
@Service
public class MeetingRetroService {

    private static final String RETRO_FORBIDDEN = "이 반 회고를 볼 수 없습니다.";
    private static final long MEETING_DEFAULT_DURATION_MIN = 120;
    private static final long LAST_MEETING_EXTRA_DAYS = 7;

    private final StudyMeetingRepository meetingRepository;
    private final StudyGroupRepository groupRepository;
    private final StudyParticipantRepository participantRepository;
    private final AccountRepository accountRepository;
    private final StudyMeetingRetroRepository retroRepository;
    private final StudyMeetingRetroLikeRepository likeRepository;
    private final StudyCaptainGuard studyCaptainGuard;

    public MeetingRetroService(
            StudyMeetingRepository meetingRepository,
            StudyGroupRepository groupRepository,
            StudyParticipantRepository participantRepository,
            AccountRepository accountRepository,
            StudyMeetingRetroRepository retroRepository,
            StudyMeetingRetroLikeRepository likeRepository,
            StudyCaptainGuard studyCaptainGuard) {
        this.meetingRepository = meetingRepository;
        this.groupRepository = groupRepository;
        this.participantRepository = participantRepository;
        this.accountRepository = accountRepository;
        this.retroRepository = retroRepository;
        this.likeRepository = likeRepository;
        this.studyCaptainGuard = studyCaptainGuard;
    }

    // ── GET /api/me/studies/{studyId}/retros/status ─────────────────────────

    @Transactional(readOnly = true)
    public MeetingRetroResponses.RetroStatus retroStatus(
            Long accountId, Long studyId, Long studyGroupId) {
        // studyGroupId 없으면 내 반 감지
        Long groupId = studyGroupId;
        if (groupId == null) {
            groupId =
                    participantRepository
                            .findFirstByStudyIdAndAccountIdAndStatusIn(
                                    studyId, accountId, StudyCaptainGuard.ROSTER_STATUSES)
                            .map(StudyParticipant::getStudyGroupId)
                            .orElseThrow(
                                    () ->
                                            new BusinessException(
                                                    ErrorCode.FORBIDDEN, RETRO_FORBIDDEN));
        }

        studyCaptainGuard.assertCaptainNavigatorOrMemberOfGroup(
                accountId, studyId, groupId, RETRO_FORBIDDEN);

        List<StudyMeeting> allMeetings =
                meetingRepository.findByStudyGroupIdOrderByScheduledAt(groupId);

        Long participantId =
                participantRepository
                        .findByStudyGroupIdAndAccountId(groupId, accountId)
                        .map(StudyParticipant::getId)
                        .orElse(null);

        List<Long> nonKickoffIds =
                allMeetings.stream().filter(m -> !m.isKickoff()).map(StudyMeeting::getId).toList();

        Set<Long> writtenMeetingIds =
                (participantId != null && !nonKickoffIds.isEmpty())
                        ? retroRepository.findMeetingIdsByMeetingIdInAndParticipantId(
                                nonKickoffIds, participantId)
                        : Set.of();

        Instant now = Instant.now();
        List<MeetingRetroResponses.MeetingRetroStatus> statuses =
                new ArrayList<>(allMeetings.size());
        for (StudyMeeting meeting : allMeetings) {
            if (meeting.isKickoff()) {
                statuses.add(
                        new MeetingRetroResponses.MeetingRetroStatus(
                                meeting.getId(), null, null, null, null));
            } else {
                Instant dl = deadline(meeting, allMeetings);
                Instant endAt = meetingEndAt(meeting);
                boolean open = !now.isBefore(endAt) && now.isBefore(dl);
                Boolean retroMine =
                        participantId != null ? writtenMeetingIds.contains(meeting.getId()) : null;
                statuses.add(
                        new MeetingRetroResponses.MeetingRetroStatus(
                                meeting.getId(), endAt, dl, open, retroMine));
            }
        }

        return new MeetingRetroResponses.RetroStatus(statuses);
    }

    // ── GET /api/me/studies/{studyId}/meetings/{meetingId}/retros ────────────

    @Transactional(readOnly = true)
    public MeetingRetroResponses.ViewerContext viewerContext(
            Long accountId, Long studyId, Long meetingId) {
        StudyMeeting meeting = meeting(meetingId, studyId);
        Long groupId = meeting.getStudyGroupId();

        studyCaptainGuard.assertCaptainNavigatorOrMemberOfGroup(
                accountId, studyId, groupId, RETRO_FORBIDDEN);
        assertMeetingEnded(meeting);

        // 내 명부 행 → participantId
        Long participantId =
                participantRepository
                        .findByStudyGroupIdAndAccountId(groupId, accountId)
                        .map(StudyParticipant::getId)
                        .orElse(null);

        // 내 회고 ID
        Long retroId =
                participantId != null
                        ? retroRepository
                                .findByMeetingIdAndParticipantId(meetingId, participantId)
                                .map(StudyMeetingRetro::getId)
                                .orElse(null)
                        : null;

        // 이 회차의 모든 회고 ID → 내가 누른 공감 조회 (ID 만 SELECT)
        List<Long> retroIds = retroRepository.findIdsByMeetingIdOrderByCreatedAtAsc(meetingId);

        Map<Long, Map<String, Boolean>> liked = buildLikedMap(retroIds, accountId);
        return new MeetingRetroResponses.ViewerContext(participantId, retroId, liked);
    }

    // ── GET /api/studies/{studyId}/meetings/{meetingId}/retros ───────────────

    @Transactional(readOnly = true)
    public MeetingRetroResponses.RetroList list(Long accountId, Long studyId, Long meetingId) {
        StudyMeeting meeting = meeting(meetingId, studyId);
        Long groupId = meeting.getStudyGroupId();

        studyCaptainGuard.assertCaptainNavigatorOrMemberOfGroup(
                accountId, studyId, groupId, RETRO_FORBIDDEN);
        assertMeetingEnded(meeting);

        // 기한·open
        List<StudyMeeting> allMeetings =
                meetingRepository.findByStudyGroupIdOrderByScheduledAt(groupId);
        Instant deadline = deadline(meeting, allMeetings);
        boolean open = Instant.now().isBefore(deadline);

        // 쓸 사람 목록
        List<StudyParticipant> roster = participantRepository.findByStudyGroupId(groupId);
        List<StudyParticipant> writables = writableParticipants(meeting, roster);

        // 회고 목록
        List<StudyMeetingRetro> retros =
                retroRepository.findByMeetingIdOrderByCreatedAtAsc(meetingId);

        // 참여자 이름 맵
        Map<Long, StudyParticipant> participantById =
                roster.stream()
                        .collect(Collectors.toMap(StudyParticipant::getId, Function.identity()));
        Map<Long, String> nameByAccountId = nicknames(roster);

        // 공감 수 집계
        List<Long> retroIds = retros.stream().map(StudyMeetingRetro::getId).toList();
        Map<Long, Map<RetroSection, Integer>> likeCounts = aggregateLikes(retroIds);

        // 회고 항목 조립
        List<MeetingRetroResponses.RetroItem> retroItems = new ArrayList<>(retros.size());
        for (StudyMeetingRetro retro : retros) {
            StudyParticipant p = participantById.get(retro.getParticipantId());
            String displayName = p != null ? nameByAccountId.get(p.getAccountId()) : null;
            String role = p != null ? p.getParticipantRole().name() : null;

            Map<String, Integer> likes = new HashMap<>();
            Map<RetroSection, Integer> counts = likeCounts.getOrDefault(retro.getId(), Map.of());
            for (RetroSection section : RetroSection.values()) {
                likes.put(section.name(), counts.getOrDefault(section, 0));
            }

            retroItems.add(
                    new MeetingRetroResponses.RetroItem(
                            retro.getId(),
                            new MeetingRetroResponses.Author(
                                    retro.getParticipantId(), displayName, role),
                            retro.getGood(),
                            retro.getImprove(),
                            retro.getFeeling(),
                            retro.getUpdatedAt(),
                            likes));
        }

        // targets · missing — 네비게이터·캡틴에게만 (account 를 미리 로드해 isNavigatorOrCaptain 쿼리 절약)
        Account callerAccount = accountRepository.findById(accountId).orElse(null);
        boolean leaderOrCaptain = isNavigatorOrCaptain(callerAccount, accountId, groupId);

        Integer targets = leaderOrCaptain ? writables.size() : null;
        List<MeetingRetroResponses.MissingItem> missing = List.of();
        if (leaderOrCaptain) {
            Set<Long> writtenParticipantIds =
                    retros.stream()
                            .map(StudyMeetingRetro::getParticipantId)
                            .collect(Collectors.toSet());
            missing =
                    writables.stream()
                            .filter(p -> !writtenParticipantIds.contains(p.getId()))
                            .map(
                                    p ->
                                            new MeetingRetroResponses.MissingItem(
                                                    p.getId(),
                                                    nameByAccountId.get(p.getAccountId())))
                            .toList();
        }

        return new MeetingRetroResponses.RetroList(
                meetingId, deadline, open, targets, retroItems, missing);
    }

    // ── PUT /api/me/studies/{studyId}/meetings/{meetingId}/retro ────────────

    /**
     * 회고를 작성하거나 수정한다.
     *
     * @return {@code true} = 새로 만들었다(201), {@code false} = 수정했다(200)
     */
    @Transactional
    public boolean write(
            Long accountId, Long studyId, Long meetingId, MeetingRetroRequests.WriteRetro request) {
        StudyMeeting meeting = meeting(meetingId, studyId);
        Long groupId = meeting.getStudyGroupId();

        // 캡틴 제외
        Account account =
                accountRepository
                        .findById(accountId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (account.getSystemRole() == SystemRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "캡틴은 회고를 작성할 수 없습니다.");
        }

        // 시간 조건 — 참여자 여부보다 우선 (킥오프·미종료는 RETRO_NOT_OPEN, 기한 초과는 RETRO_CLOSED)
        assertMeetingEnded(meeting);
        List<StudyMeeting> allMeetings =
                meetingRepository.findByStudyGroupIdOrderByScheduledAt(groupId);
        if (Instant.now().isAfter(deadline(meeting, allMeetings))) {
            throw new BusinessException(ErrorCode.RETRO_CLOSED, "작성 기한이 지나 저장하지 못했어요.");
        }

        // 쓸 사람 확인 — 그 회차 시작 때 반에 있던 참여자
        StudyParticipant participant =
                participantRepository
                        .findByStudyGroupIdAndAccountId(groupId, accountId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.FORBIDDEN, "이 회차의 회고를 작성할 수 없습니다."));
        if (!isWritableParticipant(participant, meeting)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "이 회차의 회고를 작성할 수 없습니다.");
        }

        // 길이 검증 (strip 후)
        String good = validate(request.good(), "좋았던 점");
        String improve = validate(request.improve(), "개선할 점");
        String feeling = request.feeling() != null ? request.feeling().strip() : "";
        if (feeling.length() > StudyMeetingRetro.MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT,
                    "소감은 " + StudyMeetingRetro.MAX_LENGTH + "자까지 작성할 수 있어요.");
        }

        // 없으면 만들고, 있으면 고친다
        Optional<StudyMeetingRetro> existing =
                retroRepository.findByMeetingIdAndParticipantId(meetingId, participant.getId());
        if (existing.isPresent()) {
            existing.get().update(good, improve, feeling);
            return false;
        }
        retroRepository.save(
                StudyMeetingRetro.write(meetingId, participant.getId(), good, improve, feeling));
        return true;
    }

    // ── PUT .../likes/{section} ──────────────────────────────────────────────

    @Transactional
    public MeetingRetroResponses.LikeResult like(
            Long accountId, Long studyId, Long meetingId, Long retroId, RetroSection section) {
        StudyMeetingRetro retro = retroForLike(accountId, studyId, meetingId, retroId);

        // 비운 소감에 공감 불가
        if (section == RetroSection.FEELING
                && (retro.getFeeling() == null || retro.getFeeling().isEmpty())) {
            throw new BusinessException(ErrorCode.EMPTY_SECTION, "내용이 없는 항목에는 공감할 수 없어요.");
        }

        // 없을 때만 INSERT (멱등)
        if (likeRepository
                .findByRetroIdAndSectionAndAccountId(retroId, section, accountId)
                .isEmpty()) {
            likeRepository.save(StudyMeetingRetroLike.of(retroId, section, accountId));
        }

        return new MeetingRetroResponses.LikeResult(
                likeRepository.countByRetroIdAndSection(retroId, section), true);
    }

    // ── DELETE .../likes/{section} ───────────────────────────────────────────

    @Transactional
    public MeetingRetroResponses.LikeResult unlike(
            Long accountId, Long studyId, Long meetingId, Long retroId, RetroSection section) {
        retroForLike(accountId, studyId, meetingId, retroId);

        likeRepository.deleteByRetroIdAndSectionAndAccountId(retroId, section, accountId);

        return new MeetingRetroResponses.LikeResult(
                likeRepository.countByRetroIdAndSection(retroId, section), false);
    }

    // ── 공통 헬퍼 ─────────────────────────────────────────────────────────────

    /**
     * like/unlike 공통 — 접근 권한·자기 회고 여부를 확인하고 대상 회고를 돌려준다.
     *
     * <p>기한과 상관없이 공감·취소할 수 있다.
     */
    private StudyMeetingRetro retroForLike(
            Long accountId, Long studyId, Long meetingId, Long retroId) {
        StudyMeeting meeting = meeting(meetingId, studyId);
        Long groupId = meeting.getStudyGroupId();

        studyCaptainGuard.assertCaptainNavigatorOrMemberOfGroup(
                accountId, studyId, groupId, "이 반 회고에 공감할 수 없습니다.");

        // 회고 조회 — 이 회차에 속하는지 확인
        StudyMeetingRetro retro =
                retroRepository
                        .findById(retroId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "회고를 찾을 수 없습니다."));
        if (!retro.getMeetingId().equals(meetingId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "회고를 찾을 수 없습니다.");
        }

        // 자기 회고 금지
        participantRepository
                .findByStudyGroupIdAndAccountId(groupId, accountId)
                .filter(p -> p.getId().equals(retro.getParticipantId()))
                .ifPresent(
                        ignored -> {
                            throw new BusinessException(ErrorCode.FORBIDDEN, "자기 회고에는 공감할 수 없습니다.");
                        });

        return retro;
    }

    /** 회차를 조회하고 이 스터디에 속하는지 확인한다. */
    private StudyMeeting meeting(Long meetingId, Long studyId) {
        StudyMeeting meeting =
                meetingRepository
                        .findById(meetingId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "회차를 찾을 수 없습니다."));
        StudyGroup group =
                groupRepository
                        .findById(meeting.getStudyGroupId())
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "분반을 찾을 수 없습니다."));
        if (!group.getStudyId().equals(studyId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "회차를 찾을 수 없습니다.");
        }
        return meeting;
    }

    /**
     * 미팅이 끝났는지 확인한다. 킥오프 회차는 회고가 없다.
     *
     * <p>미팅 종료 = {@code END_AT} 이 있으면 그 시각, 없으면 {@code SCHEDULED_AT + 120 분}.
     */
    private void assertMeetingEnded(StudyMeeting meeting) {
        if (meeting.isKickoff()) {
            throw new BusinessException(ErrorCode.RETRO_NOT_OPEN, "킥오프 회차에는 회고가 없습니다.");
        }
        if (Instant.now().isBefore(meetingEndAt(meeting))) {
            throw new BusinessException(ErrorCode.RETRO_NOT_OPEN, "미팅이 끝나면 회고를 쓸 수 있어요.");
        }
    }

    private Instant meetingEndAt(StudyMeeting meeting) {
        return meeting.getEndAt() != null
                ? meeting.getEndAt()
                : meeting.getScheduledAt().plus(MEETING_DEFAULT_DURATION_MIN, ChronoUnit.MINUTES);
    }

    /**
     * 회고 작성 기한.
     *
     * <ul>
     *   <li>다음 정규 회차가 있으면: 그 회차의 예정 시각
     *   <li>마지막 정규 회차면: 미팅 종료 + 7일
     * </ul>
     */
    private Instant deadline(StudyMeeting target, List<StudyMeeting> allMeetings) {
        return allMeetings.stream()
                .filter(m -> !m.isKickoff())
                .filter(m -> m.getScheduledAt().isAfter(target.getScheduledAt()))
                .map(StudyMeeting::getScheduledAt)
                .min(Instant::compareTo)
                .orElseGet(
                        () -> meetingEndAt(target).plus(LAST_MEETING_EXTRA_DAYS, ChronoUnit.DAYS));
    }

    /**
     * 쓸 사람 — 그 회차 예정 시각 기준으로 반에 있던 참여자.
     *
     * <ul>
     *   <li>joinedAt ≤ scheduledAt
     *   <li>leftAt 이 null 이거나 leftAt ≥ scheduledAt
     * </ul>
     */
    private List<StudyParticipant> writableParticipants(
            StudyMeeting meeting, List<StudyParticipant> roster) {
        return roster.stream().filter(p -> isWritableParticipant(p, meeting)).toList();
    }

    private boolean isWritableParticipant(StudyParticipant participant, StudyMeeting meeting) {
        Instant scheduledAt = meeting.getScheduledAt();
        return !participant.getJoinedAt().isAfter(scheduledAt)
                && (participant.getLeftAt() == null
                        || !participant.getLeftAt().isBefore(scheduledAt));
    }

    /**
     * 호출자가 네비게이터(LEADER)이거나 캡틴(ADMIN)인지 — missing 목록 공개 여부 판정용.
     *
     * <p>{@code account} 는 호출부에서 미리 로드해 넘긴다 — 별도 쿼리 없음.
     */
    private boolean isNavigatorOrCaptain(Account account, Long accountId, Long groupId) {
        if (account != null && account.getSystemRole() == SystemRole.ADMIN) {
            return true;
        }
        return participantRepository
                .existsByStudyGroupIdAndAccountIdAndParticipantRoleInAndStatusIn(
                        groupId,
                        accountId,
                        List.of(ParticipantRole.LEADER),
                        StudyCaptainGuard.ROSTER_STATUSES);
    }

    /** retroIds 에 달린 공감 전체를 한 번에 조회해 retroId → section → 수 로 집계한다. */
    private Map<Long, Map<RetroSection, Integer>> aggregateLikes(List<Long> retroIds) {
        if (retroIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Map<RetroSection, Integer>> result = new HashMap<>();
        for (StudyMeetingRetroLike like : likeRepository.findByRetroIdIn(retroIds)) {
            result.computeIfAbsent(like.getRetroId(), k -> new HashMap<>())
                    .merge(like.getSection(), 1, Integer::sum);
        }
        return result;
    }

    /**
     * 내가 누른 공감을 retroId → { 섹션명: true/false } 로 조립한다.
     *
     * <p>한 섹션이라도 누른 회고만 항목을 만들고, 세 섹션 모두 채운다.
     */
    private Map<Long, Map<String, Boolean>> buildLikedMap(List<Long> retroIds, Long accountId) {
        if (retroIds.isEmpty()) {
            return Map.of();
        }
        List<StudyMeetingRetroLike> myLikes =
                likeRepository.findByRetroIdInAndAccountId(retroIds, accountId);

        Map<Long, Set<RetroSection>> likedByRetro = new HashMap<>();
        for (StudyMeetingRetroLike like : myLikes) {
            likedByRetro
                    .computeIfAbsent(like.getRetroId(), k -> EnumSet.noneOf(RetroSection.class))
                    .add(like.getSection());
        }

        Map<Long, Map<String, Boolean>> liked = new HashMap<>();
        for (Map.Entry<Long, Set<RetroSection>> entry : likedByRetro.entrySet()) {
            Map<String, Boolean> sectionMap = new HashMap<>();
            for (RetroSection section : RetroSection.values()) {
                sectionMap.put(section.name(), entry.getValue().contains(section));
            }
            liked.put(entry.getKey(), sectionMap);
        }
        return liked;
    }

    private Map<Long, String> nicknames(List<StudyParticipant> roster) {
        List<Long> accountIds = roster.stream().map(StudyParticipant::getAccountId).toList();
        return accountRepository.findAllById(accountIds).stream()
                .filter(a -> a.getNickname() != null)
                .collect(Collectors.toMap(Account::getId, Account::getNickname));
    }

    private String validate(String value, String fieldName) {
        if (value == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, fieldName + "을 입력해 주세요.");
        }
        String stripped = value.strip();
        if (stripped.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, fieldName + "을 입력해 주세요.");
        }
        if (stripped.length() > StudyMeetingRetro.MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT,
                    fieldName + "은 " + StudyMeetingRetro.MAX_LENGTH + "자까지 작성할 수 있어요.");
        }
        return stripped;
    }
}
