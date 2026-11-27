package com.studyclub.api.event;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 백오피스 행사 참가자 — 목록 · 신청서 · 이메일 보기 · 참가 처리. 캡틴만 ({@code @RequireAdmin}). 스펙:
 * specs/event-participant/spec.md
 */
@Tag(name = "백오피스 행사", description = "캡틴이 행사를 등록하고 고치고 운영 현황을 본다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/events/{eventId}/registrations")
public class AdminClubEventRegistrationController {

    private final AdminClubEventRegistrationService registrationService;

    public AdminClubEventRegistrationController(
            AdminClubEventRegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    @Operation(
            summary = "행사 참가자 목록",
            description =
                    "캡틴만 호출 가능. 그 행사의 모든 신청 행(취소 · 재신청 이력 포함), 최신 신청순. 이메일은 가린 값만. 행마다 지금 할 수 있는"
                            + " 처리(canConfirm · canDecline · canCancel).")
    @GetMapping
    public AdminClubEventRegistrationListResponse list(
            @PathVariable Long eventId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return registrationService.list(eventId, offset, limit);
    }

    @Operation(summary = "행사 신청서", description = "캡틴만 호출 가능. 신청 당시 질문 사본과 답. 답은 언제나 문자열 배열.")
    @GetMapping("/{registrationId}")
    public AdminClubEventRegistrationDetailResponse detail(
            @PathVariable Long eventId, @PathVariable Long registrationId) {
        return registrationService.detail(eventId, registrationId);
    }

    @Operation(
            summary = "신청자 이메일 원본 보기",
            description =
                    "캡틴만 호출 가능. 신청자 한 명의 이메일 원본을 돌려주고 감사 로그(EMAIL_REVEAL)를 남긴다. 기록이 안 남으면 이메일도 안"
                            + " 나간다. 탈퇴한 신청자는 404. 응답은 캐시하지 않는다(no-store).")
    @PostMapping("/{registrationId}/email-reveals")
    public ResponseEntity<AdminClubEventRegistrationEmailResponse> revealEmail(
            @PathVariable Long eventId,
            @PathVariable Long registrationId,
            Authentication authentication) {
        return ResponseEntity.ok()
                // 원본이 브라우저·프록시 캐시에 남지 않게 한다
                .cacheControl(CacheControl.noStore())
                .body(
                        registrationService.revealEmail(
                                (Long) authentication.getPrincipal(), eventId, registrationId));
    }

    @Operation(
            summary = "참가 처리",
            description =
                    "캡틴만 호출 가능. status 는 CONFIRMED(참가 확정) · DECLINED(참가 불가) · CANCELLED(개별 취소). 409:"
                            + " EVENT_CANCELLED · EVENT_ENDED · EVENT_REGISTRATION_STATUS_NOT_ALLOWED.")
    @PatchMapping("/{registrationId}")
    public AdminClubEventRegistrationItemResponse decide(
            @PathVariable Long eventId,
            @PathVariable Long registrationId,
            @RequestBody AdminClubEventRegistrationDecisionRequest request,
            Authentication authentication) {
        return registrationService.decide(
                (Long) authentication.getPrincipal(), eventId, registrationId, request);
    }
}
