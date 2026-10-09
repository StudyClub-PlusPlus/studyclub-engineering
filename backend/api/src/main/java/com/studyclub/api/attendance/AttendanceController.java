package com.studyclub.api.attendance;

import com.studyclub.api.auth.security.RequireCaptainOrNavigator;
import com.studyclub.api.auth.security.RequireGroupRoster;
import com.studyclub.api.auth.security.RequireOnboarding;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "출석", description = "출석 명부 조회 · upsert")
@RestController
@RequestMapping("/api/studies/{studyId}/attendances")
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final AttendanceUpsertService attendanceUpsertService;

    public AttendanceController(
            AttendanceService attendanceService, AttendanceUpsertService attendanceUpsertService) {
        this.attendanceService = attendanceService;
        this.attendanceUpsertService = attendanceUpsertService;
    }

    @Operation(
            summary = "출석 명부 조회",
            description = "지정한 분반의 명부. 그 분반의 활성 참여자(크루 포함) · 네비게이터 · 캡틴 (specs/authz-guards).")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @RequireGroupRoster
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
            summary = "출석 생성/수정 (upsert)",
            description = "캡틴 또는 그 분반 네비게이터. studyGroupId 쿼리로 분반을 지정하고, body 회차는 모두 그 분반이어야 한다.")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @RequireCaptainOrNavigator(scope = RequireCaptainOrNavigator.Scope.GROUP)
    @PostMapping
    public ResponseEntity<Void> upsertAttendances(
            @PathVariable Long studyId,
            @RequestParam Long studyGroupId,
            @RequestBody @Valid AttendanceUpsertRequest request) {
        attendanceUpsertService.upsert(studyId, studyGroupId, request);
        return ResponseEntity.noContent().build();
    }
}
