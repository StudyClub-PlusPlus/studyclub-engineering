# Exception Handling Guide

## Table of Contents

- [구조](#구조)
- [GlobalExceptionHandler](#globalexceptionhandler)
- [커스텀 예외](#커스텀-예외)
- [에러 응답 포맷](#에러-응답-포맷)
- [예외 사용 원칙](#예외-사용-원칙)

## 구조

```
예외 발생 → GlobalExceptionHandler(@ControllerAdvice) → 일관된 ApiResponse 반환
```

모든 예외는 `@ControllerAdvice` 에서 잡아서 통일된 포맷으로 응답. 컨트롤러에서 try-catch 하지 않는다.

## GlobalExceptionHandler

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // DTO 검증 실패 (400)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new HashMap<>();
        e.getBindingResult().getFieldErrors()
            .forEach(err -> errors.put(err.getField(), err.getDefaultMessage()));
        return ApiResponse.fail("입력값이 올바르지 않습니다", errors);
    }

    // 리소스 없음 (404)
    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNotFound(NotFoundException e) {
        return ApiResponse.fail(e.getMessage());
    }

    // 비즈니스 규칙 위반 (409)
    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> handleConflict(IllegalStateException e) {
        return ApiResponse.fail(e.getMessage());
    }

    // 인증 실패 (401)
    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<Void> handleAuth(AuthenticationException e) {
        return ApiResponse.fail("인증이 필요합니다");
    }

    // 그 외 예상 못 한 예외 (500)
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleUnexpected(Exception e) {
        log.error("Unexpected error", e);  // 내부 로그에만
        return ApiResponse.fail("서버 오류가 발생했습니다");  // 사용자에게는 일반 메시지
    }
}
```

## 커스텀 예외

```java
// 404 용
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}

// 사용
Study study = studyRepository.findById(id)
    .orElseThrow(() -> new NotFoundException("스터디를 찾을 수 없습니다"));
```

필요에 따라 추가:
- `ForbiddenException` (403) — 권한 없음
- `DuplicateException` (409) — 중복
- `BadRequestException` (400) — 잘못된 요청

## 에러 응답 포맷

모든 에러는 `ApiResponse` 형태:

```json
// 일반 에러
{
  "success": false,
  "data": null,
  "message": "스터디를 찾을 수 없습니다"
}

// 검증 에러 (필드별 메시지)
{
  "success": false,
  "data": {
    "title": "스터디 제목은 필수입니다",
    "maxMembers": "최소 2명 이상이어야 합니다"
  },
  "message": "입력값이 올바르지 않습니다"
}
```

## 예외 사용 원칙

1. **컨트롤러에서 try-catch 하지 않는다** — `GlobalExceptionHandler` 가 처리
2. **내부 구현 노출 금지** — 스택 트레이스, SQL 에러 메시지를 사용자에게 반환하지 않는다
3. **비즈니스 예외는 도메인에서 던진다** — 서비스가 아니라 엔티티 메서드에서
4. **예외 메시지는 사용자 친화적으로** — "NullPointerException" (X) → "스터디를 찾을 수 없습니다" (O)
5. **예상 가능한 예외만 커스텀** — `RuntimeException` 계열, checked exception 은 피한다
