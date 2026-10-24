package com.studyclub.api.notice;

import com.studyclub.api.discord.StudyNoticeDiscordGate;
import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.notice.DiscordSkipReason;
import com.studyclub.domain.notice.SendBlockReason;
import com.studyclub.domain.notice.StudyNotice;
import com.studyclub.domain.notice.StudyNoticeRepository;
import com.studyclub.domain.notice.StudyNoticeSent;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationStatusCount;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 스터디 공지 유스케이스 조립 (specs/study-notice/spec.md). 규칙은 엔티티가 안다 — 제목·본문 길이와 발송 한도는 {@link StudyNotice},
 * 권한은 {@link StudyCaptainGuard}. 여기서는 순서만 잇는다.
 *
 * <p>보낼 수 있는 사람은 <b>그 스터디를 만든 캡틴</b>과 <b>그 반 네비게이터</b>다 ({@code assertCanEditGroup}). 다른 캡틴은 이
 * 스터디에서 크루로 본다.
 */
@Service
public class StudyNoticeService {

    private static final String FORBIDDEN_MESSAGE = "이 반에 공지를 보낼 권한이 없습니다.";
    private static final String WITHDRAWN_SENDER = "탈퇴한 회원";
    private static final int MAX_PAGE_SIZE = 50;

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final AccountRepository accountRepository;
    private final StudyNoticeRepository studyNoticeRepository;
    private final NotificationRepository notificationRepository;
    private final StudyCaptainGuard studyCaptainGuard;
    private final StudyNoticeDiscordGate discordGate;
    private final ApplicationEventPublisher eventPublisher;

