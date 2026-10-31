package com.studyclub.api.cleanup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.studyclub.api.audit.AuditRetentionService;
import com.studyclub.api.feedback.FeedbackRetentionService;
import com.studyclub.api.upload.UploadService;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.task.TaskSchedulingAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

class CleanupSchedulerTest {
    private final FeedbackRetentionService feedback = mock(FeedbackRetentionService.class);
    private final UploadService storage = mock(UploadService.class);
    private final AuditRetentionService audit = mock(AuditRetentionService.class);
    private final MeterRegistry registry = new SimpleMeterRegistry();
    private final ApplicationContextRunner context =
            new ApplicationContextRunner()
                    .withConfiguration(AutoConfigurations.of(TaskSchedulingAutoConfiguration.class))
                    .withUserConfiguration(
                            CleanupSchedulingConfig.class,
                            CleanupScheduler.class,
                            CleanupRunner.class)
                    .withBean(FeedbackRetentionService.class, () -> feedback)
                    .withBean(UploadService.class, () -> storage)
                    .withBean(AuditRetentionService.class, () -> audit)
                    .withBean(MeterRegistry.class, () -> registry);

    @Test
    @DisplayName("정리 작업은 전용 스레드에서 독립 실행하고 기본 알림용 스케줄러를 유지한다")
    void isolatesJobsAndKeepsDefaultScheduler() {
        AtomicReference<String> cleanupThread = new AtomicReference<>();
        when(feedback.cleanUpWithResult(any()))
                .thenAnswer(
                        inv -> {
                            cleanupThread.set(Thread.currentThread().getName());
                            throw new IllegalStateException("test");
                        });
        when(storage.cleanUpWithResult(any())).thenReturn(CleanupResult.completed(0, 0));
        when(audit.cleanUp(any())).thenReturn(new CleanupResult(1, 0, 2, false));
        context.withBean(DefaultTask.class)
                .withPropertyValues("cleanup.initial-delay-ms=0")
                .run(
                        ctx -> {
                            assertThat(ctx)
                                    .hasBean("taskScheduler")
                                    .hasBean("dataCleanupScheduler");
                            assertThat(ctx.getBean("taskScheduler"))
                                    .isNotSameAs(ctx.getBean("dataCleanupScheduler"));
                            assertThat(
                                            ((ThreadPoolTaskScheduler) ctx.getBean("taskScheduler"))
                                                    .getPoolSize())
                                    .isEqualTo(1);
                            verify(storage, timeout(3000).atLeastOnce())
                                    .cleanUpWithResult(any(Instant.class));
                            verify(audit, timeout(3000).atLeastOnce()).cleanUp(any(Instant.class));
                            DefaultTask defaultTask = ctx.getBean(DefaultTask.class);
                            assertThat(defaultTask.ran.await(3, TimeUnit.SECONDS)).isTrue();
                            assertThat(defaultTask.thread).doesNotStartWith("data-cleanup-");
                            assertThat(cleanupThread.get()).startsWith("data-cleanup-");
                            // 기본 주기가 하루이므로 시작 직후 각 작업은 한 번만 실행된다.
                            verify(feedback, times(1)).cleanUpWithResult(any());
                        });
    }

    @Test
    @DisplayName("전체 정리를 끄면 스케줄러가 등록되지 않는다")
    void disabled() {
        context.withPropertyValues("cleanup.enabled=false")
                .run(
                        ctx -> {
                            assertThat(ctx).doesNotHaveBean(CleanupScheduler.class);
                            verifyNoInteractions(feedback, storage, audit);
                        });
    }

    @Test
    @DisplayName("개별 작업 비활성화는 다른 모듈이 스케줄링을 켠 경우에도 유지된다")
    void individualDisable() {
        context.withBean(DefaultTask.class)
                .withPropertyValues(
                        "cleanup.initial-delay-ms=0",
                        "feedback.retention.enabled=false",
                        "upload.cleanup.enabled=false",
                        "audit.retention.enabled=false")
                .run(
                        ctx -> {
                            assertThat(
                                            ctx.getBean(DefaultTask.class)
                                                    .ran
                                                    .await(3, TimeUnit.SECONDS))
                                    .isTrue();
                            verifyNoInteractions(feedback, storage, audit);
                            assertThat(
                                            registry.get("cleanup.enabled")
                                                    .tag("task", "audit")
                                                    .gauge()
                                                    .value())
                                    .isZero();
                        });
    }

    static class DefaultTask {
        final CountDownLatch ran = new CountDownLatch(1);
        volatile String thread;

        @Scheduled(fixedDelay = 30000)
        public void run() {
            thread = Thread.currentThread().getName();
            ran.countDown();
        }
    }
}
