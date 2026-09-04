package com.studyclub.common.error;

/**
 * 모든 에러 응답의 유일한 모양.
 *
 * <pre>{@code
 * { "errorCode": "NOT_FOUND", "errorMessage": "스터디를 찾을 수 없습니다." }
 * }</pre>
 *
 * <p>성공 응답에는 래퍼가 없다 — payload 를 그대로 돌려준다. 성공/실패는 HTTP 상태가 말한다.
 */
public record ErrorResponse(String errorCode, String errorMessage) {

    public static ErrorResponse of(ErrorCode code) {
        return new ErrorResponse(code.name(), code.defaultMessage());
    }

    public static ErrorResponse of(ErrorCode code, String message) {
        return new ErrorResponse(code.name(), message == null || message.isBlank() ? code.defaultMessage() : message);
    }
}
