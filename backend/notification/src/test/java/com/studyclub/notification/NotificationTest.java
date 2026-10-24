package com.studyclub.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

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
    @DisplayName("만든 쪽의 ID 참조(referenceId)를 줄 수 있고, 안 주면 null")
    void pendingImmediate_referenceId() {
        Notification withReference =
                Notification.pendingImmediate(
                        NotificationEventType.STUDY_NOTICE,
                        NotificationChannel.EMAIL,
                        "user@example.com",
                        1L,
                        10L,
                        Map.of("title", "공지"),
                        77L);

        assertThat(withReference.getReferenceId()).isEqualTo(77L);
        assertThat(withReference.getEventType()).isEqualTo(NotificationEventType.STUDY_NOTICE);
        assertThat(pending().getReferenceId()).isNull();
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
        notification.markSent(sentAt, lockedAt);
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.SENT);
        assertThat(notification.getSentAt()).isEqualTo(sentAt);
        assertThat(notification.getLockedAt()).isNull();
    }

    @Test
    @DisplayName("PENDING -> PROCESSING -> FAILED, errorType 기록")
    void markProcessing_thenMarkFailed() {
        Notification notification = pending();
        Instant lockedAt = Instant.now();
        notification.markProcessing(lockedAt);

        notification.markFailed(NotificationErrorType.PROVIDER_ERROR, lockedAt);

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

        assertThatThrownBy(() -> notification.markSent(Instant.now(), Instant.now()))
                .isInstanceOf(NotificationClaimLostException.class);
    }

    @Test
    @DisplayName("SENT 는 재수거 대상이 아니다")
    void reclaim_fromSent_throws() {
        Notification notification = pending();
        Instant lockedAt = Instant.now();
        notification.markProcessing(lockedAt);
        notification.markSent(Instant.now(), lockedAt);

        assertThatThrownBy(notification::reclaim).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("재수거로 클레임 토큰이 바뀌면 이전 토큰으로는 완료 처리를 못 한다 — 중복 발송 방지의 근거")
    void markSent_withStaleClaimToken_throwsClaimLost() {
        Notification notification = pending();
        Instant firstLockedAt = Instant.now();
        notification.markProcessing(firstLockedAt);
        notification.reclaim();
        Instant secondLockedAt = firstLockedAt.plusSeconds(1);
        notification.markProcessing(secondLockedAt);

        assertThatThrownBy(() -> notification.markSent(Instant.now(), firstLockedAt))
                .isInstanceOf(NotificationClaimLostException.class);
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PROCESSING);
    }

    private Notification failed(Long recipientUserId) {
        Notification notification =
                Notification.pendingImmediate(
                        NotificationEventType.USER_REGISTERED,
                        NotificationChannel.EMAIL,
                        "user@example.com",
                        recipientUserId,
                        10L,
                        Map.of("nickname", "gildong"));
        Instant lockedAt = Instant.now();
        notification.markProcessing(lockedAt);
        notification.markFailed(NotificationErrorType.PROVIDER_ERROR, lockedAt);
        return notification;
    }

    @Test
    @DisplayName("재발송 — FAILED 가 같은 행 그대로 PENDING 으로 돌아가고 실패 원인·잠금이 비워진다")
    void resend_resetsFailedToPending() {
        Notification notification = failed(1L);

        notification.resend();

        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(notification.getErrorType()).isNull();
        assertThat(notification.getLockedAt()).isNull();
        assertThat(notification.getSentAt()).isNull();
        // 발송 시점 스냅샷은 그대로 쓴다
        assertThat(notification.getRecipientValue()).isEqualTo("user@example.com");
        assertThat(notification.getTemplateId()).isEqualTo(10L);
        assertThat(notification.getPayload()).containsEntry("nickname", "gildong");
    }

    @Test
    @DisplayName("재발송한 건이 또 실패하면 새 원인이 남고 다시 재발송할 수 있다")
    void resend_failAgain_canBeResentAgain() {
        Notification notification = failed(1L);
        notification.resend();
        Instant lockedAt = Instant.now();
        notification.markProcessing(lockedAt);
        notification.markFailed(NotificationErrorType.INVALID_RECIPIENT, lockedAt);

        assertThat(notification.getErrorType()).isEqualTo(NotificationErrorType.INVALID_RECIPIENT);
        assertThat(notification.canResend(Set.of(1L))).isTrue();
    }

    @ParameterizedTest
    @EnumSource(
            value = NotificationStatus.class,
            names = {"PENDING", "PROCESSING", "SENT", "CANCELLED"})
    @DisplayName("FAILED 가 아니면 재발송할 수 없다 — 같은 메일이 두 번 가거나 보낼 이유가 없다")
    void resend_notFailed_isRejected(NotificationStatus status) {
        Notification notification = withStatus(status);

        assertThat(notification.resendSkipReason(Set.of(1L))).contains(ResendSkipReason.NOT_FAILED);
        assertThat(notification.canResend(Set.of(1L))).isFalse();
        assertThatThrownBy(notification::resend).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("수신 계정이 남아 있지 않은 실패 건(탈퇴)은 재발송할 수 없다")
    void resend_recipientGone_isRejected() {
        Notification notification = failed(1L);

        assertThat(notification.resendSkipReason(Set.of(2L)))
                .contains(ResendSkipReason.RECIPIENT_GONE);
        assertThat(notification.canResend(Set.of())).isFalse();
    }

    @Test
    @DisplayName("수신 계정이 있으면 재발송할 수 있다")
    void resend_recipientExists_isAllowed() {
        Notification notification = failed(1L);

        assertThat(notification.resendSkipReason(Set.of(1L))).isEmpty();
        assertThat(notification.canResend(Set.of(1L))).isTrue();
    }

    @Test
    @DisplayName("수신 계정 ID 가 없는 건(운영 공용 발송 등)은 계정 검사를 건너뛴다")
    void resend_withoutRecipientUser_skipsAccountCheck() {
        Notification notification = failed(null);

        assertThat(notification.canResend(Set.of())).isTrue();
    }

    private Notification withStatus(NotificationStatus status) {
        Notification notification = pending();
        Instant lockedAt = Instant.now();
        switch (status) {
            case PENDING -> {}
            case PROCESSING -> notification.markProcessing(lockedAt);
            case SENT -> {
                notification.markProcessing(lockedAt);
                notification.markSent(Instant.now(), lockedAt);
            }
            case CANCELLED -> notification.cancel();
            default -> throw new IllegalArgumentException(status.name());
        }
        return notification;
    }
}
