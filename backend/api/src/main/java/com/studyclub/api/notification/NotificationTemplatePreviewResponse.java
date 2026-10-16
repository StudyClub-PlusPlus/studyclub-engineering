package com.studyclub.api.notification;

import com.studyclub.notification.NotificationTemplate;
import java.time.Instant;

/** 공개 미리보기 응답 — 관리용({@link NotificationTemplateResponse})과 달리 운영자 계정 ID 를 싣지 않는다. */
public record NotificationTemplatePreviewResponse(
        Long id, String eventType, String channel, String subject, String body, Instant updatedAt) {

    public static NotificationTemplatePreviewResponse from(NotificationTemplate template) {
        return new NotificationTemplatePreviewResponse(
                template.getId(),
                template.getEventType().name(),
                template.getChannel().name(),
                template.getSubject(),
                template.getBody(),
                template.getUpdatedAt());
    }
}
