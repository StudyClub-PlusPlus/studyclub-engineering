package com.studyclub.api.application;

import com.studyclub.api.application.BackOfficeApplicationResponses.StudyApplicationsResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "백오피스 신청", description = "운영자가 스터디 신청서 결과를 조회한다")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/studies/{studyId}/applications")
public class BackOfficeApplicationController {

    private final BackOfficeApplicationQueryService backOfficeApplicationQueryService;

    public BackOfficeApplicationController(
            BackOfficeApplicationQueryService backOfficeApplicationQueryService) {
        this.backOfficeApplicationQueryService = backOfficeApplicationQueryService;
    }

    @Operation(
            summary = "스터디 신청 결과 목록 조회",
            description =
                    """
                    백오피스 신청자 목록과 신청서 답변을 조회합니다.
                    recruitmentId가 없으면 열려 있는 모집 회차를 우선 사용하고, 없으면 가장 최근 모집 회차를 사용합니다.
                    질문별 집계는 서버가 계산하지 않고, questions와 applications[].answers로 프론트가 계산합니다.
                    승인/거절 처리는 이 API 범위가 아닙니다.""")
    @GetMapping
    public StudyApplicationsResponse getApplications(
            @Parameter(description = "신청 결과를 조회할 스터디 ID", example = "1") @PathVariable Long studyId,
            @Parameter(
                            description = "특정 모집 회차만 조회할 때 사용합니다. 이 스터디 소속이 아니면 INVALID_INPUT입니다.",
                            example = "3")
                    @RequestParam(required = false)
                    Long recruitmentId,
            Authentication authentication) {
        return backOfficeApplicationQueryService.getApplications(
                authenticatedAccountId(authentication), studyId, recruitmentId);
    }

    private Long authenticatedAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountId;
    }
}
