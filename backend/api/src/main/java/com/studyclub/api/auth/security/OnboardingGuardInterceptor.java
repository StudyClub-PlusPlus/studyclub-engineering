package com.studyclub.api.auth.security;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * {@link RequireOnboarding} 이 붙은 핸들러 앞에서 온보딩 완료 여부를 확인한다.
 * 인증 자체는 시큐리티 필터가 이미 끝낸 뒤라 여기서는 "이 계정이 온보딩을 마쳤는가"만 본다.
 */
@Component
public class OnboardingGuardInterceptor implements HandlerInterceptor {

    private final AccountRepository accountRepository;

    public OnboardingGuardInterceptor(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        if (!requiresOnboarding(handlerMethod)) {
            return true;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }

        Account account = accountRepository.findByEmail(authentication.getName().toLowerCase())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
        if (account.getOnboardingCompletedAt() == null) {
            throw new BusinessException(ErrorCode.ONBOARDING_REQUIRED);
        }
        return true;
    }

    private boolean requiresOnboarding(HandlerMethod handlerMethod) {
        return handlerMethod.hasMethodAnnotation(RequireOnboarding.class)
                || handlerMethod.getBeanType().isAnnotationPresent(RequireOnboarding.class);
    }
}
