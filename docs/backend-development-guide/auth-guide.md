# Authentication Guide

## Table of Contents

- [인증 흐름](#인증-흐름)
- [Google OAuth 로그인](#google-oauth-로그인)
- [JWT 토큰](#jwt-토큰)
- [Security 설정](#security-설정)
- [환경변수](#환경변수)

## 인증 흐름

```
[프론트] Google OAuth Consent → Google 인가코드 획득
   ↓
[프론트] POST /auth/google  { code, redirectUri }
   ↓
[백엔드] Google 토큰 교환 → 사용자 정보 조회 → User upsert → JWT 발급
   ↓
[프론트] JWT 를 쿠키에 저장 → 이후 요청마다 Authorization 헤더
```

## Google OAuth 로그인

### 엔드포인트

```
POST /auth/google
Content-Type: application/json

{
  "code": "4/0Axxxxxxxxx",
  "redirectUri": "http://localhost:3000/api/auth/callback"
}
```

### 응답

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "email": "user@gmail.com",
  "name": "홍길동",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

### 처리 순서 (AuthService)

1. `GoogleOAuthClient` 로 인가코드 → 액세스토큰 교환
2. 액세스토큰으로 Google userinfo 조회
3. 이메일로 `User` 조회, 없으면 신규 생성 (upsert)
4. `JwtService` 로 JWT 발급

## JWT 토큰

- 알고리즘: HS256
- Claim: `sub` = userId, `email`, `role`
- 만료: `application.yml` 의 `jwt.expiration-ms` (기본 86400000 = 24시간)
- 시크릿: `jwt.secret` (환경변수로 주입, 레포에 평문 금지)

### JwtAuthFilter

`OncePerRequestFilter` 를 상속. 모든 요청에서:

1. `Authorization: Bearer <token>` 헤더 추출
2. 토큰 파싱 → userId 추출
3. `UsernamePasswordAuthenticationToken` 세팅
4. 토큰 없거나 무효하면 그냥 통과 (인증 없이 → SecurityConfig 에서 거부)

## Security 설정

`SecurityConfig.java` 에서:

- CSRF 비활성화 (stateless API)
- 세션 STATELESS
- `/auth/**`, `/health` → permitAll
- 나머지 → authenticated
- `JwtAuthFilter` 를 `UsernamePasswordAuthenticationFilter` 앞에 등록

## 환경변수

| 변수 | 설명 | 비고 |
|------|------|------|
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 시크릿 | 레포 커밋 금지 |
| `JWT_SECRET` | JWT 서명 시크릿 | 레포 커밋 금지 |
| `JWT_EXPIRATION_MS` | 토큰 만료 시간(ms) | 기본 86400000 |

`application.yml` 에서 `${ENV_VAR:기본값}` 으로 참조.
