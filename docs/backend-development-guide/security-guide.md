# Security & PII Masking Guide

## Table of Contents

- [원칙](#원칙)
- [개인정보(PII) 마스킹](#개인정보pii-마스킹)
- [API 보안](#api-보안)
- [시크릿 관리](#시크릿-관리)

## 원칙

1. **이 레포는 PUBLIC** — 코드에 시크릿/개인정보가 절대 들어가면 안 된다
2. 개인정보는 **저장 시점**과 **응답 시점** 모두에서 보호한다
3. 로그에 PII 를 찍지 않는다

## 개인정보(PII) 마스킹

### 응답에서 마스킹

사용자에게 돌려주는 응답에서 민감 필드는 마스킹 처리:

```java
// ❌ 그대로 노출
public record UserResponse(String email, String name, String phone) {}

// ✅ 마스킹 유틸 적용
public record UserResponse(String email, String name, String maskedPhone) {
    public static UserResponse from(User user) {
        return new UserResponse(
            maskEmail(user.getEmail()),    // h***@gmail.com
            maskName(user.getName()),       // 홍*동
            maskPhone(user.getPhone())      // 010-****-5678
        );
    }
}
```

### 마스킹 기준

| 필드 | 마스킹 방식 | 예시 |
|------|------------|------|
| 이메일 | 앞 1자 + `***` + `@` 이후 | `h***@gmail.com` |
| 이름 | 성 + `*` × (길이-2) + 끝 1자 | `홍*동` |
| 전화번호 | 가운데 4자리 마스킹 | `010-****-5678` |

### 로그에서 PII 제외

```java
// ❌ PII 로그
log.info("User login: email={}, name={}", user.getEmail(), user.getName());

// ✅ 식별자만 로그
log.info("User login: userId={}", user.getId());
```

## API 보안

### 인가 (Authorization)

- 본인 리소스만 접근 가능하도록 체크:

```java
// ❌ 누구나 다른 사람 정보 조회 가능
@GetMapping("/users/{id}")
public UserResponse getUser(@PathVariable Long id) {
    return userService.findById(id);
}

// ✅ 본인 확인
@GetMapping("/users/me")
public UserResponse getMe(@AuthenticationPrincipal Long userId) {
    return userService.findById(userId);
}
```

- 관리자 전용 엔드포인트는 Role 기반 체크 (`@PreAuthorize("hasRole('ADMIN')")`)

### 입력 검증

- 모든 외부 입력은 신뢰하지 않는다 → Validation Guide 참고
- SQL Injection: JPA 사용 시 자동 방어, **네이티브 쿼리에서 파라미터 바인딩 필수**
- XSS: 응답 시 HTML 이스케이프 (JSON API 는 기본 안전, HTML 반환 시 주의)

## 시크릿 관리

```
⚠️ 이 레포는 PUBLIC 이다. 아래를 절대 커밋하지 않는다:
- .env, .env.* 파일
- API 키, 토큰, 비밀번호
- DB 접속 정보, 내부 서버 IP/URL
- SSH 키 (*.pem, *.key)
```

- 시크릿은 `application.yml` 에서 `${ENV_VAR}` 로 참조만
- 로컬: `.env.local` (`.gitignore` 에 등록 확인)
- CI/배포: GitHub Actions Secret 으로 주입
