package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.api.config.AsyncConfig;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.event.EventMeta;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipantJoined;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.participant.StudyParticipantWithdrawn;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/** 명부 편입·참여 중단 → 스터디 role 을 명부에 맞춘다. 봇은 목이라 아무 데도 보내지 않는다. */
class StudyRoleSyncListenerTest {

    private static final Long STUDY_ID = 10L;
    private static final Long ACCOUNT_ID = 7L;
    private static final String SYSTEM_ID = "1327394882193880000";
    private static final String DISCORD_USER_ID = "1327394882193880001";
    private static final String DISCORD_STUDY_ID = "1327394882193883136";
    private static final String DISCORD_ROLE_ID = "1327394882193883140";
    private static final StudyParticipantWithdrawn EVENT =
            new StudyParticipantWithdrawn(
                    EventMeta.now(1L), STUDY_ID, 100L, ACCOUNT_ID, ParticipantRole.MEMBER);
    private static final StudyParticipantJoined JOINED =
            new StudyParticipantJoined(
                    EventMeta.now(ACCOUNT_ID), STUDY_ID, 100L, ACCOUNT_ID, ParticipantRole.MEMBER);
    private static final DiscordBotClient.RoleChangeResult OK =
            new DiscordBotClient.RoleChangeResult(1, List.of());

