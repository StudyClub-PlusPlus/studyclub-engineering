package com.studyclub.api.auth.dto;

import com.studyclub.api.auth.validation.ValidNickname;
import com.studyclub.api.auth.validation.ValidTimeZone;
import com.studyclub.domain.account.Account;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * ACCOUNT 리소스 DTO 모음. 로그인/토큰 응답 DTO({@link AuthDtos})와는 관심사가 다르지만,
 * {@link AccountView} 는 로그인 응답({@code AuthResponse.user})에도 실려 나가므로 그쪽에서
 * 이 클래스를 참조한다 — "Account 를 어떻게 보여주는가" 는 인증이 아니라 계정 쪽 관심사라서
 * 이름과 위치를 맞췄다.
 */
public final class AccountDtos {

    private AccountDtos() {
    }

    public record AccountView(
            Long id,
            String email,
            String name,
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
                    account.getOnboardingCompletedAt() == null ? null : account.getOnboardingCompletedAt().toString());
        }
    }

    /**
     * 온보딩 완료 요청 (POST /accounts/onboarding). 약관 3종 · 닉네임 · 타임존.
     * 형식 검증(400)은 여기서 전부 끝낸다 — 여러 필드가 동시에 틀려도
     * {@code GlobalExceptionHandler.handleValidation} 이 한 응답에 콤마로 모아 준다.
     * 닉네임 중복(409)은 DB 조회가 필요한 규칙이라 서비스 계층의 몫이다.
     */
    public record OnboardingRequest(
            @AssertTrue(message = "약관에 동의해야 합니다")
            boolean termsOfServiceAgreed,

            @AssertTrue(message = "개인정보 수집·이용에 동의해야 합니다")
            boolean privacyPolicyAgreed,

            @NotNull(message = "마케팅 수신 동의 여부는 필수입니다")
            Boolean marketingAgreed,

            @NotBlank(message = "닉네임은 필수입니다")
            @ValidNickname
            String nickname,

            @NotBlank(message = "타임존은 필수입니다")
            @ValidTimeZone
            String timeZone) {
    }
}
