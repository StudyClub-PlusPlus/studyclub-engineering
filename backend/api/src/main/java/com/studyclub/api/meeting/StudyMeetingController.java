package com.studyclub.api.meeting;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "회차", description = "스터디 일정 — 분반 회차 조회 · 추가 · 수정 · 삭제 · 발표 신청")
@RestController
@RequestMapping("/api/studies/{studyId}/meetings")
public class StudyMeetingController {

    private final StudyMeetingService studyMeetingService;

    public StudyMeetingController(StudyMeetingService studyMeetingService) {
        this.studyMeetingService = studyMeetingService;
    }

    @Operation(
            summary = "분반 회차 목록",
            description = "그 분반 참여자 · 네비게이터 · 만든 캡틴. studyGroupId 를 빼면 이 스터디의 내 분반.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public StudyMeetingListResponse list(
            @PathVariable Long studyId,
            @RequestParam(required = false) Long studyGroupId,
            Authentication authentication) {
        return studyMeetingService.list(accountId(authentication), studyId, studyGroupId);
    }

    @Operation(summary = "회차 추가", description = "한 번 · 반복. 반복은 날짜 목록(UTC)으로 펼쳐 보낸다.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<Void> create(
            @PathVariable Long studyId,
            @Valid @RequestBody StudyMeetingRequests.Create request,
            Authentication authentication) {
        studyMeetingService.create(accountId(authentication), studyId, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "회차 수정", description = "시작 전 회차의 시각·제목·발표자. 발표자는 보낸 칸만 바꾼다.")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{meetingId}")
    public ResponseEntity<Void> update(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            @Valid @RequestBody StudyMeetingRequests.Update request,
            Authentication authentication) {
        studyMeetingService.update(accountId(authentication), studyId, meetingId, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "회차 삭제", description = "시작 전 회차 하나. 그 회차의 출석·휴가도 지운다.")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{meetingId}")
    public ResponseEntity<Void> delete(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            Authentication authentication) {
        studyMeetingService.delete(accountId(authentication), studyId, meetingId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "발표 신청", description = "그 분반 참여자가 빈 발표자 칸(1·2)에 자기를 넣는다. 선착순.")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{meetingId}/presenters/{slot}/me")
    public ResponseEntity<Void> signUpPresenter(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            @PathVariable int slot,
            Authentication authentication) {
        studyMeetingService.signUpPresenter(accountId(authentication), studyId, meetingId, slot);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "발표 신청 취소", description = "내가 들어간 발표자 칸에서 빠진다.")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{meetingId}/presenters/{slot}/me")
    public ResponseEntity<Void> cancelPresenter(
            @PathVariable Long studyId,
            @PathVariable Long meetingId,
            @PathVariable int slot,
            Authentication authentication) {
        studyMeetingService.cancelPresenter(accountId(authentication), studyId, meetingId, slot);
        return ResponseEntity.noContent().build();
    }

    private static Long accountId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }
}
