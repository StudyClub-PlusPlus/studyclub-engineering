package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AccountDtos.DiscordLinkRequest;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 디스코드 계정 연동. specs/study-application/spec.md 「디스코드 계정 연동」.
 *
 * <p>일부러 {@code @RequireOnboarding} 을 걸지 않는다 — 온보딩에 연동 단계를 넣을지(DSC-03)가 정해지지 않았고, 넣으면 미완료 계정이 부른다.
 */
@Tag(name = "디스코드 계정 연동", description = "디스코드 OAuth 인가 코드로 내 계정에 디스코드를 연결")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/me/discord")
@RequiredArgsConstructor
public class AccountDiscordLinkController {

    private final AccountDiscordLinkService accountDiscordLinkService;

    @Operation(summary = "디스코드 계정 연동 — 길드 멤버만, 같은 계정·같은 ID 재연동은 성공")
    @PostMapping("/link")
    public ResponseEntity<Void> link(
            Authentication authentication, @Valid @RequestBody DiscordLinkRequest request) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        accountDiscordLinkService.link(accountId, request.code());
        return ResponseEntity.noContent().build();
    }
}
