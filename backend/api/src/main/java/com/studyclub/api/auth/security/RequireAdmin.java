package com.studyclub.api.auth.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 이 컨트롤러/메서드는 {@code ACCOUNT.SYSTEM_ROLE = ADMIN} 인 계정만 호출할 수 있다 — 아니면 {@link
 * AdminGuardInterceptor} 가 403 {@code FORBIDDEN} 으로 막는다.
 *
 * <p>PR #80(specs/back-office-login/spec.md) 이 "로그인 이후 요청의 role 검사"를 후속 PR(#78 머지 후)로 명시적으로 미뤄뒀고, 그
 * 후보 설계로 이미 "{@code @RequireAdmin} + 인터셉터, {@link RequireOnboarding} 과 같은 모양"을 지목해뒀다. 그 모양 그대로 지금
 * 만든 것 — 임시 땜질이 아니라 팀이 이미 합의한 모양이라, 후속 PR 이 이 컴포넌트를 그대로 쓰거나 손쉽게 합칠 수 있다.
 *
 * <p>{@link RequireOnboarding} 과 마찬가지로 기본값은 "안 걸림" — 아무 데나 실수로 안 걸리게 명시적으로 붙이는 쪽을 택했다.
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireAdmin {}
