# Exception Handling Guide

## Table of Contents

- [구조](#구조)
- [응답 포맷 — 성공엔 래퍼가 없다](#응답-포맷--성공엔-래퍼가-없다)
- [ErrorCode](#errorcode)
- [BusinessException](#businessexception)
- [GlobalExceptionHandler](#globalexceptionhandler)
- [시큐리티 경로의 401](#시큐리티-경로의-401)
- [예외 사용 원칙](#예외-사용-원칙)

## 구조

```
예외 발생 → GlobalExceptionHandler(@RestControllerAdvice) → ErrorResponse
시큐리티 필터에서 차단 → JsonAuthenticationEntryPoint → ErrorResponse (같은 모양)
```

컨트롤러에서 try-catch 하지 않는다. 예외를 던지면 위 두 경로 중 하나가 잡아서
**항상 같은 모양**으로 내보낸다.

| 파일 | 역할 |
|------|------|
| `common/.../error/ErrorCode.java` | 코드 ↔ HTTP 상태 ↔ 기본 문구. **여기서만 정한다** |
| `common/.../error/ErrorResponse.java` | 응답 레코드 `{errorCode, errorMessage}` |
| `common/.../error/BusinessException.java` | 우리가 의도적으로 던지는 예외 |
| `api/.../web/GlobalExceptionHandler.java` | 예외 → 응답 변환 |
| `api/.../auth/security/JsonAuthenticationEntryPoint.java` | 시큐리티 401 도 같은 모양으로 |

## 응답 포맷 — 성공엔 래퍼가 없다

**성공/실패는 HTTP 상태가 말한다.** 바디에 `success` 같은 플래그를 두지 않는다 —
상태 코드와 중복이고, 둘이 어긋나면 어느 쪽이 진실인지 알 수 없다.

```jsonc
// 성공 (200) — payload 를 그대로. 래퍼 없음
[{ "id": 1, "title": "알고리즘 스터디", "status": "RECRUITING" }]
```

```jsonc
// 실패 (401) — 어디서 나든 이 모양 하나
{ "errorCode": "UNAUTHORIZED", "errorMessage": "인증이 필요합니다." }
```

**프론트는 `errorMessage` 가 아니라 `errorCode` 로 분기한다.** 메시지는 문구가 바뀌고
번역되지만 코드는 계약이다. 메시지는 사용자에게 보여 주는 용도로만 쓴다.

## ErrorCode

| 코드 | HTTP | 언제 |
|------|------|------|
| `INVALID_INPUT` | 400 | 검증 실패, 필수 값 누락 |
| `UNAUTHORIZED` | 401 | 인증 없음, 토큰 무효·만료 |
| `FORBIDDEN` | 403 | 인증은 됐으나 권한 없음 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 비즈니스 규칙 위반 (중복 신청, 마감된 스터디 등) |
| `EXTERNAL_SERVICE_ERROR` | 503 | 외부 연동 실패 (구글 OAuth 등) |
| `INTERNAL_ERROR` | 500 | 예상하지 못한 오류 |

**코드를 늘리기 전에 한 번 묻는다** — 프론트가 이걸 보고 **다르게 행동하는가?**
그렇지 않다면 기존 코드 + 다른 메시지로 충분하다. 코드가 늘면 프론트의 분기도 같이 는다.

## BusinessException

```java
// 기본 문구 그대로
throw new BusinessException(ErrorCode.UNAUTHORIZED);

// 상황에 맞는 문구
throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
```

**던지는 쪽은 HTTP 상태를 모른다.** `ErrorCode` 만 고르면 된다 — 그래야 도메인 코드가
웹 계층에 묶이지 않는다 ([`ddd-guide.md`](ddd-guide.md#도메인-예외)).

`ResponseStatusException` 을 새로 쓰지 않는다. 핸들러에 남아 있는 처리는 프레임워크가
던지는 것을 받기 위한 안전망이다.

## GlobalExceptionHandler

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
        return respond(e.errorCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return respond(ErrorCode.INVALID_INPUT, detail.isBlank() ? null : detail);
    }

    @ExceptionHandler(ResponseStatusException.class)   // 프레임워크/레거시 경로
    public ResponseEntity<ErrorResponse> handleStatus(ResponseStatusException e) {
        return respond(ErrorCode.fromStatus(e.getStatusCode().value()), e.getReason());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        if (e instanceof org.springframework.web.ErrorResponse known) {   // 라우팅 실패 등
            return respond(ErrorCode.fromStatus(known.getStatusCode().value()), null);
        }
        log.error("Unhandled exception", e);   // 내부 사정은 로그에만
        return respond(ErrorCode.INTERNAL_ERROR, null);
    }
}
```

마지막 핸들러의 `instanceof` 가 있는 이유: 라우팅 실패처럼 **자기 상태를 아는 예외**를
`Exception` 으로 뭉뚱그리면 404 가 500 으로 보고된다. 상태를 아는 것은 그 상태를 살린다.

## 시큐리티 경로의 401

시큐리티 필터는 `@RestControllerAdvice` **앞에서** 응답을 끝낸다. 그래서 핸들러만 고치고
`AuthenticationEntryPoint` 를 잊으면 **인증 실패만 빈 바디**가 되고, 프론트가 그 경로만
따로 처리하게 된다.

`JsonAuthenticationEntryPoint` 가 같은 `ErrorResponse` 를 직접 쓴다. 통합 테스트
(`ApiIntegrationTest`)가 이 경로를 지킨다 — 깨지면 이 회귀가 돌아온 것이다.

## 예외 사용 원칙

1. **컨트롤러에서 try-catch 하지 않는다** — 핸들러가 처리한다
2. **내부 구현 노출 금지** — 스택 트레이스·SQL·예외 클래스명은 로그에만. 사용자에게는 일반 문구
3. **비즈니스 예외는 도메인에서 던진다** — 서비스가 아니라 엔티티 메서드에서
4. **메시지는 사용자 친화적으로** — `NullPointerException` (X) → "스터디를 찾을 수 없습니다" (O)
5. **`RuntimeException` 계열만** — checked exception 은 쓰지 않는다
6. **메시지에 개인정보를 넣지 않는다** — 이메일·이름은 로그에도 마스킹 ([`security-guide.md`](security-guide.md))
