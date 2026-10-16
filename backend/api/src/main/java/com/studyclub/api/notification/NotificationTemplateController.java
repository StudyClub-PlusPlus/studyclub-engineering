package com.studyclub.api.notification;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 알림 템플릿 공개 미리보기 — 디자이너가 playground 에서 지금 DB 문구를 본다 (specs/notification/spec.md). 문구는 가입한 모든 사람이 받는
 * 메일 본문이라 공개해도 새는 것이 없다. 읽기 전용이고, 관리용 경로({@code /api/admin})와 컨트롤러를 나눈다.
 */
@Tag(name = "알림 템플릿 미리보기", description = "지금 등록된 알림 문구 (공개 · 읽기 전용)")
@RestController
@RequestMapping("/api/notification-templates")
@RequiredArgsConstructor
public class NotificationTemplateController {

    private final NotificationTemplateQueryService notificationTemplateQueryService;

    @Operation(summary = "알림 템플릿 미리보기 목록")
    @GetMapping
    public List<NotificationTemplatePreviewResponse> notificationTemplates() {
        return notificationTemplateQueryService.listPreviews();
    }
}
