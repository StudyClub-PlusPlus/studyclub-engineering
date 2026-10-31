package com.studyclub.api.feedback;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.domain.feedback.FeedbackStatus;
import com.studyclub.domain.feedback.FeedbackType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 운영 콘솔의 문의·오류 신고 — 목록 · 상세 · 처리. 캡틴만 ({@code @RequireAdmin}). specs/feedback/spec.md */
@Tag(name = "백오피스 문의·오류 신고", description = "캡틴이 문의를 보고 상태 · 회신 · 메모를 남긴다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/feedbacks")
public class AdminFeedbackController {

    private final AdminFeedbackService adminFeedbackService;

    public AdminFeedbackController(AdminFeedbackService adminFeedbackService) {
        this.adminFeedbackService = adminFeedbackService;
    }

    @Operation(
            summary = "문의·오류 신고 목록",
            description =
                    "type · status · q(제목·내용 부분 일치) · offset · limit. 접수 시각 내림차순. total 은 걸러진 뒤 전체 수.")
    @GetMapping
    public AdminFeedbackListResponse list(
            @RequestParam(required = false) FeedbackType type,
            @RequestParam(required = false) FeedbackStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return adminFeedbackService.list(type, status, q, offset, limit);
    }

    @Operation(
            summary = "문의·오류 신고 상세",
            description = "제출 환경 · 회신 · 캡틴 전용 메모 · 지금 고를 수 있는 상태(selectableStatuses).")
    @GetMapping("/{feedbackId}")
    public AdminFeedbackDetailResponse detail(@PathVariable Long feedbackId) {
        return adminFeedbackService.detail(feedbackId);
    }

    @Operation(
            summary = "문의·오류 신고 처리",
            description =
                    "status · reply · adminMemo 중 하나만. 완료는 첫 회신으로만 된다 — 회신 없이 DONE 은 409 FEEDBACK_REPLY_REQUIRED,"
                            + " 회신 뒤 상태 변경은 409 FEEDBACK_ALREADY_ANSWERED. 회신 수정은 내용만 바뀐다. 응답은 바뀐 뒤의 상세.")
    @PatchMapping("/{feedbackId}")
    public AdminFeedbackDetailResponse patch(
            Authentication authentication,
            @PathVariable Long feedbackId,
            @RequestBody Map<String, Object> body) {
        Long requesterId = (Long) authentication.getPrincipal();
        return adminFeedbackService.patch(requesterId, feedbackId, body);
    }
}
