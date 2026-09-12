package com.studyclub.api.auth.validation;

import com.studyclub.domain.account.NicknamePolicy;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * null/blank 는 통과시킨다 — 필수 여부는 {@code @NotBlank} 가 담당하고, 여기서는 형식만 본다. 위반 시 {@code NicknamePolicy} 가
 * 돌려준 구체적 사유를 그대로 필드 메시지로 쓴다 — "2~20자여야 합니다" 처럼 스펙이 요구하는 사유별 문구를 위해 기본 메시지 하나로 뭉개지 않는다.
 */
public class NicknameValidator implements ConstraintValidator<ValidNickname, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String violation = NicknamePolicy.violation(NicknamePolicy.normalize(value));
        if (violation == null) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(violation).addConstraintViolation();
        return false;
    }
}