    private final DiscordBotClient bot = mock(DiscordBotClient.class);
    private final StudyParticipantRepository participants = mock(StudyParticipantRepository.class);
    private final StudyDiscordLinkRepository links = mock(StudyDiscordLinkRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final StudyRoleSyncListener listener =
            new StudyRoleSyncListener(bot, participants, links, accounts);

    @BeforeEach
    void 연결된_스터디와_연동한_계정() {
        lenient().when(bot.isConfigured()).thenReturn(true);
        lenient().when(bot.systemUserId()).thenReturn(SYSTEM_ID);
        lenient()
                .when(links.findByStudyId(STUDY_ID))
                .thenReturn(
                        Optional.of(
                                new StudyDiscordLink(STUDY_ID, DISCORD_STUDY_ID, DISCORD_ROLE_ID)));
        linkedAccount(DISCORD_USER_ID);
    }

    private void linkedAccount(String discordId) {
        Account account = mock(Account.class);
        lenient().when(account.getDiscordId()).thenReturn(discordId);
        lenient().when(accounts.findById(ACCOUNT_ID)).thenReturn(Optional.of(account));
    }

    @Test
    void 중단되면_시스템_호출로_스터디_role_을_뗀다() {
        when(bot.removeRole(anyString(), anyString(), anyString(), anyList())).thenReturn(OK);

        listener.onWithdrawn(EVENT);

        verify(bot)
                .removeRole(SYSTEM_ID, DISCORD_ROLE_ID, DISCORD_STUDY_ID, List.of(DISCORD_USER_ID));
    }

    @Test
    void 같은_신호가_두_번_와도_같은_회수를_다시_부를_뿐이다() {
        when(bot.removeRole(anyString(), anyString(), anyString(), anyList())).thenReturn(OK);

        listener.onWithdrawn(EVENT);
        assertThatCode(() -> listener.onWithdrawn(EVENT)).doesNotThrowAnyException();

        verify(bot, times(2))
                .removeRole(SYSTEM_ID, DISCORD_ROLE_ID, DISCORD_STUDY_ID, List.of(DISCORD_USER_ID));
    }

    @Test
    void 디스코드_미연동_계정은_건너뛴다() {
        linkedAccount(null);

        listener.onWithdrawn(EVENT);

        verify(bot, never()).removeRole(any(), any(), any(), any());
    }

    @Test
    void 디스코드_연결이_없는_스터디는_건너뛴다() {
        when(links.findByStudyId(STUDY_ID)).thenReturn(Optional.empty());

        listener.onWithdrawn(EVENT);

        verify(bot, never()).removeRole(any(), any(), any(), any());
    }

    @Test
    void 중단_신호가_왔어도_그사이_명부에_다시_들어왔으면_role_을_붙인다() {
        inRoster(true);
        when(bot.assignRole(anyString(), anyString(), anyString(), anyList())).thenReturn(OK);

        listener.onWithdrawn(EVENT);

        verify(bot, never()).removeRole(any(), any(), any(), any());
        verify(bot)
                .assignRole(SYSTEM_ID, DISCORD_ROLE_ID, DISCORD_STUDY_ID, List.of(DISCORD_USER_ID));
    }

    @Test
    void 편입되면_시스템_호출로_스터디_role_을_붙인다() {
        inRoster(true);
        when(bot.assignRole(anyString(), anyString(), anyString(), anyList())).thenReturn(OK);

        listener.onJoined(JOINED);

        verify(bot)
                .assignRole(SYSTEM_ID, DISCORD_ROLE_ID, DISCORD_STUDY_ID, List.of(DISCORD_USER_ID));
        verify(bot, never()).removeRole(any(), any(), any(), any());
    }

    @Test
    void 편입_신호가_늦게_와서_이미_중단됐으면_role_을_뗀다() {
        inRoster(false);
        when(bot.removeRole(anyString(), anyString(), anyString(), anyList())).thenReturn(OK);

        listener.onJoined(JOINED);

        verify(bot, never()).assignRole(any(), any(), any(), any());
        verify(bot)
                .removeRole(SYSTEM_ID, DISCORD_ROLE_ID, DISCORD_STUDY_ID, List.of(DISCORD_USER_ID));
    }

    @Test
    void 편입한_사람이_길드에_없어도_던지지_않는다() {
        inRoster(true);
        when(bot.assignRole(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(
                        new DiscordBotClient.RoleChangeResult(
                                0,
                                List.of(
                                        new DiscordBotClient.FailedUser(
                                                DISCORD_USER_ID, "NOT_IN_GUILD"))));

        assertThatCode(() -> listener.onJoined(JOINED)).doesNotThrowAnyException();
    }

    @Test
    void 편입한_계정이_미연동이면_건너뛴다() {
        inRoster(true);
        linkedAccount(null);

        listener.onJoined(JOINED);

        verify(bot, never()).assignRole(any(), any(), any(), any());
    }

    private void inRoster(boolean holds) {
        when(participants.existsByStudyIdAndAccountIdAndStatusIn(any(), any(), any()))
                .thenReturn(holds);
    }

    @Test
    void 같은_사람의_회수는_한_번에_하나씩_봇을_부른다() throws Exception {
        AtomicInteger inFlight = new AtomicInteger();
        AtomicInteger maxInFlight = new AtomicInteger();
        CountDownLatch bothInside = new CountDownLatch(2);
        when(bot.removeRole(anyString(), anyString(), anyString(), anyList()))
                .thenAnswer(
                        inv -> {
                            maxInFlight.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
                            // 잠금이 없으면 두 번째 호출이 이 안으로 들어와 겹친다 — 들어올 틈을 준다
                            bothInside.countDown();
                            bothInside.await(300, TimeUnit.MILLISECONDS);
                            inFlight.decrementAndGet();
                            return OK;
                        });

        Thread other = new Thread(() -> listener.onWithdrawn(EVENT));
        other.start();
        listener.onWithdrawn(EVENT);
        other.join();

        verify(bot, times(2)).removeRole(anyString(), anyString(), anyString(), anyList());
        assertThat(maxInFlight.get()).isEqualTo(1);
    }

    @Test
    void 봇_설정이_없으면_부르지_않는다() {
        when(bot.isConfigured()).thenReturn(false);

        listener.onWithdrawn(EVENT);

        verify(bot, never()).removeRole(any(), any(), any(), any());
    }

    @Test
    void 봇이_실패해도_던지지_않는다() {
        when(bot.removeRole(anyString(), anyString(), anyString(), anyList()))
                .thenThrow(new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "거절"));

        assertThatCode(() -> listener.onWithdrawn(EVENT)).doesNotThrowAnyException();
    }

    @Test
    void 봇이_일부_실패를_돌려줘도_던지지_않는다() {
        when(bot.removeRole(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(
                        new DiscordBotClient.RoleChangeResult(
                                0,
                                List.of(
                                        new DiscordBotClient.FailedUser(
                                                DISCORD_USER_ID, "DISCORD_REJECTED"))));

        assertThatCode(() -> listener.onWithdrawn(EVENT)).doesNotThrowAnyException();
    }

    @Test
    void 시스템_봇_ID_가_없어도_던지지_않는다() {
        when(bot.systemUserId())
                .thenThrow(new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "봇 ID 없음"));

        assertThatCode(() -> listener.onWithdrawn(EVENT)).doesNotThrowAnyException();
        verify(bot, never()).removeRole(any(), any(), any(), any());
    }

    @EnableTransactionManagement
    static class TxEvents {}

    @Test
    void 발행하면_다른_스레드에서_회수한다() {
        AtomicReference<String> thread = new AtomicReference<>();
        doAnswer(
                        inv -> {
                            thread.set(Thread.currentThread().getName());
                            return OK;
                        })
                .when(bot)
                .removeRole(anyString(), anyString(), anyString(), anyList());
        try (var ctx = new AnnotationConfigApplicationContext()) {
            ctx.registerBean(DiscordBotClient.class, () -> bot);
            ctx.registerBean(StudyParticipantRepository.class, () -> participants);
            ctx.registerBean(StudyDiscordLinkRepository.class, () -> links);
            ctx.registerBean(AccountRepository.class, () -> accounts);
            ctx.register(TxEvents.class, AsyncConfig.class, StudyRoleSyncListener.class);
            ctx.refresh();

            ctx.publishEvent(EVENT);

            verify(bot, timeout(2000))
                    .removeRole(
                            SYSTEM_ID, DISCORD_ROLE_ID, DISCORD_STUDY_ID, List.of(DISCORD_USER_ID));
            assertThat(thread.get()).startsWith("event-");
        }
    }
}
