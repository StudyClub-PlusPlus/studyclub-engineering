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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 행사 — 운영 목록 · 등록 · 운영 상세 · 수정. 캡틴만 ({@code @RequireAdmin}). 스펙: specs/event/spec.md */
@Tag(name = "백오피스 행사", description = "캡틴이 행사를 등록하고 고치고 운영 현황을 본다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/events")
public class AdminClubEventController {

    private final AdminClubEventService adminClubEventService;

    public AdminClubEventController(AdminClubEventService adminClubEventService) {
        this.adminClubEventService = adminClubEventService;
    }

    @Operation(
            summary = "운영 행사 목록",
            description = "캡틴만 호출 가능. 종료·취소 포함 전부, 시작 시각 내림차순(같으면 ID 내림차순). 행은 행사명 · 일정 · 표시 상태.")
    @GetMapping
    public AdminClubEventListResponse list(
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return adminClubEventService.getEvents(offset, limit);
    }

    @Operation(
            summary = "행사 등록",
            description =
                    "캡틴만 호출 가능. 저장하면 바로 공개(PUBLISHED). Idempotency-Key(UUID v4) 필수 — 같은 계정·같은 키의 재시도는 처음"
                            + " 만든 행사를 201 로 다시 준다.")
    @PostMapping
    public ResponseEntity<AdminClubEventDetailResponse> create(
            @RequestHeader(name = IdempotencyKeys.HEADER, required = false) String idempotencyKey,
            @RequestBody AdminClubEventRequest request,
            Authentication authentication) {
        AdminClubEventDetailResponse created =
                adminClubEventService.create(
                        (Long) authentication.getPrincipal(), idempotencyKey, request);
        return ResponseEntity.created(URI.create("/api/admin/events/" + created.eventId()))
                .body(created);
    }

    @Operation(
            summary = "운영 행사 상세",
            description = "캡틴만 호출 가능. 편집 폼 값 + 참여 방식별 모집 현황 + 지금 할 수 있는 수정 + 저장할 때 돌려보낼 버전.")
    @GetMapping("/{eventId}")
    public AdminClubEventDetailResponse detail(@PathVariable Long eventId) {
        return adminClubEventService.getEvent(eventId);
    }

    @Operation(
            summary = "행사 수정",
            description =
                    "캡틴만 호출 가능. 편집 폼 전체 교체. version · confirmation · questions 필수. 버전이 다르면 409"
                            + " EVENT_VERSION_CONFLICT.")
    @PutMapping("/{eventId}")
    public AdminClubEventDetailResponse update(
            @PathVariable Long eventId,
            @RequestBody AdminClubEventRequest request,
            Authentication authentication) {
        return adminClubEventService.update((Long) authentication.getPrincipal(), eventId, request);
    }
}
