package com.studyclub.common.error;

/**
 * 우리가 의도적으로 던지는 예외. {@code GlobalExceptionHandler} 가 잡아
 * {@link ErrorResponse} 로 바꾼다.
 *
 * <p>HTTP 상태를 던지는 쪽에서 정하지 않는다 — {@link ErrorCode} 만 고르면 된다.
 * 서비스가 웹 계층을 몰라야 도메인 로직이 웹 밖에서도 재사용된다.
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, errorCode.defaultMessage());
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode errorCode() {
        return errorCode;
    }
}
