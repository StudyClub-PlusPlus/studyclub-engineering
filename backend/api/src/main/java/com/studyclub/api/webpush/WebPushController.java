package com.studyclub.api.webpush;

import com.studyclub.api.auth.security.RequireOnboarding;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.notification.webpush.WebPushClient;
import com.studyclub.notification.webpush.WebPushSubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 사이트용 웹 푸시 — 공개키 조회와 이 기기 구독·해제 (specs/web-push/spec.md). */
@Tag(name = "웹 푸시", description = "이 기기에서 알림 받기")
@RestController
@RequiredArgsConstructor
public class WebPushController {

    private final WebPushClient webPushClient;
    private final WebPushSubscriptionService subscriptionService;

    public record ConfigResponse(boolean enabled, String publicKey) {}

    public record Keys(
            @NotBlank @Size(max = 128) String p256dh, @NotBlank @Size(max = 64) String auth) {}

    public record SubscribeRequest(
            @NotBlank @Size(max = 1024) String endpoint, @NotNull @Valid Keys keys) {}

    public record UnsubscribeRequest(@NotBlank @Size(max = 1024) String endpoint) {}

    @Operation(
            summary = "웹 푸시 설정",
            description = "꺼져 있으면 enabled=false, publicKey=null — 화면은 「알림 받기」를 그리지 않는다.")
    @GetMapping("/api/web-push/config")
    public ConfigResponse config() {
        return webPushClient.enabled()
                ? new ConfigResponse(true, webPushClient.publicKey())
                : new ConfigResponse(false, null);
    }

    @Operation(summary = "이 기기 구독", description = "브라우저 PushSubscription 을 그대로 보낸다. 같은 주소면 덮어쓴다.")
    @RequireOnboarding
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/api/me/web-push-subscription")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(
            @Valid @RequestBody SubscribeRequest request, Authentication authentication) {
        if (!webPushClient.enabled()) {
            throw new BusinessException(ErrorCode.CONFLICT, "웹 푸시가 꺼져 있습니다.");
        }
        try {
            subscriptionService.subscribe(
                    (Long) authentication.getPrincipal(),
                    request.endpoint(),
                    request.keys().p256dh(),
                    request.keys().auth());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, e.getMessage());
        }
    }

    @Operation(summary = "이 기기 구독 해제", description = "내 구독이 아니거나 없으면 아무것도 하지 않는다(204).")
    @RequireOnboarding
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/api/me/web-push-subscription")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(
            @Valid @RequestBody UnsubscribeRequest request, Authentication authentication) {
        subscriptionService.unsubscribe((Long) authentication.getPrincipal(), request.endpoint());
    }
}
