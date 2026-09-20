package com.studyclub.api.attendance;

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

    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public ResponseEntity<AttendanceResponse> getAttendances(
            @PathVariable Long studyId,
            @RequestParam Long studyGroupId,
            @RequestParam(required = false) Long meetingId) {
        return ResponseEntity.ok(
                attendanceService.getAttendances(studyId, studyGroupId, meetingId));
    }

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