    public StudyNoticeService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyParticipantRepository studyParticipantRepository,
            AccountRepository accountRepository,
            StudyNoticeRepository studyNoticeRepository,
            NotificationRepository notificationRepository,
            StudyCaptainGuard studyCaptainGuard,
            StudyNoticeDiscordGate discordGate,
            ApplicationEventPublisher eventPublisher) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.accountRepository = accountRepository;
        this.studyNoticeRepository = studyNoticeRepository;
        this.notificationRepository = notificationRepository;
        this.studyCaptainGuard = studyCaptainGuard;
        this.discordGate = discordGate;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public StudyNoticeComposeResponse compose(Long accountId, Long studyId, Long groupId) {
        Study study = findStudy(studyId);
        StudyGroup group = findGroup(groupId);
        assertAccess(accountId, study, group);

        List<StudyParticipant> roster = roster(groupId);
        Map<Long, Account> accounts =
                accountsOf(roster.stream().map(StudyParticipant::getAccountId));
        List<StudyNoticeComposeResponse.Recipient> recipients =
                roster.stream()
                        .filter(p -> accounts.containsKey(p.getAccountId()))
                        .sorted(
                                Comparator.comparing(
                                                (StudyParticipant p) ->
                                                        p.getStatus() != ParticipantStatus.ACTIVE)
                                        .thenComparing(
                                                p -> accounts.get(p.getAccountId()).getNickname()))
                        .map(
                                p -> {
                                    Account a = accounts.get(p.getAccountId());
                                    return new StudyNoticeComposeResponse.Recipient(
                                            p.getId(),
                                            a.getNickname(),
                                            p.getParticipantRole().name(),
                                            p.getStatus().name(),
                                            StringUtils.hasText(a.getDiscordId()));
                                })
                        .toList();

        Account sender = accountRepository.findById(accountId).orElse(null);
        Optional<DiscordSkipReason> unavailable = discordGate.unavailableReason(studyId, sender);
        Instant now = Instant.now();
        Optional<StudyNotice.SendBlock> block = sendBlock(groupId, now);
        return new StudyNoticeComposeResponse(
                recipients,
                new StudyNoticeComposeResponse.Discord(
                        unavailable.isEmpty(), unavailable.orElse(null)),
                block.isEmpty(),
                block.map(StudyNotice.SendBlock::reason).orElse(null),
                block.map(StudyNotice.SendBlock::nextAvailableAt).orElse(null),
                StudyNotice.remainingToday(todayCount(groupId, now)));
    }

    @Transactional
    public StudyNoticeSendResponse send(
            Long accountId, Long studyId, Long groupId, StudyNoticeRequests.Send request) {
        // 같은 반의 동시 발송을 줄 세운다 — 한도 판정과 저장 사이에 다른 발송이 끼어들지 못한다
        StudyGroup group =
                studyGroupRepository
                        .findByIdForUpdate(groupId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "반을 찾을 수 없습니다."));
        Study study = findStudy(studyId);
        assertAccess(accountId, study, group);
        if (study.isEnded()) {
            throw new BusinessException(ErrorCode.STUDY_ENDED);
        }

        Instant now = Instant.now();
        sendBlock(groupId, now)
                .ifPresent(
                        block -> {
                            throw new BusinessException(
                                    ErrorCode.STUDY_NOTICE_RATE_LIMITED,
                                    blockedMessage(block.reason()));
                        });

        Set<NoticeChannel> channels = new HashSet<>(request.channels());
        if (channels.size() != request.channels().size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "보낼 곳이 겹칩니다.");
        }
        List<Long> accountIds = recipientAccountIds(groupId, request.participantIds());

        StudyNotice notice =
                studyNoticeRepository.save(
                        StudyNotice.create(
                                studyId,
                                groupId,
                                accountId,
                                request.title(),
                                request.body(),
                                channels.contains(NoticeChannel.EMAIL),
                                channels.contains(NoticeChannel.DISCORD),
                                accountIds));
        // 메일 행은 BEFORE_COMMIT 구독자가 이 트랜잭션에 만들고, 디스코드는 커밋 뒤 비동기로 보낸다
        eventPublisher.publishEvent(StudyNoticeSent.of(notice));
        return new StudyNoticeSendResponse(notice.getId(), notice.getRecipients().size());
    }

    @Transactional(readOnly = true)
    public StudyNoticeListResponse list(
            Long accountId, Long studyId, Long groupId, int offset, int limit) {
        Study study = findStudy(studyId);
        StudyGroup group = findGroup(groupId);
        assertAccess(accountId, study, group);

        int pageSize = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
        int start = Math.max(offset, 0);
        List<StudyNotice> notices = studyNoticeRepository.findPage(groupId, pageSize, start);
        long total = studyNoticeRepository.countByStudyGroupId(groupId);
        if (notices.isEmpty()) {
            return new StudyNoticeListResponse(List.of(), total, start, pageSize);
        }

        List<Long> ids = notices.stream().map(StudyNotice::getId).toList();
        Map<Long, StudyNoticeRepository.RecipientCount> recipientCounts =
                studyNoticeRepository.countRecipients(ids).stream()
                        .collect(
                                Collectors.toMap(
                                        StudyNoticeRepository.RecipientCount::getNoticeId,
                                        Function.identity()));
        Map<Long, long[]> mailCounts = mailCounts(ids);
        Map<Long, Account> senders =
                accountsOf(notices.stream().map(StudyNotice::getSenderAccountId));

        List<StudyNoticeListResponse.Item> items =
                notices.stream()
                        .map(
                                n -> {
                                    StudyNoticeRepository.RecipientCount rc =
                                            recipientCounts.get(n.getId());
                                    long[] mail = mailCounts.getOrDefault(n.getId(), new long[3]);
                                    Account sender = senders.get(n.getSenderAccountId());
                                    return new StudyNoticeListResponse.Item(
                                            n.getId(),
                                            n.getTitle(),
                                            n.getBody(),
                                            sender == null
                                                    ? WITHDRAWN_SENDER
                                                    : sender.getNickname(),
                                            n.getCreatedAt(),
                                            rc == null ? 0 : (int) rc.getTotal(),
                                            new StudyNoticeListResponse.Email(
                                                    n.isSendEmail(), mail[0], mail[1], mail[2]),
                                            new StudyNoticeListResponse.Discord(
                                                    n.isSendDiscord(),
                                                    n.getDiscordStatus(),
                                                    n.getDiscordSkipReason(),
                                                    rc == null ? 0 : rc.getMentioned()));
                                })
                        .toList();
        return new StudyNoticeListResponse(items, total, start, pageSize);
    }

    /** 메일 행을 상태별로 센 값 — [대기, 완료, 실패]. 탈퇴로 취소된 건은 세지 않는다. */
    private Map<Long, long[]> mailCounts(Collection<Long> noticeIds) {
        Map<Long, long[]> result = new HashMap<>();
        for (NotificationStatusCount row :
                notificationRepository.countByReferenceAndStatus(
                        NotificationEventType.STUDY_NOTICE, noticeIds)) {
            long[] counts = result.computeIfAbsent(row.referenceId(), k -> new long[3]);
            switch (row.status()) {
                case PENDING, PROCESSING -> counts[0] += row.count();
                case SENT -> counts[1] += row.count();
                case FAILED -> counts[2] += row.count();
                case CANCELLED -> {}
            }
        }
        return result;
    }

    /** compose 와 send 가 같은 재료(직전 발송 시각 · 오늘 보낸 수)로 {@link StudyNotice#sendBlock} 를 부른다. */
    private Optional<StudyNotice.SendBlock> sendBlock(Long groupId, Instant now) {
        Instant lastSentAt =
                studyNoticeRepository
                        .findFirstByStudyGroupIdOrderByCreatedAtDescIdDesc(groupId)
                        .map(StudyNotice::getCreatedAt)
                        .orElse(null);
        return StudyNotice.sendBlock(lastSentAt, todayCount(groupId, now), now);
    }

    private long todayCount(Long groupId, Instant now) {
        return studyNoticeRepository.countByStudyGroupIdAndCreatedAtGreaterThanEqual(
                groupId, StudyNotice.startOfToday(now));
    }

    private static String blockedMessage(SendBlockReason reason) {
        return switch (reason) {
            case COOLDOWN -> "방금 공지를 보냈습니다. 1분 뒤에 다시 보낼 수 있습니다.";
            case DAILY_LIMIT ->
                    "오늘 보낼 수 있는 공지 횟수(" + StudyNotice.DAILY_LIMIT + "회)를 모두 썼습니다. 내일 다시 보낼 수 있습니다.";
        };
    }

    /** 고른 명부 행이 모두 이 반의 참여 중·쉬는 중인지 확인하고 계정 ID 로 바꾼다. 하나라도 아니면 전체를 거절한다. */
    private List<Long> recipientAccountIds(Long groupId, List<Long> participantIds) {
        if (new HashSet<>(participantIds).size() != participantIds.size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "받는 사람이 겹칩니다.");
        }
        Map<Long, StudyParticipant> byId =
                roster(groupId).stream()
                        .collect(Collectors.toMap(StudyParticipant::getId, Function.identity()));
        return participantIds.stream()
                .map(
                        id -> {
                            StudyParticipant p = byId.get(id);
                            if (p == null) {
                                throw new BusinessException(
                                        ErrorCode.INVALID_INPUT, "받는 사람이 이 반의 참여 중·쉬는 중 팀원이 아닙니다.");
                            }
                            return p.getAccountId();
                        })
                .toList();
    }

    private List<StudyParticipant> roster(Long groupId) {
        return studyParticipantRepository.findByStudyGroupIdAndStatusIn(
                groupId, StudyCaptainGuard.ROSTER_STATUSES);
    }

    private Map<Long, Account> accountsOf(java.util.stream.Stream<Long> ids) {
        List<Long> distinct = ids.distinct().toList();
        return accountRepository.findAllById(distinct).stream()
                .collect(Collectors.toMap(Account::getId, Function.identity()));
    }

    private void assertAccess(Long accountId, Study study, StudyGroup group) {
        if (!group.getStudyId().equals(study.getId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "이 스터디의 반이 아닙니다.");
        }
        studyCaptainGuard.assertCanEditGroup(
                accountId, study.getCreatedBy(), group.getId(), FORBIDDEN_MESSAGE);
    }

    private Study findStudy(Long studyId) {
        return studyRepository
                .findById(studyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));
    }

    private StudyGroup findGroup(Long groupId) {
        return studyGroupRepository
                .findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "반을 찾을 수 없습니다."));
    }
}
