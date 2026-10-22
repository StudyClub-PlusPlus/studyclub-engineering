package com.studyclub.api.studygroup;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 참여자 — 캡틴만 ({@code @RequireAdmin}). specs/study-group/spec.md */
@Tag(name = "백오피스 참여자", description = "캡틴이 참여자의 반·역할을 지정한다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/studies/{studyId}/participants")
public class AdminStudyParticipantController {

    private final AdminStudyParticipantService adminStudyParticipantService;

    public AdminStudyParticipantController(
            AdminStudyParticipantService adminStudyParticipantService) {
        this.adminStudyParticipantService = adminStudyParticipantService;
    }

    @Operation(
            summary = "반·역할 한 번에 바꾸기",
            description =
                    "ADMIN만 호출 가능. 신청자 탭 「저장」. all-or-nothing 트랜잭션."
                            + " 반 이동 시 옛 반 예정 회차 발표자 칸 비우기 + 출석 삭제, 새 반 예정 회차 ABSENT 생성.")
    @PatchMapping
    public BulkUpdateParticipantResponse bulkUpdateRoles(
            @PathVariable Long studyId,
            @Valid @RequestBody BulkUpdateParticipantRequest request,
            Authentication authentication) {
        Long actorAccountId = (Long) authentication.getPrincipal();
        return adminStudyParticipantService.bulkUpdateRoles(studyId, request, actorAccountId);
    }
}
