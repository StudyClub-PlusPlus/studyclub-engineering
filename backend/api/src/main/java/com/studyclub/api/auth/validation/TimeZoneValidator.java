package com.studyclub.api.auth.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.Set;

/**
 * 시간대 정책이 고를 수 있다고 정한 목록 중 하나인지 검사한다. null/blank 는 통과 — 필수 여부는 {@code @NotBlank} 가 담당한다.
 *
 * <p>온보딩·프로필 수정 화면의 드롭다운과 같은 넷이다. 밴쿠버·LA 를 합치는 기획 결정이 나오면 {@link #ALLOWED} 와 화면 목록을 같이 고친다.
 */
public class TimeZoneValidator implements ConstraintValidator<ValidTimeZone, String> {

    static final Set<String> ALLOWED =
            Set.of("Asia/Seoul", "America/New_York", "America/Vancouver", "America/Los_Angeles");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        return ALLOWED.contains(value);
    }
}
