package com.studyclub.api.ops;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.api.config.AsyncConfig;
import com.studyclub.common.event.EventMeta;
import com.studyclub.domain.account.AccountDeleted;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.application.StudyApplicationSubmitted;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/** 발행 → 리스너(@Async, 커밋 뒤) → notifier. notifier 는 목이라 아무 데도 보내지 않는다. */
class OpsAlertListenerTest {

    @EnableTransactionManagement
    static class TxEvents {}

    private AnnotationConfigApplicationContext context(OpsAlertNotifier notifier) {
        AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext();
        ctx.registerBean(OpsAlertNotifier.class, () -> notifier);
        ctx.registerBean(AccountRepository.class, () -> mock(AccountRepository.class));
        ctx.registerBean(StudyRepository.class, () -> mock(StudyRepository.class));
        ctx.registerBean(
                StudyDiscordLinkRepository.class, () -> mock(StudyDiscordLinkRepository.class));
        ctx.register(TxEvents.class, AsyncConfig.class, OpsAlertListener.class);
        ctx.refresh();
        return ctx;
    }

    private static final StudyApplicationSubmitted EVENT =
            StudyApplicationSubmitted.of(7L, 3L, "알고리즘 스터디", 11L, "길동");

    @Test
    void 신청_이벤트를_발행하면_다른_스레드에서_notifier_가_불린다() {
        OpsAlertNotifier notifier = mock(OpsAlertNotifier.class);
        AtomicReference<String> thread = new AtomicReference<>();
        doAnswer(
                        inv -> {
                            thread.set(Thread.currentThread().getName());
                            return null;
                        })
                .when(notifier)
                .send(any(), any(), anyMap());
        try (var ctx = context(notifier)) {
            ctx.publishEvent(EVENT);

            verify(notifier, timeout(2000))
                    .send(eq(OpsAlertNotifier.Level.INFO), eq("스터디 신청 접수"), anyMap());
            assertThat(thread.get()).startsWith("event-");
        }
    }

    @Test
    void notifier_가_던져도_발행자에게_새지_않는다() {
        OpsAlertNotifier notifier = mock(OpsAlertNotifier.class);
        doThrow(new IllegalStateException("boom")).when(notifier).send(any(), any(), anyMap());
        try (var ctx = context(notifier)) {
            assertThatCode(() -> ctx.publishEvent(EVENT)).doesNotThrowAnyException();
            verify(notifier, timeout(2000)).send(any(), any(), anyMap());
        }
    }

    @Test
    void 리스너는_예외를_삼킨다() {
        OpsAlertNotifier notifier = mock(OpsAlertNotifier.class);
        doThrow(new IllegalStateException("boom")).when(notifier).send(any(), any(), anyMap());
        OpsAlertListener listener =
                new OpsAlertListener(
                        notifier,
                        mock(AccountRepository.class),
                        mock(StudyRepository.class),
                        mock(StudyDiscordLinkRepository.class));
        assertThatCode(() -> listener.onStudyApplicationSubmitted(EVENT))
                .doesNotThrowAnyException();
    }

    @Test
    void 탈퇴_이벤트를_발행하면_다른_스레드에서_탈퇴_알림이_나간다() {
        OpsAlertNotifier notifier = mock(OpsAlertNotifier.class);
        AtomicReference<String> thread = new AtomicReference<>();
        doAnswer(
                        inv -> {
                            thread.set(Thread.currentThread().getName());
                            return null;
                        })
                .when(notifier)
                .send(any(), any(), anyMap());
        try (var ctx = context(notifier)) {
            ctx.publishEvent(
                    new AccountDeleted(
                            EventMeta.now(11L), 11L, "길동", null, null, List.of(), false));

            verify(notifier, timeout(2000))
                    .send(eq(OpsAlertNotifier.Level.INFO), eq("회원 탈퇴"), anyMap());
            assertThat(thread.get()).startsWith("event-");
        }
    }

    @Test
    void 탈퇴_알림은_스터디마다_디스코드_role_을_붙이고_지워진_스터디는_ID_만_남긴다() {
        OpsAlertNotifier notifier = mock(OpsAlertNotifier.class);
        StudyRepository studyRepository = mock(StudyRepository.class);
        when(studyRepository.findAllById(List.of(3L, 4L, 5L)))
                .thenReturn(
                        List.of(
                                Study.builder().id(3L).title("알고리즘 스터디").build(),
                                Study.builder().id(4L).title("영어 스터디").build()));
        StudyDiscordLinkRepository linkRepository = mock(StudyDiscordLinkRepository.class);
        when(linkRepository.findByStudyId(3L))
                .thenReturn(Optional.of(new StudyDiscordLink(3L, "d-3", "555")));
        when(linkRepository.findByStudyId(4L)).thenReturn(Optional.empty());
        OpsAlertListener listener =
                new OpsAlertListener(
                        notifier, mock(AccountRepository.class), studyRepository, linkRepository);

        listener.onAccountDeleted(
                new AccountDeleted(
                        EventMeta.now(11L),
                        11L,
                        "길동",
                        "1234",
                        "gildong",
                        List.of(3L, 4L, 5L),
                        true));

        verify(notifier)
                .send(
                        OpsAlertNotifier.Level.INFO,
                        "회원 탈퇴",
                        Map.of(
                                "닉네임", "길동",
                                "디스코드", "gildong (1234)",
                                "참여 중이던 스터디",
                                        "알고리즘 스터디 (#3) · <@&555> (555)\n"
                                                + "영어 스터디 (#4) · 디스코드 미연결\n"
                                                + "#5 (삭제된 스터디)",
                                "네비게이터", "예"));
    }
}
