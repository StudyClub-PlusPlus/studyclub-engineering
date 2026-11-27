package com.studyclub.api.auth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 지역 이름이 있는 IANA 시간대 ID 인지 검사한다. 오프셋만 있는 ID(+09:00 · GMT+9)는 거부한다 — specs/timezone/spec.md §3.1 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = TimeZoneValidator.class)
public @interface ValidTimeZone {
    String message() default "지역 이름이 있는 IANA 시간대여야 합니다";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
