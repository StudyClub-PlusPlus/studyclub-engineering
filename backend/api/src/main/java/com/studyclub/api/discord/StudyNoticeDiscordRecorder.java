package com.studyclub.api.discord;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.notice.DiscordDeliveryStatus;
import com.studyclub.domain.notice.DiscordSkipReason;
import com.studyclub.domain.notice.StudyNotice;
import com.studyclub.domain.notice.StudyNoticeRecipient;
import com.studyclub.domain.notice.StudyNoticeRepository;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 공지의 디스코드 발송이 DB 를 읽고 쓰는 짧은 트랜잭션들. 봇 호출(최대 30초)은 트랜잭션 밖에서 해야 해서, 읽기({@link #prepare})와 결과 기록을 따로
 * 둔다 — 호출하는 {@link StudyNoticeDiscordListener} 가 그 사이에서 봇을 부른다.
 */
@Service
public class StudyNoticeDiscordRecorder {

    private final StudyNoticeRepository studyNoticeRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyDiscordLinkRepository studyDiscordLinkRepository;
    private final AccountRepository accountRepository;
    private final StudyNoticeDiscordGate gate;

    public StudyNoticeDiscordRecorder(
            StudyNoticeRepository studyNoticeRepository,
            StudyGroupRepository studyGroupRepository,
            StudyDiscordLinkRepository studyDiscordLinkRepository,
            AccountRepository accountRepository,
            StudyNoticeDiscordGate gate) {
        this.studyNoticeRepository = studyNoticeRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
        this.accountRepository = accountRepository;
        this.gate = gate;
    }

    /**
     * 봇을 부르는 데 필요한 값. 건너뛸 이유가 있으면 이 안에서 건너뜀으로 기록하고 비어 있는 값을 돌려준다.
     *
     * @return 이미 처리됐거나 디스코드를 고르지 않았거나 건너뛰었으면 비어 있다
     */
    @Transactional
    public Optional<Plan> prepare(Long noticeId) {
        StudyNotice notice = studyNoticeRepository.findById(noticeId).orElse(null);
        if (notice == null || notice.getDiscordStatus() != DiscordDeliveryStatus.PENDING) {
            return Optional.empty();
        }
        Account sender = accountRepository.findById(notice.getSenderAccountId()).orElse(null);
        Optional<DiscordSkipReason> unavailable =
                gate.unavailableReason(notice.getStudyId(), sender);
        if (unavailable.isPresent()) {
            notice.markDiscordSkipped(unavailable.get());
            return Optional.empty();
        }
        StudyDiscordLink link =
                studyDiscordLinkRepository.findByStudyId(notice.getStudyId()).orElseThrow();
        String groupName =
                studyGroupRepository
                        .findById(notice.getStudyGroupId())
                        .map(StudyGroup::getName)
                        .orElse("");
        List<Long> recipientIds =
                notice.getRecipients().stream().map(StudyNoticeRecipient::getAccountId).toList();
        // 디스코드를 연동하지 않은 사람은 멘션에서 빠진다 — 글은 올라가지만 그 사람은 알림을 받지 못한다 (메일은 간다)
        Map<Long, String> discordIds =
                accountRepository.findAllById(recipientIds).stream()
                        .filter(a -> StringUtils.hasText(a.getDiscordId()))
                        .collect(Collectors.toMap(Account::getId, Account::getDiscordId));
        return Optional.of(
                new Plan(
                        notice.getId(),
                        notice.getTitle(),
                        notice.getBody(),
                        groupName,
                        gate.requesterId(sender),
                        link.getDiscordStudyId(),
                        recipientIds.stream()
                                .filter(discordIds::containsKey)
                                .collect(
                                        Collectors.toMap(
                                                Function.identity(),
                                                discordIds::get,
                                                (a, b) -> a,
                                                java.util.LinkedHashMap::new))));
    }

    @Transactional
    public void markSent(Long noticeId, Collection<Long> mentionedAccountIds) {
        studyNoticeRepository
                .findById(noticeId)
                .ifPresent(notice -> notice.markDiscordSent(mentionedAccountIds));
    }

    @Transactional
    public void markSkipped(Long noticeId, DiscordSkipReason reason) {
        studyNoticeRepository
                .findById(noticeId)
                .ifPresent(notice -> notice.markDiscordSkipped(reason));
    }

    @Transactional
    public void markFailed(Long noticeId) {
        studyNoticeRepository.findById(noticeId).ifPresent(StudyNotice::markDiscordFailed);
    }

    /**
     * @param mentionable 멘션할 사람 — 계정 ID → 디스코드 ID. 받는 사람 중 디스코드를 연동한 사람만, 고른 순서대로
     */
    public record Plan(
            Long noticeId,
            String title,
            String body,
            String groupName,
            String requesterDiscordId,
            String discordStudyId,
            Map<Long, String> mentionable) {}
}
