package com.studyclub.api.meeting;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 스터디 일정 화면 — 분반 규칙 저장 · 회차 일괄 삭제. */
@Tag(name = "회차", description = "스터디 일정 — 분반 회차 조회 · 추가 · 수정 · 삭제(일괄) · 발표 신청")
@RestController
@RequestMapping("/api/studies/{studyId}/groups/{groupId}")
public class StudyGroupRulesController {

    private final StudyMeetingService studyMeetingService;

    public StudyGroupRulesController(StudyMeetingService studyMeetingService) {
        this.studyMeetingService = studyMeetingService;
    }

    @Operation(summary = "스터디 규칙 저장", description = "그 분반 네비게이터 또는 만든 캡틴. 500자까지, null·공백이면 지운다.")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/rules")
    public ResponseEntity<Void> save(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @RequestBody StudyMeetingRequests.Rules request,
            Authentication authentication) {
        studyMeetingService.saveRules(
                (Long) authentication.getPrincipal(), studyId, groupId, request.rules());
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "회차 일괄 삭제",
            description = "한 분반의 시작 전 회차 여럿. 하나라도 시작했거나 킥오프면 아무것도 지우지 않는다(409). 그 회차들의 출석·휴가도 지운다.")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/meetings")
    public ResponseEntity<Void> deleteAll(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @Valid @RequestBody StudyMeetingRequests.BulkDelete request,
            Authentication authentication) {
        studyMeetingService.deleteAll(
                (Long) authentication.getPrincipal(), studyId, groupId, request.meetingIds());
        return ResponseEntity.noContent().build();
    }
}
