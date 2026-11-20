package com.studyclub.domain.event;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.util.regex.Pattern;

/** 입력 정리·검증 공통 — 실패 메시지는 언제나 {@code 필드: 이유} 모양이다 (화면이 필드 이름으로 입력란을 찾는다). */
public final class EventInputs {

    /**
     * JS {@code String.prototype.trim()} 이 지우는 공백 — 화면과 서버가 같은 기준으로 센다 (Q7). Java {@link
     * String#strip()} 은 NBSP(U+00A0) · U+202F · BOM(U+FEFF) 을 남겨, 화면이 「필수」로 막는 제목을 서버가 1자로 받게 된다.
     */
    private static final String JS_WHITESPACE =
            "[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]";

    private static final Pattern EDGE_WHITESPACE =
            Pattern.compile("^" + JS_WHITESPACE + "+|" + JS_WHITESPACE + "+$");

    private EventInputs() {}

    public static BusinessException invalid(String field, String reason) {
        return new BusinessException(ErrorCode.INVALID_INPUT, field + ": " + reason);
    }

    /** 앞뒤 공백을 JS {@code trim()} 과 같은 기준으로 지운다. null 은 null. */
    public static String trim(String value) {
        if (value == null) {
            return null;
        }
        return EDGE_WHITESPACE.matcher(value).replaceAll("");
    }

    /** 공백을 지운 뒤 1~max 자인 필수 글. */
    static void requireText(String field, String trimmed, int max) {
        if (trimmed == null || trimmed.isEmpty() || trimmed.length() > max) {
            throw invalid(field, "1~" + max + "자로 입력해 주세요.");
        }
    }
}
