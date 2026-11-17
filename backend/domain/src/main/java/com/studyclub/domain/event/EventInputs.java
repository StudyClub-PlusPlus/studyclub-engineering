package com.studyclub.domain.event;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;

/** 입력 정리·검증 공통 — 실패 메시지는 언제나 {@code 필드: 이유} 모양이다 (화면이 필드 이름으로 입력란을 찾는다). */
final class EventInputs {

    private EventInputs() {}

    static BusinessException invalid(String field, String reason) {
        return new BusinessException(ErrorCode.INVALID_INPUT, field + ": " + reason);
    }

    /** 앞뒤 공백을 지운다. null 은 null. */
    static String trim(String value) {
        if (value == null) {
            return null;
        }
        return value.strip();
    }

    /** 공백을 지운 뒤 1~max 자인 필수 글. */
    static void requireText(String field, String trimmed, int max) {
        if (trimmed == null || trimmed.isEmpty() || trimmed.length() > max) {
            throw invalid(field, "1~" + max + "자로 입력해 주세요.");
        }
    }
}
