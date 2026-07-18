package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AuthDtos.AccessTokenResponse;
import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.api.auth.dto.AuthDtos.RefreshRequest;
import com.studyclub.api.auth.dto.AuthDtos.SocialLoginRequest;
import com.studyclub.api.auth.dto.AuthDtos.UserView;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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

    @GetMapping("/me")
    public UserView me(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "인증이 필요합니다.");
        }
        return authService.me(authentication.getName());
    }

    @PostMapping("/refresh")
    public AccessTokenResponse refresh(@RequestBody RefreshRequest req) {
        return authService.refresh(req.refreshToken());
    }
}
