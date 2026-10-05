package com.studyclub.api.notification;

import com.studyclub.notification.NotificationTemplate;
import java.time.Instant;

public record NotificationTemplateResponse(
        Long id,
        String eventType,
        String channel,
        String subject,
        String body,
        Instant updatedAt,
        Long updatedByAdminId) {

    public static NotificationTemplateResponse from(NotificationTemplate template) {
        return new NotificationTemplateResponse(
                template.getId(),
                template.getEventType().name(),
                template.getChannel().name(),
                template.getSubject(),
                template.getBody(),
                template.getUpdatedAt(),
                template.getUpdatedByAdminId());
    }
}
