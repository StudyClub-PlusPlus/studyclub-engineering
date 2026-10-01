package com.studyclub.api.notification;

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

/**
 * 백오피스 전용 조회 — 지금은 로그인(인증)만 요구하고 {@code SystemRole.ADMIN} 여부는 확인하지 않는다.
 * specs/back-office-login/spec.md 가 "로그인 뒤 요청의 ADMIN 판별은 후속 PR 에서 요청마다 DB 조회로 붙인다"고 명시적으로 후속 PR 로
 * 미뤄뒀다 — 그 가드(#78 의 accountId principal 기준)가 붙기 전까지는 로그인한 어떤 계정이든 이 엔드포인트를 호출할 수 있다.
 */
@Tag(name = "백오피스 · 알림", description = "알림 템플릿·발송 이력 조회 (읽기 전용)")
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
