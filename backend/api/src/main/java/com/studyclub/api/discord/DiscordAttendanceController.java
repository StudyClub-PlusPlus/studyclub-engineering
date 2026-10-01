package com.studyclub.api.discord;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 디스코드 봇 전용 진입점. 사용자 JWT 가 아니라 X-API-Key 로 인증한다 (SecurityConfig 의 discordChain).
 *
 * <p>경로에 버전 세그먼트가 없는 건 이 레포 관례다. 봇 문서의 {@code /api/v1/...} 은 봇(FastAPI) 쪽 경로다.
 */
@RestController
@RequestMapping("/api/discord/studies/{discordStudyId}")
public class DiscordAttendanceController {

    private final DiscordAttendanceService discordAttendanceService;

    public DiscordAttendanceController(DiscordAttendanceService discordAttendanceService) {
        this.discordAttendanceService = discordAttendanceService;
    }

    @Operation(
            summary = "디스코드 일괄 출석 체크",
            description =
                    "보이스 채널 참가자 스냅샷으로 출석을 찍는다. 회차는 호출자가 고르지 않고 백엔드가 판정한다"
                            + " (진행 중 회차 → 없으면 now ±2h 예정 회차 자동 시작).")
    @SecurityRequirement(name = "discordApiKey")
    @PostMapping("/attendances")
    public ResponseEntity<DiscordAttendanceResponse> markAttendances(
            @PathVariable String discordStudyId,
            @Valid @RequestBody DiscordAttendanceRequest request) {
        return ResponseEntity.ok(discordAttendanceService.mark(discordStudyId, request));
    }
}
