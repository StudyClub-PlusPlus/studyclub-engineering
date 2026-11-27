package com.studyclub.api.event;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 행사 메일 — 미리보기 · 보내기 · 이력. 캡틴만 ({@code @RequireAdmin}). 스펙: specs/event-mail/spec.md */
@Tag(name = "백오피스 행사", description = "캡틴이 행사를 등록하고 고치고 운영 현황을 본다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/events/{eventId}/mails")
public class AdminClubEventMailController {

    private final AdminClubEventMailService mailService;

    public AdminClubEventMailController(AdminClubEventMailService mailService) {
        this.mailService = mailService;
    }

    @Operation(
            summary = "행사 메일 미리보기",
            description =
                    "캡틴만 호출 가능. 저장하지 않는다. 공통 제목 · 본문({{nickname}} 만 원문) · 받는 사람 수 · 보낼 수 있는지"
                            + "(canSend · blockedReason). 막혀 있어도 200.")
    @PostMapping("/preview")
    public AdminClubEventMailPreviewResponse preview(
            @PathVariable Long eventId,
            @RequestBody AdminClubEventMailPreviewRequest request,
            Authentication authentication) {
        return mailService.preview((Long) authentication.getPrincipal(), eventId, request);
    }

    @Operation(
            summary = "행사 메일 보내기",
            description =
                    "캡틴만 호출 가능. Idempotency-Key(UUID v4) 필수 — 같은 키의 재시도는 처음 응답을 201 로 다시 준다. 실제 발송은"
                            + " 커밋 뒤 폴러가 한다. 409: EVENT_CANCELLED · EVENT_NOT_CANCELLED · EVENT_MAIL_TEMPLATE_MISSING"
                            + " · EVENT_MAIL_TEMPLATE_CHANGED · EVENT_MAIL_NO_RECIPIENTS.")
    @PostMapping
    public ResponseEntity<AdminClubEventMailDetailResponse> send(
            @PathVariable Long eventId,
            @RequestHeader(name = IdempotencyKeys.HEADER, required = false) String idempotencyKey,
            @RequestBody AdminClubEventMailSendRequest request,
            Authentication authentication) {
        AdminClubEventMailDetailResponse sent =
                mailService.send(
                        (Long) authentication.getPrincipal(), idempotencyKey, eventId, request);
        return ResponseEntity.created(
                        URI.create("/api/admin/events/" + eventId + "/mails/" + sent.mailId()))
                .body(sent);
    }

    @Operation(summary = "행사 메일 이력", description = "캡틴만 호출 가능. 운영자가 보낸 메일만, 최신순. limit 1~50.")
    @GetMapping
    public AdminClubEventMailListResponse list(
            @PathVariable Long eventId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return mailService.list(eventId, offset, limit);
    }

    @Operation(summary = "행사 메일 이력 상세", description = "캡틴만 호출 가능. 발송 당시 제목 · 본문 · 대상과 가린 받는 주소.")
    @GetMapping("/{mailId}")
    public AdminClubEventMailDetailResponse detail(
            @PathVariable Long eventId, @PathVariable Long mailId) {
        return mailService.detail(eventId, mailId);
    }
}
