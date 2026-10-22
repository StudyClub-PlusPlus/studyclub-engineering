package com.studyclub.api.discord;

import com.studyclub.common.error.BusinessException;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.participant.ParticipantStatus;
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
 * 참여 중단({@code study_participant.withdrawn})이 커밋되면 그 사람의 디스코드 스터디 role 을 시스템 호출로 뗀다 (DSC-09).
 *
 * <p>커밋 뒤·별도 스레드에서 돈다 — 봇은 최대 30초 걸린다. 어떻게 실패해도 던지지 않는다: 중단은 이미 커밋됐고, 남은 role 은 운영자가 손으로 뗀다. 봇 role
 * 창구가 멱등이라 같은 신호가 두 번 와도 안전하다. 신호 순서는 뒤바뀔 수 있으므로({@code withdrawn} 직후 다시 편입) 봇을 부르기 전에 명부를 다시 본다.
 *
 * <p>같은 스터디·계정의 role 변경은 {@link #roleLock} 으로 줄 세운다. 잠금 안에서 최신 명부를 읽고 봇을 부르므로, 커밋마다 구독자가 하나씩 뒤따르는 한
 * 마지막 구독자가 최신 상태를 반영한다. 스터디 role 부여(DSC-07)도 같은 잠금을 잡아야 회수와 엇갈리지 않는다.
 */
@Component
public class StudyRoleRevokeListener {

    private static final Logger log = LoggerFactory.getLogger(StudyRoleRevokeListener.class);
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

    public StudyRoleRevokeListener(
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
    public void onWithdrawn(StudyParticipantWithdrawn event) {
        if (!discordBotClient.isConfigured()) {
            log.info("withdrawn {}: 스터디 role 회수 건너뜀, 봇 설정 없음", event.meta().eventId());
            return;
        }
        try {
            synchronized (roleLock(event.studyId(), event.accountId())) {
                revokeStudyRole(event);
            }
        } catch (BusinessException e) {
            log.warn(
                    "withdrawn {}: 스터디 {} 계정 {} 스터디 role 회수 실패, 손으로 뗀다: {}",
                    event.meta().eventId(),
                    event.studyId(),
                    event.accountId(),
                    e.getMessage());
        } catch (RuntimeException e) {
            // 메시지는 남기지 않는다 — HTTP 클라이언트 예외 메시지에 헤더 값(API 키)이 실릴 수 있다
            log.warn(
                    "withdrawn {}: 스터디 {} 계정 {} 스터디 role 회수 실패 ({}), 손으로 뗀다",
                    event.meta().eventId(),
                    event.studyId(),
                    event.accountId(),
                    e.getClass().getName());
        }
        // TODO(DSC-06): participantRole 이 LEADER 면 네비게이터 role 도 뗀다 — 다른 진행 중 스터디 어디에서도 활성 LEADER 가
        //  아닐 때만 (DSC-08 완료 조건). 봇 네비게이터 창구가 시스템 호출을 받기로 정해진 뒤에 붙인다.
    }

    private void revokeStudyRole(StudyParticipantWithdrawn event) {
        // 그사이 같은 스터디에 다시 들어왔으면 role 은 그대로 둔다
        if (studyParticipantRepository.existsByStudyIdAndAccountIdAndStatusIn(
                event.studyId(), event.accountId(), HOLDS_ROLE)) {
            log.info("withdrawn {}: 명부에 다시 들어와 있어 role 을 두고 간다", event.meta().eventId());
            return;
        }
        Optional<StudyDiscordLink> link = studyDiscordLinkRepository.findByStudyId(event.studyId());
        if (link.isEmpty()) {
            log.info("withdrawn {}: 스터디 {} 는 디스코드 연결 없음", event.meta().eventId(), event.studyId());
            return;
        }
        Optional<String> discordUserId =
                accountRepository
                        .findById(event.accountId())
                        .map(Account::getDiscordId)
                        .filter(StringUtils::hasText);
        if (discordUserId.isEmpty()) {
            log.info("withdrawn {}: 계정 {} 은 디스코드 미연동", event.meta().eventId(), event.accountId());
            return;
        }

        DiscordBotClient.RoleChangeResult result =
                discordBotClient.removeRole(
                        discordBotClient.systemUserId(),
                        link.get().getDiscordRoleId(),
                        link.get().getDiscordStudyId(),
                        List.of(discordUserId.get()));
        if (!result.failed().isEmpty()) {
            log.warn(
                    "withdrawn {}: 스터디 {} 계정 {} 스터디 role 회수를 봇이 못 했다, 손으로 뗀다: {}",
                    event.meta().eventId(),
                    event.studyId(),
                    event.accountId(),
                    result.failed());
            return;
        }
        log.info(
                "withdrawn {}: 스터디 {} 계정 {} 스터디 role 회수",
                event.meta().eventId(),
                event.studyId(),
                event.accountId());
    }

    /** 같은 스터디·계정의 스터디 role 을 바꾸는 구독자가 잡는 잠금. */
    static Object roleLock(Long studyId, Long accountId) {
        return ROLE_LOCKS[Math.floorMod(Objects.hash(studyId, accountId), ROLE_LOCKS.length)];
    }
}
