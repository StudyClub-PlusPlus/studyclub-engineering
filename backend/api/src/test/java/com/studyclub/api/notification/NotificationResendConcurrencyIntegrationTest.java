package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationErrorType;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationStatus;
import com.studyclub.notification.ResendSkipReason;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 캡틴 둘이 같은 실패 건을 동시에 재발송해도 한 번만 접수된다 — 행 잠금({@code findAllByIdInForUpdate})이 같은 줄을 두 번 되돌리지 못하게 하는지
 * 본다 (specs/notification/spec.md 「동시성」). 잠금이 없으면 두 요청이 모두 {@code FAILED} 를 읽어 둘 다 접수하고, 이 테스트가
 * 실패한다.
 *
 * <p>HTTP 를 거치지 않고 서비스를 두 스레드에서 직접 부른다. 타이밍이 우연히 맞아 통과하는 일을 줄이려고 여러 건을 같은 배리어로 출발시킨다.
 */
@SpringBootTest(
        properties =
                "spring.datasource.url=jdbc:h2:mem:notification-resend-concurrency;MODE=MySQL;DB_CLOSE_DELAY=-1")
class NotificationResendConcurrencyIntegrationTest {

    private static final int ROUNDS = 8;

    @Autowired NotificationResendService service;
    @Autowired NotificationRepository notificationRepository;

    @BeforeEach
    @AfterEach
    void clean() {
        notificationRepository.deleteAll();
    }

    private Notification failed() {
        Notification notification =
                notificationRepository.save(
                        Notification.pendingImmediate(
                                NotificationEventType.USER_REGISTERED,
                                NotificationChannel.EMAIL,
                                "race@example.com",
                                null,
                                1L,
                                Map.of("nickname", "홍길동")));
        Instant lockedAt = Instant.now();
        notification.markProcessing(lockedAt);
        notification.markFailed(NotificationErrorType.PROVIDER_ERROR, lockedAt);
        return notificationRepository.save(notification);
    }

    @Test
    @DisplayName("같은 실패 건을 두 요청이 동시에 재발송하면 한쪽만 접수하고 다른 쪽은 NOT_FAILED 로 건너뛴다")
    void onlyOneOfTwoConcurrentResendsIsAccepted() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < ROUNDS; round++) {
                Long id = failed().getId();
                CyclicBarrier start = new CyclicBarrier(2);

                Future<NotificationResendResponse> a =
                        pool.submit(
                                () -> {
                                    start.await(10, TimeUnit.SECONDS);
                                    return service.resend(List.of(id));
                                });
                Future<NotificationResendResponse> b =
                        pool.submit(
                                () -> {
                                    start.await(10, TimeUnit.SECONDS);
                                    return service.resend(List.of(id));
                                });
                NotificationResendResponse first = a.get(20, TimeUnit.SECONDS);
                NotificationResendResponse second = b.get(20, TimeUnit.SECONDS);

                assertThat(first.accepted().size() + second.accepted().size())
                        .as("round %d: 접수는 정확히 한 번", round)
                        .isEqualTo(1);
                assertThat(first.skipped().size() + second.skipped().size()).isEqualTo(1);
                assertThat(
                                List.of(first, second).stream()
                                        .flatMap(r -> r.skipped().stream())
                                        .map(NotificationResendResponse.Skipped::reason))
                        .containsExactly(ResendSkipReason.NOT_FAILED);
                assertThat(notificationRepository.findById(id).orElseThrow().getStatus())
                        .isEqualTo(NotificationStatus.PENDING);
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
