package com.studyclub.api.auth.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 캡틴이거나 담당 네비게이터만 호출할 수 있다 — {@link CaptainOrNavigatorGuardInterceptor} 가 검사한다
 * (specs/authz-guards/spec.md).
 *
 * <ul>
 *   <li>{@link Scope#STUDY} — path {@code studyId} 기준. 그 스터디 어느 분반 네비게이터든 통과
 *   <li>{@link Scope#GROUP} — path {@code studyId} + query/path {@code studyGroupId}. <b>그 분반</b>
 *       네비게이터만 (타 분반은 403)
 * </ul>
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireCaptainOrNavigator {

    Scope scope() default Scope.STUDY;

    String studyIdParam() default "studyId";

    /** {@link Scope#GROUP} 일 때 path 또는 query 파라미터 이름. */
    String studyGroupIdParam() default "studyGroupId";

    enum Scope {
        STUDY,
        GROUP
    }
}
