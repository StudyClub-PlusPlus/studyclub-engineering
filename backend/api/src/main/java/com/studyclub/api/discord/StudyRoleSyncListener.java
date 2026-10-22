package com.studyclub.api.discord;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.event.EventMeta;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipantJoined;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.participant.StudyParticipantWithdrawn;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.util.StringUtils;

/**
 * 명부 편입({@code study_participant.joined}, DSC-07)·참여 중단({@code study_participant.withdrawn},
 * DSC-09)이 커밋되면 그 사람의 디스코드 스터디 role 을 명부에 맞춘다 — 명부에 있으면(ACTIVE·PAUSED) 붙이고, 없으면 뗀다. 시스템 호출이다.
 *
 * <p>커밋 뒤·별도 스레드에서 돈다 — 봇은 최대 30초 걸린다. 어떻게 실패해도 던지지 않는다: 명부는 이미 커밋됐고, 어긋난 role 은 운영자가 손으로 맞춘다. 봇
 * role 창구가 멱등이라 같은 신호가 두 번 와도 안전하다. 신호 순서는 뒤바뀔 수 있으므로({@code joined} 직후 {@code withdrawn}) 이벤트가 아니라
 * 명부의 지금 상태를 따른다.
 *
 * <p>같은 스터디·계정은 {@link #roleLock} 으로 줄 세운다. 잠금 안에서 최신 명부를 읽고 봇을 부르므로, 커밋마다 구독자가 하나씩 뒤따르는 한 마지막 구독자가
 * 최신 상태를 반영한다.
 */
@Component
public class StudyRoleSyncListener {

    private static final Logger log = LoggerFactory.getLogger(StudyRoleSyncListener.class);
    private static final List<ParticipantStatus> HOLDS_ROLE =
            List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED);
    // shortcut: JVM 안 잠금이라 API 인스턴스가 하나일 때만 줄이 선다, 여러 대로 늘리면 DB 잠금이나 outbox 로 바꾼다
    private static final Object[] ROLE_LOCKS = new Object[64];

    static {
        Arrays.setAll(ROLE_LOCKS, i -> new Object());
    }

    private final DiscordBotClient discordBotClient;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyDiscordLinkRepository studyDiscordLinkRepository;
    private final AccountRepository accountRepository;

    public StudyRoleSyncListener(
            DiscordBotClient discordBotClient,
            StudyParticipantRepository studyParticipantRepository,
            StudyDiscordLinkRepository studyDiscordLinkRepository,
            AccountRepository accountRepository) {
        this.discordBotClient = discordBotClient;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
        this.accountRepository = accountRepository;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onJoined(StudyParticipantJoined event) {
        sync(event.name(), event.meta(), event.studyId(), event.accountId());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onWithdrawn(StudyParticipantWithdrawn event) {
        sync(event.name(), event.meta(), event.studyId(), event.accountId());
        // TODO(DSC-06): participantRole 이 LEADER 면 네비게이터 role 도 뗀다 — 다른 진행 중 스터디 어디에서도 활성 LEADER 가
        //  아닐 때만 (DSC-08 완료 조건). 봇 네비게이터 창구가 시스템 호출을 받기로 정해진 뒤에 붙인다.
    }

    private void sync(String eventName, EventMeta meta, Long studyId, Long accountId) {
        if (!discordBotClient.isConfigured()) {
            log.info("{} {}: 스터디 role 맞추기 건너뜀, 봇 설정 없음", eventName, meta.eventId());
            return;
        }
        try {
            synchronized (roleLock(studyId, accountId)) {
                syncStudyRole(eventName, meta, studyId, accountId);
            }
        } catch (BusinessException e) {
            log.warn(
                    "{} {}: 스터디 {} 계정 {} 스터디 role 맞추기 실패, 손으로 맞춘다: {}",
                    eventName,
                    meta.eventId(),
                    studyId,
                    accountId,
                    e.getMessage());
        } catch (RuntimeException e) {
            // 메시지는 남기지 않는다 — HTTP 클라이언트 예외 메시지에 헤더 값(API 키)이 실릴 수 있다
            log.warn(
                    "{} {}: 스터디 {} 계정 {} 스터디 role 맞추기 실패 ({}), 손으로 맞춘다",
                    eventName,
                    meta.eventId(),
                    studyId,
                    accountId,
                    e.getClass().getName());
        }
    }

    private void syncStudyRole(String eventName, EventMeta meta, Long studyId, Long accountId) {
        Optional<StudyDiscordLink> link = studyDiscordLinkRepository.findByStudyId(studyId);
        if (link.isEmpty()) {
            log.info("{} {}: 스터디 {} 는 디스코드 연결 없음", eventName, meta.eventId(), studyId);
            return;
        }
        Optional<String> discordUserId =
                accountRepository
                        .findById(accountId)
                        .map(Account::getDiscordId)
                        .filter(StringUtils::hasText);
        if (discordUserId.isEmpty()) {
            log.info("{} {}: 계정 {} 은 디스코드 미연동", eventName, meta.eventId(), accountId);
            return;
        }

        boolean holds =
                studyParticipantRepository.existsByStudyIdAndAccountIdAndStatusIn(
                        studyId, accountId, HOLDS_ROLE);
        String requesterId = discordBotClient.systemUserId();
        String roleId = link.get().getDiscordRoleId();
        String discordStudyId = link.get().getDiscordStudyId();
        List<String> users = List.of(discordUserId.get());
        DiscordBotClient.RoleChangeResult result =
                holds
                        ? discordBotClient.assignRole(requesterId, roleId, discordStudyId, users)
                        : discordBotClient.removeRole(requesterId, roleId, discordStudyId, users);
        String action = holds ? "부여" : "회수";
        if (!result.failed().isEmpty()) {
            // 부여의 NOT_IN_GUILD 는 연동 뒤 길드를 나간 사람이다 — 다시 들어오면 손으로 붙인다
            log.warn(
                    "{} {}: 스터디 {} 계정 {} 스터디 role {} 실패 (봇 응답), 손으로 맞춘다: {}",
                    eventName,
                    meta.eventId(),
                    studyId,
                    accountId,
                    action,
                    result.failed());
            return;
        }
        log.info(
                "{} {}: 스터디 {} 계정 {} 스터디 role {}",
                eventName,
                meta.eventId(),
                studyId,
                accountId,
                action);
    }

    /** 같은 스터디·계정의 스터디 role 을 바꾸는 구독자가 잡는 잠금. */
    static Object roleLock(Long studyId, Long accountId) {
        return ROLE_LOCKS[Math.floorMod(Objects.hash(studyId, accountId), ROLE_LOCKS.length)];
    }
}
