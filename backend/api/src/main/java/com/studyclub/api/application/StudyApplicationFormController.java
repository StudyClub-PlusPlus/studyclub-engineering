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

/**
 * 사용자 사이트의 신청 폼 — 크루가 조회하고, 캡틴·네비게이터가 저장한다.
 *
 * <p>백오피스 화면은 {@link AdminApplicationFormController}({@code /api/admin})를 쓰고 <b>캡틴만</b> 통과한다. 같은
 * 기능이지만 관객이 달라 경로와 권한을 나눴다 — POL-0001 · api/endpoint-convention.md
 */
@Tag(name = "스터디 신청 폼", description = "크루가 조회하고, 캡틴·네비게이터가 저장한다")
@RestController
@RequestMapping("/api/studies/{studyId}/application-form")
public class StudyApplicationFormController {

    private final StudyApplicationFormService studyApplicationFormService;

    public StudyApplicationFormController(StudyApplicationFormService studyApplicationFormService) {
        this.studyApplicationFormService = studyApplicationFormService;
    }

    @Operation(
            summary = "스터디 신청 폼 조회",
            description =
                    """
                    OPEN이고 숨김이 아닌 스터디는 공개로 조회합니다.
                    DRAFT 또는 숨김 스터디는 해당 스터디 LEADER/CO_LEADER 또는 ADMIN만 조회할 수 있습니다.
                    플랫폼 기본 문항(디스코드 별명, 참여 가능 요일, 일정 확인)은 questions에 포함하지 않습니다.""")
    @GetMapping
    public StudyApplicationFormResponse getForm(
            @Parameter(description = "신청 폼을 조회할 스터디 ID", example = "1") @PathVariable Long studyId,
            Authentication authentication) {
        return studyApplicationFormService.getForm(studyId, optionalAccountId(authentication));
    }

    @Operation(
            summary = "스터디 신청 폼 저장 (사용자 사이트)",
            description =
                    """
                    캡틴 또는 그 스터디의 네비게이터가 추가 질문을 통째로 교체합니다.
                    백오피스에서 저장하는 경로는 PUT /api/admin/studies/{studyId}/application-form 이고,
                    그쪽은 캡틴만 통과합니다 (POL-0001).
                    이미 신청서가 있거나 모집이 시작됐으면 CONFLICT입니다.""")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping
    public StudyApplicationFormResponse replaceForm(
            @Parameter(description = "신청 폼을 저장할 스터디 ID", example = "1") @PathVariable Long studyId,
            @Valid @RequestBody StudyApplicationFormRequest request,
            Authentication authentication) {
        return studyApplicationFormService.replaceFormFromSite(
                studyId, authenticatedAccountId(authentication), request);
    }

    private Long authenticatedAccountId(Authentication authentication) {
        Long accountId = optionalAccountId(authentication);
        if (accountId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountId;
    }

    private Long optionalAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            return null;
        }
        return accountId;
    }
}
