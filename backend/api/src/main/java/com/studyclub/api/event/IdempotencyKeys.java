package com.studyclub.api.event;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.util.Locale;
import java.util.regex.Pattern;

/** {@code Idempotency-Key} 헤더 — 화면이 제출 시도마다 새로 만드는 UUID v4. 대소문자만 다른 키는 같은 키로 본다. */
final class IdempotencyKeys {

    static final String HEADER = "Idempotency-Key";

    private static final Pattern UUID_V4 =
            Pattern.compile(
                    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");

    private IdempotencyKeys() {}

    /** 없거나 UUID v4 가 아니면 400 — 이때 키는 어디에도 저장되지 않는다. */
    static String parse(String header) {
        if (header != null) {
            String key = header.strip().toLowerCase(Locale.ROOT);
            if (UUID_V4.matcher(key).matches()) {
                return key;
            }
        }
        throw new BusinessException(
                ErrorCode.INVALID_INPUT, HEADER + ": 제출 시도마다 새 UUID v4 를 보내 주세요.");
    }
}
