package com.studyclub.api.webpush;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.notification.webpush.AdminPushService;
import com.studyclub.notification.webpush.WebPushClient;
import com.studyclub.notification.webpush.WebPushSubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 푸시 보내기 — 캡틴만 (specs/web-push/spec.md). 발송 결과는 기존 발송 이력 화면에서 본다. */
@Tag(name = "백오피스 · 웹 푸시", description = "구독 현황, 푸시 보내기")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/web-push")
@RequiredArgsConstructor
public class AdminWebPushController {

    private final WebPushClient webPushClient;
    private final WebPushSubscriptionService subscriptionService;
    private final AdminPushService adminPushService;

    public record StatusResponse(
            boolean enabled, long subscriptions, long accounts, long mySubscriptions) {}

    /** 링크는 우리 사이트 안 경로만 — 알림을 누른 사람을 밖으로 보내지 않는다. */
    public record SendRequest(
            @NotNull AdminPushService.Audience audience,
            @NotBlank @Size(max = 60) String title,
            @NotBlank @Size(max = 200) String body,
            @Size(max = 255) @Pattern(regexp = "^/(?!/).*", message = "링크는 / 로 시작하는 사이트 안 경로여야 합니다")
                    String url) {}

    public record SendResponse(int queued) {}

    @Operation(summary = "웹 푸시 현황", description = "켜져 있는지, 구독 기기 수, 구독한 회원 수, 내 기기 수")
    @GetMapping
    public StatusResponse status(Authentication authentication) {
        var stats = subscriptionService.stats();
        return new StatusResponse(
                webPushClient.enabled(),
                stats.subscriptions(),
                stats.accounts(),
                subscriptionService.countOf((Long) authentication.getPrincipal()));
    }

    @Operation(
            summary = "푸시 보내기",
            description = "받을 기기마다 알림 행을 만들고 접수까지만 응답한다. 실제 발송은 30초 안에 폴러가 한다.")
    @PostMapping("/send")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public SendResponse send(
            @Valid @RequestBody SendRequest request, Authentication authentication) {
        if (!webPushClient.enabled()) {
            throw new BusinessException(ErrorCode.CONFLICT, "웹 푸시가 꺼져 있습니다.");
        }
        int queued =
                adminPushService.send(
                        (Long) authentication.getPrincipal(),
                        request.audience(),
                        request.title(),
                        request.body(),
                        request.url());
        if (queued == 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "받을 기기가 없습니다.");
        }
        return new SendResponse(queued);
    }
}
