package com.studyclub.api.auth.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 이 컨트롤러/메서드는 온보딩을 완료한 회원만 호출할 수 있다 —
 * {@code ONBOARDING_COMPLETED_AT IS NULL} 이면 {@link OnboardingGuardInterceptor} 가 403
 * {@code ONBOARDING_REQUIRED} 로 막는다 (specs/user-onboarding/spec.md "회원 전용 API 공통 규칙").
 *
 * <p>기본값은 "안 걸림" 이다 — 인증만 되면 온보딩 여부와 무관하게 호출 가능한 API(예: 온보딩
 * 완료 자체, /auth/me)가 실수로 막히지 않도록 명시적으로 붙이는 쪽을 선택했다.
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireOnboarding {
}
