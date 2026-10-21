package com.studyclub.api.attendance;

import com.studyclub.api.auth.security.RequireGroupRoster;
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

@Tag(name = "출석(내 스터디)", description = "그 분반 참여자 — 출석부 조회 · 네비게이터 upsert")
@RestController
@RequestMapping("/api/me/studies/{studyId}/attendances")
public class MyAttendanceController {

    private final AttendanceService attendanceService;
    private final AttendanceUpsertService attendanceUpsertService;

    public MyAttendanceController(
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
            summary = "출석 저장 · 참여 중단",
            description = "studyGroupId로 분반을 지정한다. 참여 중단은 활성 네비게이터·담당 캡틴만 가능하며 출석과 함께 저장한다.")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @PostMapping
    public ResponseEntity<Void> upsertAttendances(
            @PathVariable Long studyId, @RequestBody @Valid AttendanceUpsertRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        attendanceUpsertService.upsert(studyId, request.studyGroupId(), request, accountId, false);
        return ResponseEntity.noContent().build();
    }
}
