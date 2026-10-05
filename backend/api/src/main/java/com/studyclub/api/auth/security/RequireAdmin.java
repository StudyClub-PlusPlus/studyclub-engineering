package com.studyclub.api.auth.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 이 컨트롤러/메서드는 캡틴({@code SYSTEM_ROLE=ADMIN})만 호출할 수 있다 — {@link AdminGuardInterceptor} 가 요청마다 DB 로
 * 확인한다 (specs/authz-guards/spec.md).
 *
 * <p>기본값은 "안 걸림" — 명시 부착만 적용한다 ({@link RequireOnboarding} 과 동일).
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireAdmin {}
