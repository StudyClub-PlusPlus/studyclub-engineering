package com.studyclub.api.notification;

import com.studyclub.common.privacy.EmailMasking;
import com.studyclub.notification.Notification;
import java.time.Instant;
import java.util.List;
import java.util.Set;

public record NotificationListResponse(
        List<NotificationSummary> items, long total, int offset, int limit) {

    public record NotificationSummary(
            Long id,
            String eventType,
            String recipientType,
            String recipientValue,
            String status,
            Long templateId,
            Instant sentAt,
            Instant createdAt,
            boolean canResend) {

        /** {@code existingAccountIds} 는 재발송 판정 재료다 — 재발송 접수와 같은 쿼리로 센 값을 넘긴다. */
        public static NotificationSummary from(
                Notification notification, Set<Long> existingAccountIds) {
            return new NotificationSummary(
                    notification.getId(),
                    notification.getEventType().name(),
                    notification.getRecipientType().name(),
                    EmailMasking.mask(notification.getRecipientValue()),
                    notification.getStatus().name(),
                    notification.getTemplateId(),
                    notification.getSentAt(),
                    notification.getCreatedAt(),
                    notification.canResend(existingAccountIds));
        }
    }
}
