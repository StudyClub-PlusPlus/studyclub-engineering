# 프론트엔드 인증 흐름

기준: 2026-10-31 작업 트리. 일반 API 호출은 [API 연동 가이드](api-integration.md), 테스트 인증은 [E2E 가이드](e2e-guide.md)를 참고한다.

## 로그인과 코드 교환

core-front는 Google·Apple, back-office-front는 Google 로그인을 제공한다. 두 앱 모두 팝업으로 인가 코드를 받은 뒤 앱의 Route Handler에서 백엔드와 교환한다.

1. 두 앱의 `src/features/auth/auth.ts`가 OAuth authorize URL을 만들고 로그인 페이지가 `window.open()`으로 연다. Google URL을 만드는 별도 GET API는 없다.
2. Google 팝업은 core-front의 `/api/auth/callback`에 도착한다. 백오피스도 `NEXT_PUBLIC_OAUTH_REDIRECT_URI`로 같은 콜백을 사용한다.
3. 콜백은 `{ source: 'studyclub-oauth', code, error }`를 허용된 opener 출처로 `postMessage`하고 닫는다.
4. 부모 창은 `/api/auth/social/login`에 코드와 redirect URI를 POST한다.
5. Route Handler는 백엔드 **`POST /auth/social-login`**을 호출한다. 플랫폼은 서버에서 core-front `CORE`, 백오피스 `BACK_OFFICE`로 고정한다.
6. 토큰은 httpOnly 쿠키에 설정한다. JSON에는 `account`만 반환하며 core-front는 `suggestedNickname`도 반환한다. 토큰을 localStorage에 저장하지 않는다.
7. core-front는 온보딩 미완료 회원을 `/{locale}/onboarding`으로 보낸다. 백오피스는 로그인 응답의 `account.role === 'ADMIN'`도 검사한다.

Apple은 core-front의 `/api/auth/apple/callback`이 `form_post` 응답을 받고, 같은 코드 교환 라우트에 `provider: 'apple'`을 전달한다. 로컬 로그인 지원 여부는 앱의 Apple 설정과 등록된 redirect URI를 확인한다.

### 팝업 메시지 검증의 현재 범위

Google 콜백의 발신 대상은 자기 출처, 운영·stage 백오피스, 로컬 4700/4701이다. `targetOrigin: '*'`를 쓰지 않으며 스크립트에 삽입하는 값의 `<`를 이스케이프한다.

현재 두 로그인 페이지의 수신 핸들러는 `data.source === 'studyclub-oauth'`를 확인한다. **`event.origin`·`event.source` 검증은 구현되어 있지 않다.** 콜백의 발신 대상 제한과 수신측 출처 검증을 같은 것으로 설명하지 않는다.

## 쿠키와 UI 세션

| 저장소 | core-front | back-office-front | 용도 |
|---|---|---|---|
| httpOnly access 쿠키 | `sc_access_token` | `bo_access_token` | API 인증·미들웨어 게이트, 경로 `/` |
| httpOnly refresh 쿠키 | `sc_refresh_token` | `bo_refresh_token` | 경로 `/api/auth` |
| localStorage | `sc_user` | `bo_user` | 회원 정보의 UI 스냅샷 |

`AUTH_COOKIE_ENV=stage`이면 쿠키 이름에 `stage_`가 들어간다. 예: `sc_stage_access_token`, `bo_stage_access_token`. 프론트 서버와 백엔드의 환경 값이 일치해야 한다. 이름 정본은 각 앱의 `src/lib/cookie-names.ts`다.

`sc_user`·`bo_user`에는 이메일 등 회원 정보가 포함될 수 있다. 인증 토큰이나 권한 판정의 근거로 쓰지 않으며 테스트·스크린샷에는 가상 데이터를 쓴다. core-front의 가입 제안 닉네임과 로그인 수단은 sessionStorage에 별도로 보관한다.

