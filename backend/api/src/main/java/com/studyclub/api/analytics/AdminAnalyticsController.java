package com.studyclub.api.analytics;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/feedbacks")
public class AdminAnalyticsController {
    private final AnalyticsPrivacyService privacy;

    public AdminAnalyticsController(AnalyticsPrivacyService privacy) {
        this.privacy = privacy;
    }

    @Operation(
            summary = "문의 작성자의 분석 중단 및 기존 기록 삭제 요청",
            description = "ADMIN 전용. 문의 내용으로 본인의 요청을 확인한 후 호출합니다. 반환된 접수 상태는 외부 삭제 완료가 아닙니다.")
    @PostMapping("/{feedbackId}/analytics-opt-out")
    public ResponseEntity<AnalyticsPrivacyService.AdminView> optOut(
            Authentication auth, @PathVariable Long feedbackId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(privacy.optOut((Long) auth.getPrincipal(), feedbackId));
    }
}
