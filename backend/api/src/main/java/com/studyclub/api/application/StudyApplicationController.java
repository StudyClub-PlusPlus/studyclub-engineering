package com.studyclub.api.application;

import com.studyclub.api.application.StudyApplicationRequests.SubmitStudyApplicationRequest;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "스터디 신청", description = "크루가 모집 중인 스터디에 신청한다")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/studies/{studyId}/applications")
public class StudyApplicationController {

    private final StudyApplicationService studyApplicationService;

    public StudyApplicationController(StudyApplicationService studyApplicationService) {
        this.studyApplicationService = studyApplicationService;
    }

    @Operation(
            summary = "스터디 신청 제출",
            description =
                    """
                    열려 있는 모집 회차에 신청서를 한 번 저장합니다.
                    디스코드 연동 회원만 신청할 수 있으며, 제출한 서버 별명은 계정에도 저장합니다.
                    이미 신청했거나 모집이 마감됐거나 정원이 가득 차면 CONFLICT입니다.""")
    @PostMapping
    public ResponseEntity<Void> submit(
            @Parameter(description = "신청할 스터디 ID", example = "1") @PathVariable Long studyId,
            @RequestBody SubmitStudyApplicationRequest request,
            Authentication authentication) {
        Long applicationId =
                studyApplicationService.submit(
                        authenticatedAccountId(authentication), studyId, request);
        return ResponseEntity.created(
                        URI.create("/api/studies/" + studyId + "/applications/" + applicationId))
                .build();
    }

    private Long authenticatedAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountId;
    }
}
