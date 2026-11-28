package com.studyclub.api.retro;

import com.studyclub.api.auth.security.RequireOnboarding;
import com.studyclub.domain.retro.RetroSection;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "회고", description = "미팅 회고 작성·조회·공감 (specs/meeting-retro/spec.md)")
@RestController
public class MeetingRetroController {

    private final MeetingRetroService meetingRetroService;

    public MeetingRetroController(MeetingRetroService meetingRetroService) {
        this.meetingRetroService = meetingRetroService;
    }

    @Operation(
            summary = "반 회차별 회고 상태",
            description = "deadline·open·mine. studyGroupId 없으면 내 반. 킥오프는 null.")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @GetMapping("/api/me/studies/{studyId}/retros/status")
    public MeetingRetroResponses.RetroStatus retroStatus(
            @PathVariable Long studyId,
            @RequestParam(required = false) Long studyGroupId,
            Authentication authentication) {
        return meetingRetroService.retroStatus(accountId(authentication), studyId, studyGroupId);
    }

    @Operation(
            summary = "내 뷰어 컨텍스트",
            description = "내 회고 ID · 내가 누른 👍. 반 참여자·네비게이터·캡틴. 끝나지 않은 회차는 409 RETRO_NOT_OPEN.")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @GetMapping("/api/me/studies/{studyId}/meetings/{meetingId}/retros")
    public MeetingRetroResponses.ViewerContext viewerContext(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            Authentication authentication) {
        return meetingRetroService.viewerContext(accountId(authentication), studyId, meetingId);
    }

    @Operation(
            summary = "회차 회고 목록",
            description =
                    "작성자·공감 수·미작성자(네비게이터·캡틴만). 반 참여자·네비게이터·캡틴. 끝나지 않은 회차는 409 RETRO_NOT_OPEN.")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @GetMapping("/api/studies/{studyId}/meetings/{meetingId}/retros")
    public MeetingRetroResponses.RetroList list(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            @RequestParam(required = false) Long groupId,
            Authentication authentication) {
        return meetingRetroService.list(accountId(authentication), studyId, meetingId, groupId);
    }

    @Operation(
            summary = "내 회고 작성·수정",
            description =
                    "없으면 만들고(201) 있으면 고친다(200). 쓸 사람만 (반 명부에 있는 참여자 — 캡틴도 명부에 있으면 포함). 미팅 전 409 RETRO_NOT_OPEN · 기한 뒤 409 RETRO_CLOSED.")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @PutMapping("/api/me/studies/{studyId}/meetings/{meetingId}/retro")
    public ResponseEntity<Void> write(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            @Valid @RequestBody MeetingRetroRequests.WriteRetro request,
            Authentication authentication) {
        boolean created =
                meetingRetroService.write(accountId(authentication), studyId, meetingId, request);
        return created ? ResponseEntity.status(201).build() : ResponseEntity.ok().build();
    }

    @Operation(
            summary = "👍 누르기",
            description = "같은 요청을 다시 보내도 결과가 같다(멱등). 기한과 상관없이 누른다. section = GOOD·IMPROVE·FEELING.")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @PutMapping("/api/studies/{studyId}/meetings/{meetingId}/retros/{retroId}/likes/{section}")
    public MeetingRetroResponses.LikeResult like(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            @PathVariable Long retroId,
            @PathVariable RetroSection section,
            Authentication authentication) {
        return meetingRetroService.like(
                accountId(authentication), studyId, meetingId, retroId, section);
    }

    @Operation(summary = "👍 취소", description = "같은 요청을 다시 보내도 결과가 같다(멱등). 기한과 상관없이 취소한다.")
    @SecurityRequirement(name = "bearerAuth")
    @RequireOnboarding
    @DeleteMapping("/api/studies/{studyId}/meetings/{meetingId}/retros/{retroId}/likes/{section}")
    public MeetingRetroResponses.LikeResult unlike(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            @PathVariable Long retroId,
            @PathVariable RetroSection section,
            Authentication authentication) {
        return meetingRetroService.unlike(
                accountId(authentication), studyId, meetingId, retroId, section);
    }

    private static Long accountId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }
}
