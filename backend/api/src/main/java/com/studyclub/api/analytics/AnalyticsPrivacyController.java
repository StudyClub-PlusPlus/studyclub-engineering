package com.studyclub.api.analytics;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/analytics")
public class AnalyticsPrivacyController {
    private final AnalyticsPrivacyService privacy;

    public AnalyticsPrivacyController(AnalyticsPrivacyService privacy) {
        this.privacy = privacy;
    }

    @GetMapping
    public ResponseEntity<AnalyticsPrivacyService.View> get(Authentication authentication) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(privacy.current((Long) authentication.getPrincipal()));
    }

    public record BrowserRequest(
            @NotBlank @Pattern(regexp = "[0-9]{1,20}\\.[0-9]{1,20}") String clientId) {}

    @PostMapping("/browser")
    public ResponseEntity<AnalyticsPrivacyService.View> browser(
            Authentication authentication, @Valid @RequestBody BrowserRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(
                        privacy.registerBrowser(
                                (Long) authentication.getPrincipal(), request.clientId()));
    }
}
