package com.studyclub.api.auth.dto;

import com.studyclub.api.auth.validation.ValidNickname;
import com.studyclub.api.auth.validation.ValidTimeZone;
import com.studyclub.domain.account.LeaveReason;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * ACCOUNT 리소스(POST/GET /accounts/**) 요청 DTO 모음. 로그인/토큰 응답 DTO({@link AuthDtos})와는 관심사가 달라 분리한다 — 여긴
 * "가입 완료 이후의 계정 관리" 쪽이다.
 */
public final class AccountDtos {

    private AccountDtos() {}

    /**
     * 온보딩 완료 요청 (POST /accounts/onboarding). 만 14세 이상 확인 · 약관 3종 · 닉네임 · 타임존. 형식 검증(400)은 여기서 전부
     * 끝낸다 — 여러 필드가 동시에 틀려도 {@code GlobalExceptionHandler.handleValidation} 이 한 응답에 콤마로 모아 준다. 닉네임
     * 중복(409)은 DB 조회가 필요한 규칙이라 서비스 계층의 몫이다.
     */
    public record OnboardingRequest(
            @Schema(
                            description = "만 14세 이상이라는 본인 확인. 최초 온보딩에 true 필수이며 별도 저장하지 않습니다.",
                            example = "true")
                    @NotNull(message = "만 14세 이상 여부를 확인해야 합니다") @AssertTrue(message = "만 14세 이상이어야 가입할 수 있습니다") Boolean age14Confirmed,
            @AssertTrue(message = "약관에 동의해야 합니다") boolean termsOfServiceAgreed,
            @AssertTrue(message = "개인정보 수집·이용에 동의해야 합니다") boolean privacyPolicyAgreed,
            @NotNull(message = "마케팅 수신 동의 여부는 필수입니다") Boolean marketingAgreed,
            @NotBlank(message = "닉네임은 필수입니다") @ValidNickname String nickname,
            @NotBlank(message = "타임존은 필수입니다") @ValidTimeZone String timeZone) {}

    /**
     * 회원 탈퇴 요청 (DELETE /api/me). {@code reason} 은 선택 — 정해진 값 셋({@link LeaveReason}) 중 하나만 받는다. 자유
     * 문장은 집계가 안 되므로 애초에 받지 않는다 — 정해진 값 밖의 문자열은 역직렬화 단계에서 {@code HttpMessageNotReadableException} 으로
     * 걸러져 {@code GlobalExceptionHandler} 가 400 INVALID_INPUT 으로 응답한다.
     */
    public record LeaveRequest(LeaveReason reason) {}
}
