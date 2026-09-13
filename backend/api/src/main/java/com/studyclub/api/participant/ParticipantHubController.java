package com.studyclub.api.participant;

import com.studyclub.api.auth.security.RequireOnboarding;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipantHubOverviewResponse;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudyCohortDetailResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 회원 전용 — 온보딩 미완료 계정은 {@code @RequireOnboarding} 가드가 403 ONBOARDING_REQUIRED 로 막는다. */
@Tag(name = "참가자 허브", description = "로그인한 참가자의 스터디·신청·일정·북마크")
@SecurityRequirement(name = "bearerAuth")
@RequireOnboarding
@RestController
@RequestMapping("/api/me")
public class ParticipantHubController {

    private final ParticipantHubQueryService participantHubQueryService;

    public ParticipantHubController(ParticipantHubQueryService participantHubQueryService) {
        this.participantHubQueryService = participantHubQueryService;
    }

    @Operation(summary = "내 참가자 허브 조회")
    @GetMapping("/studies")
    public ParticipantHubOverviewResponse getParticipantHubOverview(Authentication authentication) {
        return participantHubQueryService.getParticipantHubOverview(
                authenticatedAccountId(authentication));
    }

    @Operation(summary = "내 수강 스터디 상세 조회")
    @GetMapping("/study-cohorts/{cohortId}")
    public ParticipatingStudyCohortDetailResponse getParticipatingStudyCohortDetail(
            @PathVariable Long cohortId, Authentication authentication) {
        return participantHubQueryService.getParticipatingStudyCohortDetail(
                authenticatedAccountId(authentication), cohortId);
    }

    private Long authenticatedAccountId(Authentication authentication) {
        if (authentication == null || authentication.getDetails() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return Long.valueOf((String) authentication.getDetails());
    }
}
