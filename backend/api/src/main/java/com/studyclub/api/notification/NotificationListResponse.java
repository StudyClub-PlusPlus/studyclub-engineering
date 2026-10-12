package com.studyclub.api.notification;

import com.studyclub.common.privacy.EmailMasking;
import com.studyclub.notification.Notification;
import java.time.Instant;
import java.util.List;

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
            Instant createdAt) {

        public static NotificationSummary from(Notification notification) {
            return new NotificationSummary(
                    notification.getId(),
                    notification.getEventType().name(),
                    notification.getRecipientType().name(),
                    EmailMasking.mask(notification.getRecipientValue()),
                    notification.getStatus().name(),
                    notification.getTemplateId(),
                    notification.getSentAt(),
                    notification.getCreatedAt());
        }
    }
}
