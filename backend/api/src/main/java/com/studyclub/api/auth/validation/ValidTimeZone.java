package com.studyclub.api.auth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** {@code ZoneId.of()} 가 통과하는 IANA 타임존 ID 인지 검사한다. */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = TimeZoneValidator.class)
public @interface ValidTimeZone {
    String message() default "유효한 타임존이 아닙니다";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
