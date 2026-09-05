package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AuthDtos.AccessTokenResponse;
import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.api.auth.dto.AuthDtos.RefreshRequest;
import com.studyclub.api.auth.dto.AuthDtos.SocialLoginRequest;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "인증", description = "구글 소셜 로그인 · 토큰 갱신 · 내 정보")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** 구글 소셜 로그인 — 미가입이면 자동가입(STUDENT) + JWT 발급. platform=BACK_OFFICE 는 allowlist 강제. */
    @PostMapping("/social-login")
    public AuthResponse socialLogin(@RequestBody SocialLoginRequest req) {
        return authService.socialLogin(req.code(), req.platform(), req.redirectUri());
    }

    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/me")
    public AccountView me(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return authService.me(authentication.getName());
    }

    @PostMapping("/refresh")
    public AccessTokenResponse refresh(@RequestBody RefreshRequest req) {
        return authService.refresh(req.refreshToken());
    }
}
