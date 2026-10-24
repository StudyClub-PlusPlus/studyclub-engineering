package com.studyclub.api.notice;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 스터디 공지 — 네비게이터(담당 캡틴)가 자기 반 팀원 중 고른 사람에게 메일·디스코드로 보낸다 (specs/study-notice/spec.md, POL-0010). 사용자
 * 사이트용이다 — 네비게이터는 백오피스에 들어갈 수 없다. 권한 검사는 서비스가 한다.
 */
@Tag(name = "스터디 공지", description = "스터디 일정 › 공지 — 반 팀원에게 메일·디스코드로 보내기 · 보낸 기록")
@RestController
@RequestMapping("/api/studies/{studyId}/groups/{groupId}/notices")
public class StudyNoticeController {

    private final StudyNoticeService studyNoticeService;

    public StudyNoticeController(StudyNoticeService studyNoticeService) {
        this.studyNoticeService = studyNoticeService;
    }

    @Operation(
            summary = "보내기 화면 값",
            description =
                    "받는 사람 후보(참여 중·쉬는 중) · 디스코드 가능 여부 · 발송 한도. 그 반 네비게이터 또는 만든 캡틴. 이메일은 내려주지 않는다.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/compose")
    public StudyNoticeComposeResponse compose(
            @PathVariable Long studyId, @PathVariable Long groupId, Authentication authentication) {
        return studyNoticeService.compose(accountId(authentication), studyId, groupId);
    }

    @Operation(
            summary = "공지 보내기",
            description =
                    "접수까지만 응답한다. 메일은 받는 사람마다 한 통씩 큐에 넣고, 디스코드는 커밋 뒤 비동기로 올린다. 같은 반은 1분 간격 · 하루 30회(429).")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<StudyNoticeSendResponse> send(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @Valid @RequestBody StudyNoticeRequests.Send request,
            Authentication authentication) {
        StudyNoticeSendResponse response =
                studyNoticeService.send(accountId(authentication), studyId, groupId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "보낸 공지 기록", description = "이 반이 보낸 공지를 최근 순으로. 반 멤버(크루)는 볼 수 없다.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public StudyNoticeListResponse list(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit,
            Authentication authentication) {
        return studyNoticeService.list(accountId(authentication), studyId, groupId, offset, limit);
    }

    private static Long accountId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }
}
