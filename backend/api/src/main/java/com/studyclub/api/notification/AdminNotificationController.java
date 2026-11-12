package com.studyclub.api.notification;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 알림 템플릿 관리·발송 이력 조회·재발송 — 캡틴만 ({@code @RequireAdmin}, specs/authz-guards/spec.md). */
@Tag(name = "백오피스 · 알림", description = "알림 템플릿 추가·수정·삭제·조회, 발송 이력 조회, 실패 건 재발송")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminNotificationController {

    private final NotificationTemplateQueryService notificationTemplateQueryService;
    private final NotificationTemplateCommandService notificationTemplateCommandService;
    private final NotificationQueryService notificationQueryService;
    private final NotificationResendService notificationResendService;

    @Operation(summary = "알림 템플릿 목록 조회")
    @GetMapping("/notification-templates")
    public List<NotificationTemplateResponse> notificationTemplates() {
        return notificationTemplateQueryService.listAll();
    }

    @Operation(summary = "알림 템플릿 추가", description = "같은 알림 조건에 이미 템플릿이 있으면 409. 채널은 메일로 고정된다.")
    @PostMapping("/notification-templates")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationTemplateResponse createTemplate(
            @Valid @RequestBody NotificationTemplateRequest request,
            Authentication authentication) {
        return notificationTemplateCommandService.create(
                (Long) authentication.getPrincipal(), request);
    }

    @Operation(summary = "알림 템플릿 수정", description = "조건·제목·본문을 통째로 바꾼다. 바꾸려는 조건에 다른 템플릿이 있으면 409.")
    @PutMapping("/notification-templates/{id}")
    public NotificationTemplateResponse updateTemplate(
            @PathVariable Long id,
            @Valid @RequestBody NotificationTemplateRequest request,
            Authentication authentication) {
        return notificationTemplateCommandService.update(
                (Long) authentication.getPrincipal(), id, request);
    }

    @Operation(summary = "알림 템플릿 삭제", description = "되돌릴 수 없다. 발송 이력은 남는다.")
    @DeleteMapping("/notification-templates/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        notificationTemplateCommandService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "발송 이력 조회",
            description = "ids 를 주면 그 행들만 모두 준다 — 재발송을 접수한 건의 끝(SENT·FAILED)을 쫓을 때 쓴다.")
    @GetMapping("/notifications")
    public NotificationListResponse notifications(
            @RequestParam(required = false) NotificationEventType eventType,
            @RequestParam(required = false) NotificationStatus status,
            @RequestParam(required = false) List<Long> ids,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return notificationQueryService.list(eventType, status, ids, offset, limit);
    }

    @Operation(
            summary = "실패 건 재발송 (접수)",
            description =
                    "고른 FAILED 행을 그 행 그대로 PENDING 으로 되돌린다. 보낼 수 없는 줄은 skipped 로 이유와 함께 돌려준다."
                            + " 접수까지만 응답하며 발송은 폴링이 한다.")
    @PostMapping("/notifications/resend")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public NotificationResendResponse resend(
            @Valid @RequestBody NotificationResendRequest request) {
        return notificationResendService.resend(request.ids());
    }
}