쿠키 옵션은 `src/lib/cookies.ts`에 모은다. `httpOnly`, `sameSite: 'lax'`, production의 `secure`를 사용하며, 설정할 때와 삭제할 때의 `path`·`domain`을 맞춘다.

## 토큰 만료와 로그아웃

- core-front에는 `POST /api/auth/refresh`가 있다. refresh 쿠키를 백엔드 `/auth/refresh`로 보내고 성공하면 access 쿠키를 갱신한다.
- core-front 가입·닉네임 확인은 `lib/http.ts`로 백엔드를 직접 호출하며 `{ refreshOnUnauthorized: true }` 옵션으로 401이면 refresh 후 한 번 재시도한다.
- **두 앱 모두 기본 `http()` 호출은 401 후 자동 갱신하지 않는다.** core-front에서 위 옵션을 지정한 요청만 한 번 갱신·재시도한다. 백오피스에는 refresh Route Handler도 없다. 라우트 존재만으로 자동 갱신이 된다고 보지 않는다.
- core-front의 QueryCache는 조회 401에서 UI 세션을 비우며 공개 화면을 강제로 이동시키지 않는다.
- 백오피스의 QueryCache·MutationCache는 401에서 `logout()`으로 세션·캐시와 httpOnly 쿠키를 정리한 뒤 `/login?next=...`로 이동한다. 동시 401은 한 번만 처리하며, 로그아웃 요청은 최대 10초 기다린다. 정리 실패·시간 초과에도 로그인 페이지를 열어 재인증할 수 있다.
- 두 앱의 `logout()`은 UI 세션을 지우고 `POST /api/auth/logout`으로 httpOnly 쿠키를 삭제한다.

## 미들웨어

미들웨어는 쿠키의 **존재만** 확인한다. 토큰의 유효성·역할은 백엔드가 판정한다.

| 앱 | 현재 처리 |
|---|---|
| core-front | 로케일 없는 경로에 기본 로케일 추가. `/{locale}/my` 하위·온보딩은 쿠키 없으면 로케일 로그인으로 이동하며 `next`에 경로와 쿼리를 보존 |
| back-office-front | API·정적 파일 외 화면을 게이트. 쿠키 없으면 `/login?next=...`. `/login`은 쿠키 존재와 무관하게 열어 인증 실패 후 무한 이동을 막는다 |

백오피스의 개발 우회는 `NODE_ENV=development`와 `BO_DEV_BYPASS_AUTH=1`이 동시에 필요하다. 실제 API 권한을 부여하는 기능은 아니다. 카탈로그는 우회를 끄고 테스트 쿠키·고정 응답으로 실행한다.

## 환경변수

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 브라우저 Google authorize URL의 Client ID |
| `NEXT_PUBLIC_OAUTH_REDIRECT_URI` | Google 콜백 URI. 백오피스는 core-front 콜백 사용 |
| `NEXT_PUBLIC_API_BASE_URL` | 브라우저에서 호출할 백엔드 주소 |
| `API_BASE_URL` | 서버에서 호출할 백엔드 주소. 코드 교환 등에서 우선 사용 |
| `AUTH_COOKIE_DOMAIN` | access 쿠키가 API 호스트에도 전달되도록 설정하는 도메인 |
| `AUTH_COOKIE_ENV` | stage 등 환경별 쿠키 이름 분리 |

설정 파일과 실제 값은 커밋하지 않는다. `NEXT_PUBLIC_*`는 클라이언트 번들에 포함되는 값이다.

## 확인할 코드

- [core-front 인증 함수](../../frontend/apps/core-front/src/features/auth/auth.ts) · [로그인 페이지](../../frontend/apps/core-front/src/app/[locale]/login/page.tsx)
- [백오피스 코드 교환](../../frontend/apps/back-office-front/src/app/api/auth/social/login/route.ts)
- [Google 콜백](../../frontend/apps/core-front/src/app/api/auth/callback/route.ts) · [refresh 라우트](../../frontend/apps/core-front/src/app/api/auth/refresh/route.ts)
