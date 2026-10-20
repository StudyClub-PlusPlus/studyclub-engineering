package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AccountDtos.MarketingConsentView;
import com.studyclub.api.auth.dto.AccountDtos.UpdateMarketingConsentRequest;
import com.studyclub.api.auth.dto.AccountDtos.UpdateProfileImageRequest;
import com.studyclub.api.auth.dto.AccountDtos.UpdateProfileRequest;
import com.studyclub.api.auth.dto.AuthDtos.AccountSelfView;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.api.auth.security.RequireOnboarding;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지 내 정보. 조회만 온보딩 미완료 계정도 허용한다 — 프론트가 이 응답의 {@code onboardingCompletedAt} 으로 온보딩 화면으로 보낼지 정한다.
 * 수정·프로필 사진·마케팅 수신 동의는 {@code @RequireOnboarding} 가드가 403 ONBOARDING_REQUIRED 로 막는다.
 *
 * <p>온보딩 완료와 달리 {@code @Valid} 를 쓴다 — 멱등 체크가 검증보다 먼저여야 할 이유가 없다.
 */
@Tag(name = "내 정보", description = "마이페이지 내 정보 조회·프로필 수정·마케팅 수신 동의")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/me")
public class AccountProfileController {

    private final AccountProfileService accountProfileService;

    public AccountProfileController(AccountProfileService accountProfileService) {
        this.accountProfileService = accountProfileService;
    }

    @Operation(summary = "내 정보 조회", description = "온보딩 미완료 사용자도 조회 가능.")
    @GetMapping
    public AccountSelfView me(Authentication authentication) {
        return accountProfileService.get(authenticatedAccountId(authentication));
    }

    @Operation(summary = "프로필 수정 — 닉네임·타임존")
    @RequireOnboarding
    @PatchMapping
    public AccountSelfView updateProfile(
            Authentication authentication, @Valid @RequestBody UpdateProfileRequest request) {
        return accountProfileService.update(authenticatedAccountId(authentication), request);
    }

    @Operation(summary = "프로필 사진 연결 — 올려 둔 파일 번호를 내 프로필에, 이미 있으면 교체")
    @RequireOnboarding
    @PutMapping("/profile-image")
    public AccountView changeProfileImage(
            Authentication authentication, @Valid @RequestBody UpdateProfileImageRequest request) {
        return accountProfileService.changeProfileImage(
                authenticatedAccountId(authentication), request.fileId());
    }

    @Operation(summary = "프로필 사진 지우기 — 사진이 없어도 200")
    @RequireOnboarding
    @DeleteMapping("/profile-image")
    public AccountView removeProfileImage(Authentication authentication) {
        return accountProfileService.removeProfileImage(authenticatedAccountId(authentication));
    }

    @Operation(summary = "마케팅 수신 동의 조회")
    @RequireOnboarding
    @GetMapping("/marketing-consent")
    public MarketingConsentView getMarketingConsent(Authentication authentication) {
        return accountProfileService.getMarketingConsent(authenticatedAccountId(authentication));
    }

    @Operation(summary = "마케팅 수신 동의 변경")
    @RequireOnboarding
    @PutMapping("/marketing-consent")
    public MarketingConsentView changeMarketingConsent(
            Authentication authentication,
            @Valid @RequestBody UpdateMarketingConsentRequest request) {
        return accountProfileService.changeMarketingConsent(
                authenticatedAccountId(authentication), request.agreed());
    }

    private Long authenticatedAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountId;
    }
}
