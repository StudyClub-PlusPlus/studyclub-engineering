package com.studyclub.api.event;

import com.studyclub.api.auth.security.RequireOnboarding;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사이트 행사 — 공개 목록 · 상세와 본인 신청 · 신청서 · 취소. 스펙: specs/event-registration/spec.md. 공개 GET 은 보안 설정이
 * {@code /api/events} · {@code /api/events/*} 두 패턴만 연다.
 */
@Tag(name = "행사", description = "크루가 행사를 보고 신청하고 본인 신청을 취소한다")
@RestController
@RequestMapping("/api/events")
public class ClubEventController {

    private final ClubEventSiteService siteService;

    public ClubEventController(ClubEventSiteService siteService) {
        this.siteService = siteService;
    }

    @Operation(
            summary = "행사 목록",
            description =
                    "비로그인도 호출 가능. 예정된 행사(시작이 가까운 순) 다음 지난 행사(최근 순), 페이지 없음. 로그인하면 행사별 내 최신 신청 상태.")
    @GetMapping
    public List<ClubEventListItemResponse> list(Authentication authentication) {
        return siteService.list(optionalAccountId(authentication));
    }

    @Operation(
            summary = "행사 상세",
            description =
                    "비로그인도 호출 가능. 방식별 잔여석 · 현재 질문과 질문 버전 · 신청 가능 여부. 온라인 링크는 온라인으로 참가 확정된 본인에게만"
                            + " myRegistration.onlineUrl 로.")
    @GetMapping("/{eventId}")
    public ClubEventDetailResponse detail(
            @PathVariable Long eventId, Authentication authentication) {
        return siteService.detail(eventId, optionalAccountId(authentication));
    }

    @Operation(
            summary = "행사 신청",
            description =
                    "온보딩을 마친 회원만. Idempotency-Key(UUID v4) 필수 — 같은 계정 · 같은 키의 재시도는 처음 만든 신청을 201 로 다시"
                            + " 준다. 자동 확정 행사면 CONFIRMED, 운영진 확인 행사면 PENDING.")
    @RequireOnboarding
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{eventId}/registrations")
    public ResponseEntity<ClubEventRegistrationFormResponse> submit(
            @PathVariable Long eventId,
            @RequestHeader(name = IdempotencyKeys.HEADER, required = false) String idempotencyKey,
            @RequestBody ClubEventRegistrationRequest request,
            Authentication authentication) {
        ClubEventRegistrationFormResponse created =
                siteService.submit(
                        (Long) authentication.getPrincipal(), eventId, idempotencyKey, request);
        return ResponseEntity.created(URI.create("/api/events/" + eventId + "/registrations/me"))
                .body(created);
    }

    @Operation(summary = "내 신청서", description = "온보딩을 마친 회원만. 이 행사의 내 최신 신청과 신청 당시 질문 · 답.")
    @RequireOnboarding
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/{eventId}/registrations/me")
    public ClubEventRegistrationFormResponse myForm(
            @PathVariable Long eventId, Authentication authentication) {
        return siteService.myForm((Long) authentication.getPrincipal(), eventId);
    }

    @Operation(
            summary = "본인 취소",
            description =
                    "온보딩을 마친 회원만. 화면이 보던 신청(registrationId)만, 신청 마감 시각 전까지. 행은 지우지 않고 CANCELLED 로"
                            + " 남긴다.")
    @RequireOnboarding
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{eventId}/registrations/me")
    public ClubEventRegistrationFormResponse cancel(
            @PathVariable Long eventId,
            @RequestParam(required = false) Long registrationId,
            Authentication authentication) {
        return siteService.cancel((Long) authentication.getPrincipal(), eventId, registrationId);
    }

    // 공개 경로라 비로그인이면 principal 이 없거나 익명 사용자다
    private static Long optionalAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            return null;
        }
        return accountId;
    }
}
