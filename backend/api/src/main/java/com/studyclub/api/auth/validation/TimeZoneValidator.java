package com.studyclub.api.auth.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.DateTimeException;
import java.time.ZoneId;

/** null/blank 는 통과 — 필수 여부는 {@code @NotBlank} 가 담당한다. */
public class TimeZoneValidator implements ConstraintValidator<ValidTimeZone, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        try {
            ZoneId.of(value);
            return true;
        } catch (DateTimeException e) {
            return false;
        }
    }
}
