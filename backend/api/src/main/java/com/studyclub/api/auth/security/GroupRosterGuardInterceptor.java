package com.studyclub.api.auth.security;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/**
 * {@link RequireGroupRoster} 이 붙은 핸들러 앞에서 그 분반의 활성 참여자·네비게이터·캡틴 여부를 확인한다
 * (specs/authz-guards/spec.md).
 */
@Component
public class GroupRosterGuardInterceptor implements HandlerInterceptor {

    private final StudyCaptainGuard studyCaptainGuard;

    public GroupRosterGuardInterceptor(StudyCaptainGuard studyCaptainGuard) {
        this.studyCaptainGuard = studyCaptainGuard;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        RequireGroupRoster annotation = findAnnotation(handlerMethod);
        if (annotation == null) {
            return true;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }

        Long studyId = requireLong(pathVars(request).get(annotation.studyIdParam()), "studyId");
        Long studyGroupId = resolveStudyGroupId(request, annotation.studyGroupIdParam());
        studyCaptainGuard.assertCaptainNavigatorOrMemberOfGroup(
                accountId, studyId, studyGroupId, "권한이 없습니다.");
        return true;
    }

    private static RequireGroupRoster findAnnotation(HandlerMethod handlerMethod) {
        RequireGroupRoster method = handlerMethod.getMethodAnnotation(RequireGroupRoster.class);
        if (method != null) {
            return method;
        }
        return handlerMethod.getBeanType().getAnnotation(RequireGroupRoster.class);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> pathVars(HttpServletRequest request) {
        Object attr = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (attr instanceof Map<?, ?> map) {
            return (Map<String, String>) map;
        }
        return Map.of();
    }

    private static Long resolveStudyGroupId(HttpServletRequest request, String paramName) {
        String fromPath = pathVars(request).get(paramName);
        if (fromPath != null && !fromPath.isBlank()) {
            return requireLong(fromPath, paramName);
        }
        String fromQuery = request.getParameter(paramName);
        if (fromQuery != null && !fromQuery.isBlank()) {
            return requireLong(fromQuery, paramName);
        }
        throw new BusinessException(ErrorCode.INVALID_INPUT, paramName + "가 필요합니다.");
    }

    private static Long requireLong(String raw, String name) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, name + "가 필요합니다.");
        }
        try {
            return Long.valueOf(raw);
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, name + "가 올바르지 않습니다.");
        }
    }
}
