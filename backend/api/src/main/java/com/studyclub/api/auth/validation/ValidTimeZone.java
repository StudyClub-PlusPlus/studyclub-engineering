package com.studyclub.api.auth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 시간대 정책이 고를 수 있다고 정한 IANA 타임존 ID 목록 중 하나인지 검사한다. 목록은 {@link TimeZoneValidator} 에 있다. */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = TimeZoneValidator.class)
public @interface ValidTimeZone {
    String message() default "고를 수 있는 타임존이 아닙니다";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
