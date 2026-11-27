package com.studyclub.api.timezone;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 운영자별 백오피스 헤더 표시 시간대. specs/timezone/spec.md §7 */
@Tag(name = "백오피스 시간대", description = "회원 시간대 후보 · 운영자 표시 시간대")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/me/display-time-zone")
public class AdminDisplayTimeZoneController {

    private final AdminDisplayTimeZoneService service;

    public AdminDisplayTimeZoneController(AdminDisplayTimeZoneService service) {
        this.service = service;
    }

    @Operation(summary = "내 표시 시간대 조회", description = "저장된 헤더 값 · 프로필 · 적용 결과(헤더 → 프로필 → 서울).")
    @GetMapping
    public AdminDisplayTimeZoneResponse get(Authentication authentication) {
        return service.get((Long) authentication.getPrincipal());
    }

    @Operation(
            summary = "내 표시 시간대 저장",
            description = "지역 이름이 있는 IANA 시간대만. 프로필 시간대와 저장된 마감 시각은 바꾸지 않는다.")
    @PatchMapping
    public AdminDisplayTimeZoneResponse change(
            @Valid @RequestBody AdminDisplayTimeZoneRequest request,
            Authentication authentication) {
        return service.change((Long) authentication.getPrincipal(), request);
    }
}
