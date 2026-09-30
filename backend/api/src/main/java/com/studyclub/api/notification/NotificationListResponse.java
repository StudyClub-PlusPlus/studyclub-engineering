package com.studyclub.api.notification;

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
                    maskEmail(notification.getRecipientValue()),
                    notification.getStatus().name(),
                    notification.getTemplateId(),
                    notification.getSentAt(),
                    notification.getCreatedAt());
        }

        /**
         * {@code h***@gmail.com} — security-guide.md 의 이메일 마스킹 규칙. 두 번째 사용처가 생기면 공용 유틸로 승격한다
         * (specs/notification/spec.md).
         */
        private static String maskEmail(String email) {
            if (email == null) {
                return "***";
            }
            int at = email.indexOf('@');
            if (at < 1) {
                return "***";
            }
            return email.charAt(0) + "***" + email.substring(at);
        }
    }
}
