package com.studyclub.api.studygroup;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 참여자 — 캡틴만 ({@code @RequireAdmin}). specs/study-group/spec.md */
@Tag(name = "백오피스 참여자", description = "캡틴이 참여 명단을 보고 참여자의 반·역할을 지정한다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/studies/{studyId}/participants")
public class AdminStudyParticipantController {

    private final AdminStudyParticipantService adminStudyParticipantService;
    private final AdminStudyParticipantQueryService adminStudyParticipantQueryService;

    public AdminStudyParticipantController(
            AdminStudyParticipantService adminStudyParticipantService,
            AdminStudyParticipantQueryService adminStudyParticipantQueryService) {
        this.adminStudyParticipantService = adminStudyParticipantService;
        this.adminStudyParticipantQueryService = adminStudyParticipantQueryService;
    }

    @Operation(
            summary = "참여 명단",
            description =
                    "ADMIN만 호출 가능. 반 · 담당(네비게이터)과 함께 준다. 기본은 ACTIVE · PAUSED,"
                            + " includeLeft=true 면 WITHDRAWN 도. DELETED(탈퇴)는 늘 뺀다.")
    @GetMapping
    public StudyParticipantsResponse list(
            @PathVariable Long studyId, @RequestParam(defaultValue = "false") boolean includeLeft) {
        return adminStudyParticipantQueryService.list(studyId, includeLeft);
    }

    @Operation(
            summary = "역할·반 한 번에 바꾸기",
            description =
                    "ADMIN만 호출 가능. 신청자 탭 「저장」. all-or-nothing 트랜잭션."
                            + " 반 이동 시 옛 반 예정 회차 발표자 칸 비우기 + 새 반 예정 회차 ABSENT 생성.")
    @PatchMapping
    public BulkUpdateParticipantResponse bulkUpdate(
            @PathVariable Long studyId,
            @Valid @RequestBody BulkUpdateParticipantRequest request,
            Authentication authentication) {
        Long actorAccountId = (Long) authentication.getPrincipal();
        return adminStudyParticipantService.bulkUpdate(studyId, request, actorAccountId);
    }
}
