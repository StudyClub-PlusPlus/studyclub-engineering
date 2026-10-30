package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AuthDtos.AccessTokenResponse;
import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.api.auth.dto.AuthDtos.RefreshRequest;
import com.studyclub.api.auth.dto.AuthDtos.SocialLoginRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "인증", description = "구글 소셜 로그인 · 토큰 갱신")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** 구글·애플 소셜 로그인 — 미가입이면 자동가입(STUDENT) + JWT 발급. BACK_OFFICE 는 ADMIN 만 통과. */
    @PostMapping("/social-login")
    public AuthResponse socialLogin(@RequestBody SocialLoginRequest req) {
        return authService.socialLogin(
                req.code(), req.provider(), req.platform(), req.redirectUri(), req.name());
    }

    @PostMapping("/refresh")
    public AccessTokenResponse refresh(@RequestBody RefreshRequest req) {
        return authService.refresh(req.refreshToken());
    }
}
