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

/**
 * 사용자 사이트의 신청 폼 — 크루가 조회한다.
 *
 * <p>저장(PUT)은 백오피스 {@link AdminApplicationFormController}({@code /api/admin})에서만 가능하고 캡틴만 통과한다.
 * specs/authz-guards/spec.md B절 후속 — 네비게이터는 신청 폼을 고치지 않는다.
 */
@Tag(name = "스터디 신청 폼", description = "크루가 조회한다")
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
                    DRAFT가 아닌 스터디는 공개로 조회합니다.
                    DRAFT 스터디는 해당 스터디 LEADER 또는 ADMIN만 조회할 수 있습니다.
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
