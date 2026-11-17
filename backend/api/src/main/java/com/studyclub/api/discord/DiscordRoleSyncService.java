package com.studyclub.api.discord;

import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 디스코드의 captain · navigator role 을 웹 기준에 맞춘다 (DSC-16, specs/discord-role-sync/spec.md).
 *
 * <p>navigator 는 봇 navigator 창구로 붙이거나 뗀다. captain 은 봇에 창구가 없어 경고 로그만 남긴다.
 *
 * <p>{@code discord.role-sync.enforce} 가 꺼져 있으면(기본) 디스코드를 바꾸지 않고 어긋남만 남긴다 — 디스코드에는 웹보다 먼저 손으로 붙인 지난
 * 기수 navigator role 이 있어서, 켜자마자 맞추면 첫 명단에서 한꺼번에 떨어진다.
 *
 * <p>커밋 뒤 구독자({@link StudyRoleSyncListener})처럼 별도 스레드에서 돌고, 어떻게 실패해도 던지지 않는다 — 다음 날 명단이 다시 맞춘다.
 */
@Service
public class DiscordRoleSyncService {

    private static final Logger log = LoggerFactory.getLogger(DiscordRoleSyncService.class);
    // 봇 role 창구가 한 번에 받는 최대 인원
    static final int BATCH = 100;

    private final DiscordBotClient discordBotClient;
    private final StudyParticipantRepository studyParticipantRepository;
    private final AccountRepository accountRepository;
    private final String guildId;
    private final boolean enforce;

    public DiscordRoleSyncService(
            DiscordBotClient discordBotClient,
            StudyParticipantRepository studyParticipantRepository,
            AccountRepository accountRepository,
            @Value("${discord.guild-id:}") String guildId,
            @Value("${discord.role-sync.enforce:false}") boolean enforce) {
        this.discordBotClient = discordBotClient;
        this.studyParticipantRepository = studyParticipantRepository;
        this.accountRepository = accountRepository;
        this.guildId = guildId;
        this.enforce = enforce;
    }

    @Async
    public void onRoleChanged(DiscordRoleChangeRequest request) {
        try {
            reconcileChange(request);
        } catch (RuntimeException e) {
            // 메시지는 남기지 않는다 — HTTP 클라이언트 예외 메시지에 헤더 값(API 키)이 실릴 수 있다
            log.warn("디스코드 role 변경 알림 처리 실패 ({})", e.getClass().getName());
        }
    }

    @Async
    public void onRoleMembers(DiscordRoleMembersRequest request) {
        try {
            reconcileMembers(request);
        } catch (RuntimeException e) {
            log.warn("디스코드 role 명단 처리 실패 ({})", e.getClass().getName());
        }
    }

    /** 바뀐 뒤 상태(change)가 웹 기준과 같으면 할 일이 없다. 다르면 그 한 사람을 웹 기준으로 돌린다. */
    void reconcileChange(DiscordRoleChangeRequest request) {
        String userId = request.discordUserId();
        boolean has = request.change() == DiscordRoleChangeRequest.Change.ADDED;
        boolean should =
                switch (request.role()) {
                    case CAPTAIN -> accountRepository.findCaptainDiscordIds().contains(userId);
                    case NAVIGATOR ->
                            studyParticipantRepository.findNavigatorDiscordIds().contains(userId);
                };
        if (has == should) {
            return;
        }
        if (request.role() == DiscordRoleChangeRequest.Role.CAPTAIN) {
            log.warn(
                    "디스코드 captain role 이 웹 캡틴과 어긋난다 ({} {} at {}) — 봇에 captain 창구가 없어 손으로 맞춘다",
                    userId,
                    request.change(),
                    request.occurredAt());
            return;
        }
        changeNavigators(List.of(userId), should);
    }

    /** 명단과 웹 기준을 양쪽으로 비교한다. navigator 는 맞추고, captain 은 어긋난 사람을 남긴다. */
    void reconcileMembers(DiscordRoleMembersRequest request) {
        Set<String> expected = new HashSet<>(studyParticipantRepository.findNavigatorDiscordIds());
        Set<String> actual = new LinkedHashSet<>(request.navigators());
        changeNavigators(minus(expected, actual), true);
        changeNavigators(minus(actual, expected), false);

        Set<String> captains = new HashSet<>(accountRepository.findCaptainDiscordIds());
        Set<String> captainRoles = new LinkedHashSet<>(request.captains());
        List<String> notCaptain = minus(captainRoles, captains);
        List<String> missingRole = minus(captains, captainRoles);
        if (!notCaptain.isEmpty() || !missingRole.isEmpty()) {
            log.warn(
                    "디스코드 captain role 이 웹 캡틴과 어긋난다 (명단 {}) — 웹 캡틴 아님 {} · role 없음 {}, 손으로 맞춘다",
                    request.snapshotAt(),
                    notCaptain,
                    missingRole);
        }
    }

    private void changeNavigators(List<String> users, boolean assign) {
        if (users.isEmpty()) {
            return;
        }
        String action = assign ? "부여" : "회수";
        if (!enforce) {
            log.warn(
                    "디스코드 navigator role 어긋남 — {} 대상 {}명 (기록만, enforce 꺼짐): {}",
                    action,
                    users.size(),
                    users);
            return;
        }
        if (!discordBotClient.isConfigured() || !StringUtils.hasText(guildId)) {
            log.warn(
                    "디스코드 navigator role {} 대상 {}명 건너뜀, 봇 설정 또는 DISCORD_CONFIG_GUILD_ID 없음",
                    action,
                    users.size());
            return;
        }
        String requesterId = discordBotClient.systemUserId();
        for (int from = 0; from < users.size(); from += BATCH) {
            // 부르기 직전에 웹 기준을 다시 읽는다 — 앞 묶음을 처리하는 사이 네비게이터로 지정 · 해제된 사람을 낡은 기준으로 건드리지 않게
            Set<String> now = new HashSet<>(studyParticipantRepository.findNavigatorDiscordIds());
            List<String> batch =
                    users.subList(from, Math.min(from + BATCH, users.size())).stream()
                            .filter(id -> now.contains(id) == assign)
                            .toList();
            if (batch.isEmpty()) {
                continue;
            }
            try {
                // navigator role 은 길드에 하나라 스터디가 없다 — discordStudyId 는 봇이 로그에만 쓰므로 길드 ID 를 싣는다
                DiscordBotClient.RoleChangeResult result =
                        assign
                                ? discordBotClient.assignNavigatorRole(requesterId, guildId, batch)
                                : discordBotClient.removeNavigatorRole(requesterId, guildId, batch);
                if (!result.failed().isEmpty()) {
                    log.warn("디스코드 navigator role {} 일부 실패 (봇 응답): {}", action, result.failed());
                }
                log.info("디스코드 navigator role {} {}명", action, result.succeededCount());
            } catch (RuntimeException e) {
                log.warn(
                        "디스코드 navigator role {} {}명 실패 ({})",
                        action,
                        batch.size(),
                        e.getClass().getName());
            }
        }
    }

    private static List<String> minus(Set<String> from, Set<String> other) {
        return from.stream().filter(id -> !other.contains(id)).toList();
    }
}
