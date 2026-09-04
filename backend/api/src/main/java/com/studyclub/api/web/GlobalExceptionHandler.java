package com.studyclub.api.web;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.error.ErrorResponse;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * 모든 에러 응답이 여기 한 곳을 지난다. 컨트롤러에서 try-catch 하지 않는다.
 *
 * <p>응답은 항상 {@link ErrorResponse} — {@code {errorCode, errorMessage}}. 성공 응답에는
 * 래퍼가 없다(payload 직접). 성공 여부는 HTTP 상태가 말하므로 {@code success} 플래그를 두지 않는다.
 *
 * <p><b>내부 사정을 밖으로 내보내지 않는다.</b> 스택 트레이스·SQL·예외 클래스명은 로그에만 남기고
 * 사용자에게는 {@link ErrorCode#INTERNAL_ERROR} 의 일반 문구를 준다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 우리가 의도적으로 던진 예외 — 상태·코드는 ErrorCode 가 안다. */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
        return respond(e.errorCode(), e.getMessage());
    }

    /** @Valid 실패 — 어느 필드가 왜 틀렸는지까지 메시지에 담는다. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return respond(ErrorCode.INVALID_INPUT, detail.isBlank() ? null : detail);
    }

    /**
     * 프레임워크/레거시 경로에서 올라오는 상태 기반 예외. 상태를 우리 코드로 되돌려
     * 응답 모양을 하나로 유지한다. 새 코드는 {@link BusinessException} 을 쓴다.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleStatus(ResponseStatusException e) {
        return respond(ErrorCode.fromStatus(e.getStatusCode().value()), e.getReason());
    }

    /**
     * 그 외 전부. 라우팅 실패처럼 상태를 스스로 아는 예외(NoResourceFoundException 등)는
     * 그 상태를 살리고, 진짜 예상 못 한 것만 500 + 로그로 떨어뜨린다.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        if (e instanceof org.springframework.web.ErrorResponse known) {
            return respond(ErrorCode.fromStatus(known.getStatusCode().value()), null);
        }
        log.error("Unhandled exception", e);
        return respond(ErrorCode.INTERNAL_ERROR, null);
    }

    private static ResponseEntity<ErrorResponse> respond(ErrorCode code, String message) {
        return ResponseEntity.status(code.status()).body(ErrorResponse.of(code, message));
    }
}
