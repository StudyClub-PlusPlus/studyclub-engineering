package com.studyclub.api.application;

import com.studyclub.api.application.StudyApplicationFormResponses.StudyApplicationFormResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 크루가 보는 신청 폼. 저장(캡틴)은 {@code /api/admin} 쪽 {@link AdminApplicationFormController} 가 맡는다. */
@Tag(name = "스터디 신청 폼", description = "크루가 스터디 신청 폼을 조회한다")
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

    private Long optionalAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            return null;
        }
        return accountId;
    }
}
