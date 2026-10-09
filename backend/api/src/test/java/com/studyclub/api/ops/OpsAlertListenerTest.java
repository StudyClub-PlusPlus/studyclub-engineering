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

import com.studyclub.api.config.AsyncConfig;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.application.StudyApplicationSubmitted;
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
        OpsAlertListener listener = new OpsAlertListener(notifier, mock(AccountRepository.class));
        assertThatCode(() -> listener.onStudyApplicationSubmitted(EVENT))
                .doesNotThrowAnyException();
    }
}
