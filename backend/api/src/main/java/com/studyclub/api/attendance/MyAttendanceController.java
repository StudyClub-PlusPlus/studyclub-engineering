package com.studyclub.api.attendance;

import com.studyclub.api.auth.security.RequireGroupRoster;
import com.studyclub.api.auth.security.RequireOnboarding;
import com.studyclub.api.study.StudyCaptainGuard;
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
    private final StudyCaptainGuard studyCaptainGuard;

    public MyAttendanceController(
            AttendanceService attendanceService,
            AttendanceUpsertService attendanceUpsertService,
            StudyCaptainGuard studyCaptainGuard) {
        this.attendanceService = attendanceService;
        this.attendanceUpsertService = attendanceUpsertService;
        this.studyCaptainGuard = studyCaptainGuard;
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
            summary = "출석 생성/수정 (upsert) · 참여 중단 — 네비게이터",
            description =
                    "그 분반의 네비게이터(LEADER 역할)만 호출 가능. 분반 소속 LEADER가 아니면 403."
                            + " studyGroupId는 body에 포함. withdrawals(명부 행 ID)가 있으면 같은 트랜잭션에서 참여를 중단한다 —"
                            + " 그 분반의 살아 있는 네비게이터 · 담당 캡틴만 (specs/study-participant).")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @PostMapping
    public ResponseEntity<Void> upsertAttendances(
            @PathVariable Long studyId, @RequestBody @Valid AttendanceUpsertRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        // 참여 중단이 있으면 더 좁은 권한(담당 캡틴 · 그 분반 네비게이터)을 서비스가 스펙 판정 순서대로 본다
        if (!request.hasWithdrawals()) {
            studyCaptainGuard.assertCaptainOrNavigatorOfGroup(
                    accountId, studyId, request.studyGroupId(), "권한이 없습니다.");
        }
        attendanceUpsertService.saveFromSite(accountId, studyId, request);
        return ResponseEntity.noContent().build();
    }
}
