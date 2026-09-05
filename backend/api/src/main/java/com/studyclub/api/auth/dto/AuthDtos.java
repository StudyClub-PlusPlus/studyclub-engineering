package com.studyclub.api.auth.dto;

/** 인증 요청/응답 DTO 모음. */
public final class AuthDtos {

    private AuthDtos() {
    }

    /** platform: "CORE"(기본) | "BACK_OFFICE". BACK_OFFICE 는 BO Next 라우트에서 서버측 강제 주입. */
    public record SocialLoginRequest(String code, String provider, String platform, String redirectUri) {
    }

    public record RefreshRequest(String refreshToken) {
    }

    public record AccountView(Long id, String email, String nickname, String profileImgUrl, String systemRole, String createdAt) {
    }

    public record AuthResponse(
            String accessToken,
            String refreshToken,
            long accessTokenExpiresIn,
            long refreshTokenExpiresIn,
            AccountView user) {
    }

    public record AccessTokenResponse(String accessToken) {
    }
}
