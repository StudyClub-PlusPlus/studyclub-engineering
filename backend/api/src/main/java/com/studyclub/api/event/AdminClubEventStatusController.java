package com.studyclub.api.event;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 백오피스 행사 상태 전환 — 모집 마감 · 재모집 · 행사 취소. 캡틴만 ({@code @RequireAdmin}). 스펙: specs/event-status/spec.md
 */
@Tag(name = "백오피스 행사", description = "캡틴이 행사를 등록하고 고치고 운영 현황을 본다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/events")
public class AdminClubEventStatusController {

    private final AdminClubEventService adminClubEventService;

    public AdminClubEventStatusController(AdminClubEventService adminClubEventService) {
        this.adminClubEventService = adminClubEventService;
    }

    @Operation(
            summary = "행사 상태 전환",
            description =
                    "캡틴만 호출 가능. status 는 CLOSED(모집 마감) · PUBLISHED(재모집) · CANCELLED(행사 취소), version"
                            + " 은 운영 상세에서 받은 값. 이미 그 상태면 버전과 관계없이 200 으로 현재 상세를 준다. 행사 취소는 확인 대기 ·"
                            + " 참가 확정 신청을 함께 취소하고 감사 기록을 남긴다. 409: EVENT_CANCELLED · EVENT_ENDED ·"
                            + " EVENT_VERSION_CONFLICT · EVENT_ALREADY_STARTED(시작한 행사 재모집) ·"
                            + " EVENT_REOPEN_DEADLINE_PASSED(신청 마감이 지난 행사 재모집).")
    @PatchMapping("/{eventId}/status")
    public AdminClubEventDetailResponse changeStatus(
            @PathVariable Long eventId,
            @Valid @RequestBody AdminClubEventStatusRequest request,
            Authentication authentication) {
        return adminClubEventService.changeStatus(
                (Long) authentication.getPrincipal(), eventId, request);
    }
}
