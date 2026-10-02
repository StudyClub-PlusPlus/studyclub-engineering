package com.studyclub.api.auth.security;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * {@link RequireAdmin} 이 붙은 핸들러 앞에서 캡틴({@code SYSTEM_ROLE=ADMIN}) 여부를 확인한다. JWT 에 role claim 을
 * 넣지 않으므로 요청마다 DB 를 본다 (specs/authz-guards/spec.md).
 */
@Component
public class AdminGuardInterceptor implements HandlerInterceptor {

    private final StudyCaptainGuard studyCaptainGuard;

    public AdminGuardInterceptor(StudyCaptainGuard studyCaptainGuard) {
        this.studyCaptainGuard = studyCaptainGuard;
    }

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
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }

        studyCaptainGuard.assertCaptain(accountId, "권한이 없습니다.");
        return true;
    }

    private boolean requiresAdmin(HandlerMethod handlerMethod) {
        return handlerMethod.hasMethodAnnotation(RequireAdmin.class)
                || handlerMethod.getBeanType().isAnnotationPresent(RequireAdmin.class);
    }
}
