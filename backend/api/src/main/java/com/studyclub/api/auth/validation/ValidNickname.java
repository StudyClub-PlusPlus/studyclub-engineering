package com.studyclub.api.auth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 닉네임 형식 규칙 — 실제 판정은 {@code NicknamePolicy}(domain)에 위임한다. */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = NicknameValidator.class)
public @interface ValidNickname {
    String message() default "유효하지 않은 닉네임입니다";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
