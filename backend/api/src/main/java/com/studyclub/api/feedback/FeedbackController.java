package com.studyclub.api.feedback;

import com.studyclub.api.auth.security.RequireOnboarding;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 크루의 문의·오류 신고 — 제출과 내 문의 (specs/feedback/spec.md). 운영 콘솔 쪽은 {@link AdminFeedbackController}.
 *
 * <p>온보딩 전 계정은 쓰지 못한다 — 온보딩이 개인정보 수집·이용 동의를 받는 단계라, 그 전에 받으면 동의 전 수집이 된다.
 */
@Tag(name = "문의·오류 신고", description = "크루가 문의를 보내고 내 문의와 회신을 본다")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api")
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @Operation(
            summary = "문의·오류 신고 제출",
            description =
                    "type · title(2~100) · content(10~2000) · imageFileIds(0~3, purpose=FEEDBACK 로 올린 번호) · viewport."
                            + " 브라우저는 User-Agent 헤더에서 줄여 저장한다. 계정당 60초 1건 · 24시간 20건(429 TOO_MANY_REQUESTS).")
    @RequireOnboarding
    @PostMapping("/feedbacks")
    public ResponseEntity<MyFeedbackItem> submit(
            Authentication authentication,
            @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
            @RequestBody FeedbackSubmitRequest request) {
        Long accountId = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(feedbackService.submit(accountId, request, userAgent));
    }

    @Operation(summary = "내 문의 목록", description = "본인 것만, 접수 시각 내림차순. 상태는 RECEIVED · ANSWERED.")
    @RequireOnboarding
    @GetMapping("/me/feedbacks")
    public MyFeedbackListResponse myFeedbacks(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        Long accountId = (Long) authentication.getPrincipal();
        return feedbackService.getMine(accountId, offset, limit);
    }

    @Operation(summary = "내 문의 상세", description = "본인 것만. 남의 것 · 없는 번호는 404. 회신이 없으면 reply 는 null.")
    @RequireOnboarding
    @GetMapping("/me/feedbacks/{feedbackId}")
    public MyFeedbackDetailResponse myFeedback(
            Authentication authentication, @PathVariable Long feedbackId) {
        Long accountId = (Long) authentication.getPrincipal();
        return feedbackService.getMine(accountId, feedbackId);
    }
}
