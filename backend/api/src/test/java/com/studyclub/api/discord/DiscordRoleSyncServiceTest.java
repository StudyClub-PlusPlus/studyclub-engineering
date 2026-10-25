package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.api.discord.DiscordRoleChangeRequest.Change;
import com.studyclub.api.discord.DiscordRoleChangeRequest.Role;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 웹 기준과 디스코드 role 을 맞추는 판정. 봇은 목이라 아무 데도 보내지 않는다 (specs/discord-role-sync/spec.md). */
class DiscordRoleSyncServiceTest {

    private static final String SYSTEM_ID = "1327394882193880000";
    private static final String GUILD_ID = "1327394882193889999";
    private static final String NAVIGATOR = "1327394882193880001";
    private static final String STRANGER = "1327394882193880002";
    private static final String CAPTAIN = "1327394882193880003";
    private static final DiscordBotClient.RoleChangeResult OK =
            new DiscordBotClient.RoleChangeResult(1, List.of());

    private final DiscordBotClient bot = mock(DiscordBotClient.class);
    private final StudyParticipantRepository participants = mock(StudyParticipantRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);

    @BeforeEach
    void 웹_기준() {
        when(bot.isConfigured()).thenReturn(true);
        when(bot.systemUserId()).thenReturn(SYSTEM_ID);
        when(participants.findNavigatorDiscordIds()).thenReturn(List.of(NAVIGATOR));
        when(accounts.findCaptainDiscordIds()).thenReturn(List.of(CAPTAIN));
        when(bot.assignNavigatorRole(anyString(), anyString(), anyList())).thenReturn(OK);
        when(bot.removeNavigatorRole(anyString(), anyString(), anyList())).thenReturn(OK);
    }

    private DiscordRoleSyncService service(boolean enforce) {
        return new DiscordRoleSyncService(bot, participants, accounts, GUILD_ID, enforce);
    }

    private static DiscordRoleChangeRequest change(String user, Role role, Change change) {
        return new DiscordRoleChangeRequest(user, role, change, Instant.now());
    }

    @Test
    void 웹_navigator_가_아닌데_디스코드에서_붙였으면_시스템_아이디로_뗀다() {
        service(true).reconcileChange(change(STRANGER, Role.NAVIGATOR, Change.ADDED));

        verify(bot).removeNavigatorRole(SYSTEM_ID, GUILD_ID, List.of(STRANGER));
        verify(bot, never()).assignNavigatorRole(any(), any(), any());
    }

    @Test
    void 웹_navigator_인데_디스코드에서_뗐으면_다시_붙인다() {
        service(true).reconcileChange(change(NAVIGATOR, Role.NAVIGATOR, Change.REMOVED));

        verify(bot).assignNavigatorRole(SYSTEM_ID, GUILD_ID, List.of(NAVIGATOR));
    }

    @Test
    void 바뀐_상태가_웹_기준과_같으면_봇을_부르지_않는다() {
        service(true).reconcileChange(change(NAVIGATOR, Role.NAVIGATOR, Change.ADDED));
        service(true).reconcileChange(change(STRANGER, Role.NAVIGATOR, Change.REMOVED));

        verify(bot, never()).assignNavigatorRole(any(), any(), any());
        verify(bot, never()).removeNavigatorRole(any(), any(), any());
    }

    @Test
    void enforce_가_꺼져_있으면_어긋나도_디스코드를_바꾸지_않는다() {
        service(false).reconcileChange(change(STRANGER, Role.NAVIGATOR, Change.ADDED));

        verify(bot, never()).removeNavigatorRole(any(), any(), any());
    }

    @Test
    void captain_은_어긋나도_봇을_부르지_않는다() {
        service(true).reconcileChange(change(STRANGER, Role.CAPTAIN, Change.ADDED));
        service(true).reconcileChange(change(CAPTAIN, Role.CAPTAIN, Change.REMOVED));

        verify(bot, never()).assignNavigatorRole(any(), any(), any());
        verify(bot, never()).removeNavigatorRole(any(), any(), any());
    }

    @Test
    void 명단은_양쪽으로_비교해_없는_사람은_붙이고_웹_기준_밖은_뗀다() {
        service(true)
                .reconcileMembers(
                        new DiscordRoleMembersRequest(
                                Instant.now(), List.of(CAPTAIN), List.of(STRANGER)));

        verify(bot).assignNavigatorRole(SYSTEM_ID, GUILD_ID, List.of(NAVIGATOR));
        verify(bot).removeNavigatorRole(SYSTEM_ID, GUILD_ID, List.of(STRANGER));
    }

    @Test
    void 명단의_회수_대상은_100명씩_나눠_부른다() {
        List<String> many =
                IntStream.range(0, 150)
                        .mapToObj(i -> String.valueOf(1327394882193890000L + i))
                        .toList();

        service(true)
                .reconcileMembers(
                        new DiscordRoleMembersRequest(
                                Instant.now(), List.of(), concat(many, List.of(NAVIGATOR))));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> batches = ArgumentCaptor.forClass(List.class);
        verify(bot, times(2)).removeNavigatorRole(eq(SYSTEM_ID), eq(GUILD_ID), batches.capture());
        assertThat(batches.getAllValues()).extracting(List::size).containsExactly(100, 50);
        verify(bot, never()).assignNavigatorRole(any(), any(), any());
    }

    @Test
    void 한_묶음이_실패해도_다음_묶음을_부르고_던지지_않는다() {
        List<String> many =
                IntStream.range(0, 150)
                        .mapToObj(i -> String.valueOf(1327394882193890000L + i))
                        .toList();
        when(bot.removeNavigatorRole(anyString(), anyString(), anyList()))
                .thenThrow(new IllegalStateException("bot down"))
                .thenReturn(OK);

        assertThatCode(
                        () ->
                                service(true)
                                        .reconcileMembers(
                                                new DiscordRoleMembersRequest(
                                                        Instant.now(),
                                                        List.of(),
                                                        concat(many, List.of(NAVIGATOR)))))
                .doesNotThrowAnyException();

        verify(bot, times(2)).removeNavigatorRole(anyString(), anyString(), anyList());
    }

    @Test
    void 봇_설정이나_길드_ID_가_없으면_건너뛴다() {
        new DiscordRoleSyncService(bot, participants, accounts, "", true)
                .reconcileChange(change(STRANGER, Role.NAVIGATOR, Change.ADDED));

        verify(bot, never()).removeNavigatorRole(any(), any(), any());
    }

    @Test
    void 비동기_진입점은_어떻게_실패해도_던지지_않는다() {
        when(participants.findNavigatorDiscordIds()).thenThrow(new IllegalStateException("db"));

        assertThatCode(
                        () ->
                                service(true)
                                        .onRoleChanged(
                                                change(STRANGER, Role.NAVIGATOR, Change.ADDED)))
                .doesNotThrowAnyException();
    }

    private static List<String> concat(List<String> a, List<String> b) {
        return java.util.stream.Stream.concat(a.stream(), b.stream()).toList();
    }
}
