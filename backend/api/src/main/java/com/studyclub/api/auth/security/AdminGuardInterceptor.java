package com.studyclub.api.auth.security;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * {@link RequireAdmin} 이 붙은 핸들러 앞에서 {@code SystemRole.ADMIN} 여부를 확인한다 — {@link
 * OnboardingGuardInterceptor} 와 정확히 같은 구조다.
 *
 * <p>{@code authentication.getName()}(email) 로 계정을 찾는다 — PR #78(JwtAuthFilter principal 을 email 에서
 * ACCOUNT.ID 로 전환)이 아직 머지되지 않은 상태를 기준으로, {@code OnboardingGuardInterceptor} 와 같은 방식을 그대로 따른다.
 */
@Component
@RequiredArgsConstructor
public class AdminGuardInterceptor implements HandlerInterceptor {

    private final AccountRepository accountRepository;

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        if (!requiresAdmin(handlerMethod)) {
            return true;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }

        Account account =
                accountRepository
                        .findByEmail(authentication.getName().toLowerCase())
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
        if (account.getSystemRole() != SystemRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "백오피스 운영 권한이 없는 계정입니다.");
        }
        return true;
    }

    private boolean requiresAdmin(HandlerMethod handlerMethod) {
        return handlerMethod.hasMethodAnnotation(RequireAdmin.class)
                || handlerMethod.getBeanType().isAnnotationPresent(RequireAdmin.class);
    }
}
