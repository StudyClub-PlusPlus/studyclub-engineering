package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubDtos.HubResponse;
import com.studyclub.api.participant.ParticipantHubDtos.StudyDetail;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "참가자 허브", description = "로그인한 참가자의 스터디·신청·일정·북마크")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/me")
public class ParticipantHubController {

    private final ParticipantHubService participantHubService;

    public ParticipantHubController(ParticipantHubService participantHubService) {
        this.participantHubService = participantHubService;
    }

    @Operation(summary = "내 참가자 허브 조회")
    @GetMapping("/studies")
    public HubResponse getHub(Authentication authentication) {
        return participantHubService.getHub(authenticatedEmail(authentication));
    }

    @Operation(summary = "내 수강 스터디 상세 조회")
    @GetMapping("/study-cohorts/{cohortId}")
    public StudyDetail getStudy(@PathVariable Long cohortId, Authentication authentication) {
        return participantHubService.getStudy(authenticatedEmail(authentication), cohortId);
    }

    private String authenticatedEmail(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return authentication.getName();
    }
}
