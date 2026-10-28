package com.studyclub.api.auth.dto;

import com.studyclub.domain.account.Account;

/** 인증 요청/응답 DTO 모음. */
public final class AuthDtos {

    private AuthDtos() {}

    /** platform: "CORE"(기본) | "BACK_OFFICE". BACK_OFFICE 는 BO Next 라우트에서 서버측 강제 주입. */
    /**
     * @param provider {@code google}(생략 포함) 또는 {@code apple}
     * @param redirectUri 구글: 생략하면 서버 설정의 웹 콜백, iOS 앱은 빈 문자열. 애플: 사이트는 authorize 때 쓴 콜백, iOS 앱은 생략
     * @param name 애플만. 첫 인가에서만 오는 이름 — 저장하지 않고 suggestedNickname 으로만 돌려준다
     */
    public record SocialLoginRequest(
            String code, String provider, String platform, String redirectUri, String name) {}

    public record RefreshRequest(String refreshToken) {}

    /**
     * 로그인·me·백오피스 목록·온보딩 완료 공용 회원 View. {@code onboardingCompletedAt == null} 이면 프론트가 온보딩 화면으로 보낸다.
     */
    public record AccountView(
            Long id,
            String email,
            String nickname,
            String picture,
            String role,
            String createdAt,
            String timeZone,
            String onboardingCompletedAt) {

        public static AccountView from(Account account) {
            return new AccountView(
                    account.getId(),
                    account.getEmail(),
                    account.getNickname(),
                    account.getProfileImgUrl(),
                    account.getSystemRole().name(),
                    String.valueOf(account.getCreatedAt()),
                    account.getTimeZone(),
                    account.getOnboardingCompletedAt() == null
                            ? null
                            : account.getOnboardingCompletedAt().toString());
        }
    }

    public record AuthResponse(
            String accessToken,
            String refreshToken,
            long accessTokenExpiresIn,
            long refreshTokenExpiresIn,
            AccountView account,
            /** 구글이 이번 로그인에 준 name. 온보딩 닉네임 입력칸 초기값용이라 DB 에 저장하지 않는다. */
            String suggestedNickname) {}

    public record AccountSelfView(
            Long id,
            String email,
            String nickname,
            String picture,
            String role,
            String createdAt,
            String timeZone,
            String onboardingCompletedAt,
            String discordNickname,
            /** ACCOUNT.DISCORD_ID 가 있는가. ID 자체는 내리지 않는다. */
            boolean discordLinked,
            /** 연동한 디스코드 username. 마이페이지의 「연결된 계정」 표시용. 미연동이면 null. */
            String discordHandle) {

        public static AccountSelfView from(Account account) {
            AccountView view = AccountView.from(account);
            return new AccountSelfView(
                    view.id(),
                    view.email(),
                    view.nickname(),
                    view.picture(),
                    view.role(),
                    view.createdAt(),
                    view.timeZone(),
                    view.onboardingCompletedAt(),
                    account.getDiscordNickname(),
                    account.isDiscordLinked(),
                    account.getDiscordHandle());
        }
    }

    public record AccessTokenResponse(String accessToken) {}
}
