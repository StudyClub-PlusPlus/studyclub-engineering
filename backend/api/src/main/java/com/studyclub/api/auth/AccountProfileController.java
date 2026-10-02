package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AccountDtos.UpdateProfileRequest;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.api.auth.security.RequireOnboarding;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지 내 정보. 회원 전용 — 온보딩 미완료 계정은 {@code @RequireOnboarding} 가드가 403 ONBOARDING_REQUIRED 로 막는다.
 *
 * <p>온보딩 완료와 달리 {@code @Valid} 를 쓴다 — 멱등 체크가 검증보다 먼저여야 할 이유가 없다.
 */
@Tag(name = "내 정보", description = "마이페이지 프로필 수정")
@SecurityRequirement(name = "bearerAuth")
@RequireOnboarding
@RestController
@RequestMapping("/api/me")
public class AccountProfileController {

    private final AccountProfileService accountProfileService;

    public AccountProfileController(AccountProfileService accountProfileService) {
        this.accountProfileService = accountProfileService;
    }

    @Operation(summary = "프로필 수정 — 닉네임·타임존")
    @PatchMapping
    public AccountView updateProfile(
            Authentication authentication, @Valid @RequestBody UpdateProfileRequest request) {
        return accountProfileService.update(authenticatedAccountId(authentication), request);
    }

    private Long authenticatedAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountId;
    }
}
