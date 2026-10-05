package com.studyclub.api.notification;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 알림 조회 — 캡틴만 ({@code @RequireAdmin}, specs/authz-guards/spec.md). */
@Tag(name = "백오피스 · 알림", description = "알림 템플릿·발송 이력 조회 (읽기 전용)")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminNotificationController {

    private final NotificationTemplateQueryService notificationTemplateQueryService;
    private final NotificationQueryService notificationQueryService;

    @Operation(summary = "알림 템플릿 목록 조회")
    @GetMapping("/notification-templates")
    public List<NotificationTemplateResponse> notificationTemplates() {
        return notificationTemplateQueryService.listAll();
    }

    @Operation(summary = "발송 이력 조회")
    @GetMapping("/notifications")
    public NotificationListResponse notifications(
            @RequestParam(required = false) NotificationEventType eventType,
            @RequestParam(required = false) NotificationStatus status,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return notificationQueryService.list(eventType, status, offset, limit);
    }
}
