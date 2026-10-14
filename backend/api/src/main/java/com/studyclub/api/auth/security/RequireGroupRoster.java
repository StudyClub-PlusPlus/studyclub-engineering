package com.studyclub.api.auth.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 그 분반의 활성 참여자(크루 포함) · 네비게이터 · 캡틴만 호출할 수 있다 — {@link GroupRosterGuardInterceptor} 가 검사한다
 * (specs/authz-guards/spec.md). 조회 전용 엔드포인트에 사용하며, 수정 권한이 필요할 때는 {@link RequireCaptainOrNavigator}
 * 를 쓴다.
 *
 * <p>path {@code studyId} + query/path {@code studyGroupId} 조합으로 분반을 특정한다. 다른 분반 소속이면 403.
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireGroupRoster {

    String studyIdParam() default "studyId";

    String studyGroupIdParam() default "studyGroupId";
}
