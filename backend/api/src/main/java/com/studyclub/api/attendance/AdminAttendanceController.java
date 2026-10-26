package com.studyclub.api.attendance;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.api.auth.security.RequireOnboarding;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "출석(어드민)", description = "캡틴 — 출석 명부 조회 · upsert · 참여 중단")
@RestController
@RequestMapping("/api/admin/studies/{studyId}/attendances")
@RequireAdmin
public class AdminAttendanceController {

    private final AttendanceService attendanceService;
    private final AttendanceUpsertService attendanceUpsertService;

    public AdminAttendanceController(
            AttendanceService attendanceService, AttendanceUpsertService attendanceUpsertService) {
        this.attendanceService = attendanceService;
        this.attendanceUpsertService = attendanceUpsertService;
    }

    @Operation(
            summary = "출석 명부 조회",
            description = "지정한 분반의 명부. 캡틴(SYSTEM_ROLE=ADMIN)만 (specs/authz-guards).")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @GetMapping
    public ResponseEntity<AttendanceResponse> getAttendances(
            @PathVariable Long studyId,
            @RequestParam Long studyGroupId,
            @RequestParam(required = false) Long meetingId,
            @RequestParam(defaultValue = "false") boolean includeWithdrawn) {
        return ResponseEntity.ok(
                attendanceService.getAttendances(
                        studyId, studyGroupId, meetingId, includeWithdrawn));
    }

    @Operation(
            summary = "출석 생성/수정 (upsert) · 참여 중단",
            description =
                    "캡틴. body의 studyGroupId로 분반을 지정하고, updates의 모든 회차는 그 분반이어야 한다."
                            + " withdrawals(명부 행 ID)가 있으면 같은 트랜잭션에서 참여를 중단한다 — 담당 캡틴만, 크루 · 네비게이터"
                            + " (specs/study-participant).")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @PostMapping
    public ResponseEntity<Void> upsertAttendances(
            @PathVariable Long studyId, @RequestBody @Valid AttendanceUpsertRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        attendanceUpsertService.saveFromBackOffice(accountId, studyId, request);
        return ResponseEntity.noContent().build();
    }
}
