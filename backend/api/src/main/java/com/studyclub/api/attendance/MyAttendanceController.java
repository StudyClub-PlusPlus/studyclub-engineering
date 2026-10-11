package com.studyclub.api.attendance;

import com.studyclub.api.auth.security.RequireGroupRoster;
import com.studyclub.api.auth.security.RequireOnboarding;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "출석(내 스터디)", description = "그 분반 참여자 — 출석부 조회 (읽기 전용)")
@RestController
@RequestMapping("/api/me/studies/{studyId}/attendances")
public class MyAttendanceController {

    private final AttendanceService attendanceService;

    public MyAttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
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
}
