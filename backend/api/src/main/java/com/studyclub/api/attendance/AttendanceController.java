package com.studyclub.api.attendance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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

    @Operation(summary = "출석 명부 조회", description = "지정한 그룹의 전체 명부를 반환한다. meetingId로 특정 회차만 필터링 가능.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public ResponseEntity<AttendanceResponse> getAttendances(
            @PathVariable Long studyId,
            @RequestParam Long studyGroupId,
            @RequestParam(required = false) Long meetingId) {
        return ResponseEntity.ok(
                attendanceService.getAttendances(studyId, studyGroupId, meetingId));
    }

    @Operation(
            summary = "출석 생성/수정 (upsert)",
            description = "캡틴 전용. 기존 레코드가 있으면 status를 갱신하고, 없으면 새로 생성한다.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<Void> upsertAttendances(
            @PathVariable Long studyId,
            @RequestBody @Valid AttendanceUpsertRequest request,
            Authentication authentication) {
        Long accountId = (Long) authentication.getPrincipal();
        attendanceUpsertService.upsert(studyId, accountId, request);
        return ResponseEntity.noContent().build();
    }
}
