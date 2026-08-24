# Authentication Flow (Frontend)

## Table of Contents

- [개요](#개요)
- [Google OAuth 흐름 — 팝업 패턴](#google-oauth-흐름--팝업-패턴)
- [세션 저장 구조](#세션-저장-구조)
- [리프레시 토큰](#리프레시-토큰)
- [미들웨어](#미들웨어)
- [back-office 인증](#back-office-인증)
- [환경변수](#환경변수)

## 개요

두 앱 모두 Google OAuth 로 로그인한다. 리다이렉트가 아닌 **팝업(popup) 패턴**을 사용한다. 팝업 창에서 Google 인증을 완료한 뒤 `postMessage` 로 부모 창에 code 를 전달하고 창을 닫는다.

## Google OAuth 흐름 — 팝업 패턴

```
1. 로그인 버튼 클릭
   ↓
2. window.open() — 팝업 창 열기
   → /api/auth/social/login?provider=google 로 Google Consent URL 생성 후 리다이렉트
   ↓
3. Google OAuth Consent → 팝업 창의 /api/auth/callback 으로 code 전달
   ↓
4. /api/auth/callback (Route Handler, 팝업 창)
   → window.opener.postMessage({ source: "studyclub-oauth", code }, NEXT_PUBLIC_APP_URL)
   → 팝업 창 닫기 (window.close())
   ↓
5. 부모 창 message 이벤트 수신 (login/page.tsx)
   → origin 검증 후 code 추출
   → POST /api/auth/social/login { provider: "google", code }
   ↓
6. /api/auth/social/login (BFF Route Handler)
   → 백엔드 POST /auth/social/login 호출
   → 응답 데이터를 쿠키 + localStorage 에 이중 저장
   → JSON { user } 반환
```

### /api/auth/callback 보안 주의

`postMessage` 의 `targetOrigin` 은 반드시 `NEXT_PUBLIC_APP_URL` 로 고정한다. `"*"` 를 쓰면 다른 탭에 열린 악성 페이지가 Google 인가 코드를 수신할 수 있다.

```typescript
// app/api/auth/callback/route.ts
const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";
window.opener.postMessage(data, appOrigin);
```

### BFF Route Handler 역할 (social/login)

`src/app/api/auth/social/login/route.ts`:
- 프론트 → 백엔드 프록시 (CORS 이슈 회피)
- 백엔드 응답의 accessToken → `sc_access_token` httpOnly 쿠키 설정
- 백엔드 응답의 refreshToken → `sc_refresh_token` httpOnly 쿠키 설정 (`path: "/api/auth"`)
- `refreshToken` / `accessToken` 은 JSON 응답 본문에 포함하지 않음 (JS 접근 차단)
- `user` 객체는 JSON 응답으로 반환 → 클라이언트가 `sc_user` 로 localStorage 에 저장

## 세션 저장 구조

| 저장소 | 키 | 내용 | 목적 |
|--------|-----|------|------|
| httpOnly 쿠키 | `sc_access_token` | JWT access token | 미들웨어 인증 게이팅 |
| httpOnly 쿠키 | `sc_refresh_token` | refresh token (`path: /api/auth`) | 토큰 재발급 전용 |
| localStorage | `sc_user` | `{ id, name, email, ... }` | 클라이언트 UI 렌더링 |

`sc_access_token` 은 JS 에서 읽을 수 없고 미들웨어와 Route Handler 에서만 접근된다.
`sc_user` 는 민감 정보를 담지 않으며 UI 표시용으로만 쓴다.

## 리프레시 토큰

Google OAuth 는 `access_type: "online"` 으로 호출하므로 **Google 이 refresh token 을 발급하지 않는다**.
앱 자체 refresh token 은 백엔드가 발급하며 `sc_refresh_token` httpOnly 쿠키에 저장된다.

### 토큰 재발급 플로우

```
클라이언트 → POST /api/auth/refresh
              ↓
BFF (/api/auth/refresh)
  → request.cookies 에서 sc_refresh_token 읽기
  → 백엔드 POST /auth/refresh 호출
  → 성공: sc_access_token 쿠키 갱신
  → 실패(401): sc_access_token + sc_refresh_token 삭제, 401 반환
```

클라이언트는 API 호출에서 401 응답을 받으면 `/api/auth/refresh` 를 시도하고 성공 시 원래 요청을 재시도한다.

### 로그아웃

`/api/auth/logout` Route Handler 가 `sc_access_token` 과 `sc_refresh_token` 쿠키를 모두 삭제한다.

## 미들웨어

`src/middleware.ts`:
- `sc_access_token` 쿠키가 없으면 → `/login` 으로 리다이렉트
- 로그인 페이지 접근 시 `sc_access_token` 있으면 → `/` 으로 리다이렉트
- 공개 경로 (`/`, `/api/auth/*`) 는 통과

미들웨어는 토큰 유효성을 검증하지 않는다(서버 호출 없이). 만료된 토큰은 백엔드 API 에서 401 이 반환될 때 감지한다.

## back-office 인증

`back-office-front` 는 별도 OAuth 앱을 등록하지 않고 **core-front (port 4700) 의 콜백 URI 를 재사용**한다.

GCP Google Cloud Console 에 등록된 Authorized redirect URI 가 `http://localhost:4700/api/auth/callback` (또는 프로덕션 core-front 도메인) 하나뿐이므로, back-office 의 Google OAuth 팝업도 같은 URI 로 착지한다.

back-office 에서 로그인 버튼을 누르면:
1. 팝업이 열려 Google Consent → `core-front` 의 `/api/auth/callback` 착지
2. `postMessage` 로 back-office 부모 창에 code 전달
3. back-office 의 `/api/auth/social/login` BFF 로 code 전송

**신규 환경 설정 시**: GCP redirect URI 에 core-front 도메인만 등록하면 된다.

## 환경변수

| 변수 | 설명 | 위치 |
|------|------|------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Client ID | `.env.local` |
| `NEXT_PUBLIC_APP_URL` | 앱 도메인 (postMessage targetOrigin, e.g. `http://localhost:4700`) | `.env.local` |
| `API_BASE_URL` | 백엔드 API 주소 | `.env.local` |

`NEXT_PUBLIC_` 접두사 변수만 클라이언트 번들에 포함됨. 시크릿은 절대 `NEXT_PUBLIC_` 으로 시작하지 않도록 주의.
