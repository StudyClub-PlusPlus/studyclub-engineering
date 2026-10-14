package com.studyclub.api.meeting;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 스터디 일정 화면 맨 위 규칙 카드 (specs/study-meeting/spec.md 「스터디 규칙 저장」). 읽기는 회차 목록 응답에 실린다. */
@Tag(name = "회차", description = "스터디 일정 — 분반 회차 조회 · 추가 · 수정 · 삭제 · 발표 신청")
@RestController
@RequestMapping("/api/studies/{studyId}/groups/{groupId}/rules")
public class StudyGroupRulesController {

    private final StudyMeetingService studyMeetingService;

    public StudyGroupRulesController(StudyMeetingService studyMeetingService) {
        this.studyMeetingService = studyMeetingService;
    }

    @Operation(summary = "스터디 규칙 저장", description = "그 분반 네비게이터 또는 만든 캡틴. 500자까지, null·공백이면 지운다.")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping
    public ResponseEntity<Void> save(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @RequestBody StudyMeetingRequests.Rules request,
            Authentication authentication) {
        studyMeetingService.saveRules(
                (Long) authentication.getPrincipal(), studyId, groupId, request.rules());
        return ResponseEntity.noContent().build();
    }
}
