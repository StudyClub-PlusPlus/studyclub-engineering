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
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 담당 캡틴 — 캡틴만 ({@code @RequireAdmin}). specs/study-group/spec.md 「담당 캡틴 바꾸기」 */
@Tag(name = "백오피스 참여자", description = "캡틴이 참여 명단을 보고 참여자의 반·역할을 지정한다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
public class AdminStudyOwnerCaptainController {

    private final AdminStudyOwnerCaptainService adminStudyOwnerCaptainService;

    public AdminStudyOwnerCaptainController(
            AdminStudyOwnerCaptainService adminStudyOwnerCaptainService) {
        this.adminStudyOwnerCaptainService = adminStudyOwnerCaptainService;
    }

    @Operation(
            summary = "담당 캡틴 바꾸기",
            description =
                    "ADMIN만 호출 가능. 캡틴이면 누구나 바꾼다. 대상은 ADMIN 계정만(아니면 409 OWNER_CAPTAIN_NOT_ADMIN)."
                            + " 명부와 상관없다. 같은 사람이면 아무것도 바꾸지 않고 200.")
    @PatchMapping("/api/admin/studies/{studyId}/owner-captain")
    public OwnerCaptainResponse change(
            @PathVariable Long studyId,
            @Valid @RequestBody OwnerCaptainChangeRequest request,
            Authentication authentication) {
        Long actorAccountId = (Long) authentication.getPrincipal();
        return adminStudyOwnerCaptainService.change(studyId, request.accountId(), actorAccountId);
    }
}
