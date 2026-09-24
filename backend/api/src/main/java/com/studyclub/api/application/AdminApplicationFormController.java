package com.studyclub.api.application;

import com.studyclub.api.application.StudyApplicationFormRequests.StudyApplicationFormRequest;
import com.studyclub.api.application.StudyApplicationFormResponses.StudyApplicationFormResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 캡틴·운영자가 쓰는 신청 폼 저장. 운영 화면용이라 {@code /api/admin} 아래 산다 — api/endpoint-convention.md */
@Tag(name = "운영 · 스터디 신청 폼", description = "캡틴이 스터디 신청 폼을 저장한다")
@RestController
@RequestMapping("/api/admin/studies/{studyId}/application-form")
public class AdminApplicationFormController {

    private final StudyApplicationFormService studyApplicationFormService;

    public AdminApplicationFormController(StudyApplicationFormService studyApplicationFormService) {
        this.studyApplicationFormService = studyApplicationFormService;
    }

    @Operation(summary = "스터디 신청 폼 조회 (백오피스)", description = "캡틴만 조회합니다. DRAFT·숨김 스터디도 볼 수 있습니다.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public StudyApplicationFormResponse getForm(
            @Parameter(description = "신청 폼을 조회할 스터디 ID", example = "1") @PathVariable Long studyId,
            Authentication authentication) {
        return studyApplicationFormService.getFormForBackOffice(
                studyId, authenticatedAccountId(authentication));
    }

    @Operation(
            summary = "스터디 신청 폼 저장 (백오피스)",
            description =
                    """
                    캡틴이 만든 추가 질문을 통째로 교체합니다 (부분 수정이 아니라 전체 교체라 PUT).
                    백오피스는 캡틴만 들어옵니다 — 네비게이터는 사용자 사이트 경로를 씁니다 (POL-0001).
                    이미 신청서가 있거나 모집 시작 시간이 지난 모집 회차가 있으면 CONFLICT입니다.
                    질문 설명과 폼 설명은 마크다운 원문으로 저장하며 서버는 HTML로 변환하지 않습니다.""")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping
    public StudyApplicationFormResponse replaceForm(
            @Parameter(description = "신청 폼을 저장할 스터디 ID", example = "1") @PathVariable Long studyId,
            @Valid @RequestBody StudyApplicationFormRequest request,
            Authentication authentication) {
        return studyApplicationFormService.replaceFormFromBackOffice(
                studyId, authenticatedAccountId(authentication), request);
    }

    private Long authenticatedAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountId;
    }
}
