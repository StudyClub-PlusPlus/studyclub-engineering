package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AccountDtos.OnboardingRequest;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 온보딩 완료. 백오피스 회원 목록은 {@code GET /api/admin/users}({@code AdminUserController})로 옮겼다
 * (specs/admin-users/spec.md 「옛 GET /accounts 를 없앤다」).
 */
@Tag(name = "유저", description = "온보딩 완료")
@RestController
@RequestMapping("/accounts")
public class AccountController {

    private final AccountOnboardingService accountOnboardingService;

    public AccountController(AccountOnboardingService accountOnboardingService) {
        this.accountOnboardingService = accountOnboardingService;
    }

    /**
     * 온보딩 완료 — 만 14세 이상 확인을 검증하고 약관 3종·닉네임·타임존을 한 트랜잭션으로 저장해 가입을 확정한다. 온보딩 미완료 사용자도 호출할 수 있다(회원 전용
     * API 가드 대상이 아니다).
     *
     * <p>일부러 {@code @Valid} 를 안 쓴다 — {@code @Valid} 는 서비스 메서드가 호출되기도 전에 검증하므로, 이미 완료된 계정이 다시 호출할 때
     * "검증보다 멱등 체크가 먼저"라는 스펙 순서(specs/user-onboarding/spec.md)를 지킬 수 없다. 검증은 {@link
     * AccountOnboardingService#complete} 안에서 멱등 체크 다음에 수동으로 한다.
     */
    @Operation(summary = "온보딩 완료")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/onboarding")
    public AccountView completeOnboarding(
            Authentication authentication, @RequestBody OnboardingRequest req) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountOnboardingService.complete(accountId, req);
    }
}
