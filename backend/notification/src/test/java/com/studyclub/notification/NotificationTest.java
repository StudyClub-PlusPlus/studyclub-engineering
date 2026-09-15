package com.studyclub.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class NotificationTest {

    private Notification pending() {
        return Notification.pendingImmediate(
                NotificationEventType.USER_REGISTERED,
                NotificationChannel.EMAIL,
                "user@example.com",
                1L,
                10L,
                Map.of("nickname", "gildong"));
    }

    @Test
    @DisplayName("pendingImmediate 로 만들면 PENDING, scheduledAt=null")
    void pendingImmediate_createsPending() {
        Notification notification = pending();

        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(notification.getScheduledAt()).isNull();
        assertThat(notification.getRecipientValue()).isEqualTo("user@example.com");
        assertThat(notification.getPayload()).containsEntry("nickname", "gildong");
    }

    @Test
    @DisplayName("PENDING -> PROCESSING -> SENT 정상 전이")
    void markProcessing_thenMarkSent() {
        Notification notification = pending();
        Instant lockedAt = Instant.now();

        notification.markProcessing(lockedAt);
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PROCESSING);
        assertThat(notification.getLockedAt()).isEqualTo(lockedAt);

        Instant sentAt = Instant.now();
        notification.markSent(sentAt);
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.SENT);
        assertThat(notification.getSentAt()).isEqualTo(sentAt);
        assertThat(notification.getLockedAt()).isNull();
    }

    @Test
    @DisplayName("PENDING -> PROCESSING -> FAILED, errorType 기록")
    void markProcessing_thenMarkFailed() {
        Notification notification = pending();
        notification.markProcessing(Instant.now());

        notification.markFailed(NotificationErrorType.PROVIDER_ERROR);

        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(notification.getErrorType()).isEqualTo(NotificationErrorType.PROVIDER_ERROR);
        assertThat(notification.getLockedAt()).isNull();
    }

    @Test
    @DisplayName("재수거 — PROCESSING 을 다시 PENDING 으로")
    void reclaim_returnsToPending() {
        Notification notification = pending();
        notification.markProcessing(Instant.now());

        notification.reclaim();

        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(notification.getLockedAt()).isNull();
    }

    @Test
    @DisplayName("PENDING 에서 바로 SENT 로는 못 간다")
    void markSent_fromPending_throws() {
        Notification notification = pending();

        assertThatThrownBy(() -> notification.markSent(Instant.now()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("SENT 는 재수거 대상이 아니다")
    void reclaim_fromSent_throws() {
        Notification notification = pending();
        notification.markProcessing(Instant.now());
        notification.markSent(Instant.now());

        assertThatThrownBy(notification::reclaim).isInstanceOf(IllegalStateException.class);
    }
}
