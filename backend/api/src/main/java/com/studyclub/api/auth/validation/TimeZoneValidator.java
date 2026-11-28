package com.studyclub.api.auth.validation;

import com.studyclub.common.time.TimeZoneIds;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * 지역 이름이 있는 IANA 시간대인지 검사한다 — {@link TimeZoneIds#isValid}. null/blank 는 통과 — 필수 여부는
 * {@code @NotBlank} 가 담당한다. 저장할 정본 ID 로 바꾸는 일은 엔티티가 한다.
 */
public class TimeZoneValidator implements ConstraintValidator<ValidTimeZone, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        return TimeZoneIds.isValid(value);
    }
}
