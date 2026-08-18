# Logging Guide

## Table of Contents

- [원칙](#원칙)
- [로그 레벨](#로그-레벨)
- [무엇을 로깅하는가](#무엇을-로깅하는가)
- [무엇을 로깅하지 않는가](#무엇을-로깅하지-않는가)
- [포맷](#포맷)

## 원칙

- SLF4J + Logback (Spring Boot 기본)
- **PII 를 로그에 찍지 않는다** (Security Guide 참고)
- 로그는 "디버깅 시 필요한 정보" 를 남기는 것이지, 모든 것을 기록하는 것이 아니다

## 로그 레벨

| 레벨 | 용도 | 예시 |
|------|------|------|
| `ERROR` | 즉시 확인 필요한 오류 | DB 연결 실패, 외부 API 장애 |
| `WARN` | 정상은 아니지만 처리 가능 | 재시도 성공, 폴백 동작 |
| `INFO` | 주요 비즈니스 이벤트 | 사용자 가입, 스터디 생성/마감 |
| `DEBUG` | 개발 중 디버깅 | 쿼리 파라미터, 중간 계산값 |

프로덕션: `INFO` 이상만 출력. `DEBUG` 는 로컬/스테이지 전용.

## 무엇을 로깅하는가

```java
// 비즈니스 이벤트
log.info("Study created: studyId={}, createdBy={}", study.getId(), userId);
log.info("User joined study: studyId={}, userId={}", studyId, userId);

// 외부 호출 결과
log.info("Google OAuth token exchange: success, userId={}", userId);
log.warn("Google OAuth token exchange: failed, status={}", response.getStatusCode());

// 예외 (GlobalExceptionHandler 에서)
log.error("Unexpected error: uri={}", request.getRequestURI(), exception);
```

## 무엇을 로깅하지 않는가

```java
// ❌ PII (개인정보)
log.info("User login: email={}, name={}", email, name);

// ❌ 시크릿/토큰
log.debug("JWT token: {}", token);
log.debug("Google access token: {}", accessToken);

// ❌ 요청/응답 body 전체 (대량 데이터 + PII 위험)
log.debug("Request body: {}", requestBody);

// ❌ 루프 안에서 매 건마다
for (Study s : studies) {
    log.debug("Processing study: {}", s.getId());  // 1000건이면 1000줄
}
```

PII 를 남겨야 할 때는 마스킹 처리:

```java
// ✅ 식별자로 대체
log.info("User login: userId={}", user.getId());

// ✅ 마스킹
log.info("User login: email={}", maskEmail(user.getEmail()));
```

## 포맷

Lombok `@Slf4j` 사용:

```java
@Slf4j
@Service
public class StudyService {

    public void createStudy(CreateStudyRequest request, Long userId) {
        // 파라미터 바인딩 (+ 연결 아님)
        log.info("Creating study: title={}, userId={}", request.title(), userId);
        ...
    }
}
```

**주의**: `log.debug("msg: " + expensiveCall())` 처럼 문자열 연결하지 않는다. DEBUG 가 꺼져 있어도 연결은 실행됨. `log.debug("msg: {}", expensiveCall())` 로 파라미터 바인딩 사용.
