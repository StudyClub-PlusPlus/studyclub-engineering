package com.studyclub.api.application;

import com.studyclub.api.application.BackOfficeApplicationFormRequests.StudyApplicationFormRequest;
import com.studyclub.api.application.BackOfficeApplicationFormResponses.StudyApplicationFormResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "백오피스 신청 폼", description = "캡틴이 스터디 신청 폼을 조회하고 저장한다")
@RestController
@RequestMapping("/api/studies/{studyId}/application-form")
public class BackOfficeApplicationFormController {

    private final BackOfficeApplicationFormService backOfficeApplicationFormService;

    public BackOfficeApplicationFormController(
            BackOfficeApplicationFormService backOfficeApplicationFormService) {
        this.backOfficeApplicationFormService = backOfficeApplicationFormService;
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
        return backOfficeApplicationFormService.getForm(studyId, optionalAccountId(authentication));
    }

    @Operation(
            summary = "스터디 신청 폼 저장",
            description =
                    """
                    캡틴이 만든 추가 질문을 통째로 교체합니다.
                    이미 신청서가 있거나 모집 시작 시간이 지난 모집 회차가 있으면 CONFLICT입니다.
                    질문 설명과 폼 설명은 마크다운 원문으로 저장하며 서버는 HTML로 변환하지 않습니다.""")
    @SecurityRequirement(name = "bearerAuth")
    @PatchMapping
    public StudyApplicationFormResponse replaceForm(
            @Parameter(description = "신청 폼을 저장할 스터디 ID", example = "1") @PathVariable Long studyId,
            @RequestBody StudyApplicationFormRequest request,
            Authentication authentication) {
        return backOfficeApplicationFormService.replaceForm(
                studyId, authenticatedAccountId(authentication), request);
    }

    private Long optionalAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            return null;
        }
        return accountId;
    }

    private Long authenticatedAccountId(Authentication authentication) {
        Long accountId = optionalAccountId(authentication);
        if (accountId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountId;
    }
}
