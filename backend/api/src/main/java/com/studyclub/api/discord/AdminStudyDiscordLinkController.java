package com.studyclub.api.discord;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "스터디 디스코드 연결 (백오피스)")
@RequireAdmin
@RestController
@RequestMapping("/api/admin/studies/{studyId}/discord-link")
public class AdminStudyDiscordLinkController {

    private final StudyDiscordLinkService studyDiscordLinkService;

    public AdminStudyDiscordLinkController(StudyDiscordLinkService studyDiscordLinkService) {
        this.studyDiscordLinkService = studyDiscordLinkService;
    }

    @Operation(
            summary = "스터디 디스코드 연결",
            description =
                    "ADMIN 만. 연결이 없는 스터디에 봇 create-study 를 불러 연결을 만든다. 스터디 등록 때 자동 연결이 실패했을 때 쓴다."
                            + " 봇이 같은 이름에 409 를 주면 studyName 을 바꿔 다시 부른다.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<StudyDiscordLinkResponse> link(
            @PathVariable Long studyId,
            @Valid @RequestBody(required = false) StudyDiscordLinkRequest request,
            Authentication authentication) {
        Long accountId = (Long) authentication.getPrincipal();
        String studyName = request == null ? null : request.studyName();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(studyDiscordLinkService.link(accountId, studyId, studyName));
    }
}
