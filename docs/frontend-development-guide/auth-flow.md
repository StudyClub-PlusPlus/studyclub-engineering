# Authentication Flow (Frontend)

## Table of Contents

- [개요](#개요)
- [Google OAuth 흐름](#google-oauth-흐름)
- [토큰 관리](#토큰-관리)
- [미들웨어](#미들웨어)
- [환경변수](#환경변수)

## 개요

프론트 두 앱 모두 Google OAuth 로 로그인. 흐름은 동일하되 redirect URI 만 다름.

## Google OAuth 흐름

```
1. 로그인 버튼 클릭
   ↓
2. Google OAuth Consent 화면 (NEXT_PUBLIC_GOOGLE_CLIENT_ID 사용)
   ↓
3. Google → 프론트 콜백 URL 로 인가코드 전달
   ↓
4. 프론트 Route Handler (POST /api/auth/social/login)
   → 백엔드 POST /auth/google 호출
   ↓
5. 백엔드 응답 (JWT + 사용자 정보)
   ↓
6. JWT 를 httpOnly 쿠키에 저장 → 리다이렉트
```

### Route Handler 역할 (BFF)

`src/app/api/auth/social/login/route.ts`:
- 프론트 → 백엔드 프록시
- JWT 를 httpOnly 쿠키로 설정 (클라이언트 JS 접근 차단)
- CORS 이슈 회피

## 토큰 관리

| 항목 | 방식 |
|------|------|
| 저장 | httpOnly 쿠키 (`token`) |
| 읽기 | 서버 컴포넌트/미들웨어에서 `cookies()` |
| 만료 | 백엔드 JWT 만료 시간과 동일 |
| 로그아웃 | `/api/auth/logout` 에서 쿠키 삭제 |

## 미들웨어

`src/middleware.ts`:
- 쿠키에 토큰 없으면 → `/login` 으로 리다이렉트
- 로그인 페이지 접근 시 토큰 있으면 → 메인으로 리다이렉트
- 공개 경로 (`/`, `/api/auth/*`) 는 통과

## 환경변수

| 변수 | 설명 | 위치 |
|------|------|------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Client ID | `.env.local` (빌드 시 CI 주입) |
| `API_BASE_URL` | 백엔드 API 주소 | `.env.local` |

`NEXT_PUBLIC_` 접두사가 있는 변수만 클라이언트 번들에 포함됨.
시크릿은 절대 `NEXT_PUBLIC_` 으로 시작하지 않도록 주의.
