# 애플 로그인 (iOS 앱)

> 앱스토어 심사 4.8 — 제3자 로그인(구글)을 제공하는 앱은 이메일을 숨길 수 있는 로그인 수단을 같이 내야 한다.
> 구글 로그인 계약은 [auth-google-login](../auth-google-login/spec.md). 이 문서는 거기에 애플을 더한 부분만 쓴다.

## WHAT

iOS 앱 로그인 화면에 **Sign in with Apple** 을 붙인다. 엔드포인트는 그대로 `POST /auth/social-login` 하나이고
`provider` 로 갈린다. 가입·조회·JWT 발급·온보딩 분기는 구글과 같은 경로를 탄다.

## HOW

### 흐름

```
iOS 앱 ──ASAuthorization──▶ Apple  (scope: fullName, email)
   ◀── authorizationCode + (첫 인가에만) fullName
   ▼
POST /auth/social-login { code, provider: "apple", platform: "CORE", name? }
   AppleOAuthClient.exchange(code)
     POST appleid.apple.com/auth/token  client_id=번들 ID, client_secret=ES256 JWT(.p8)
     ◀── id_token + refresh_token
     id_token 의 iss=https://appleid.apple.com · aud=번들 ID 확인 → sub · email · email_verified
   AccountRegistrar.findOrRegister — (APPLE, sub) 로 찾고, 없으면 가입. refresh token 은 ACCOUNT_IDENTITY 에 저장
   → JWT 발급, suggestedNickname = 요청의 name
```

### 요청

| 필드 | 구글 | 애플 |
|---|---|---|
| `code` | 필수 | 필수 — 앱의 `authorizationCode` |
| `provider` | `google` (생략 가능) | `apple` |
| `platform` | `CORE` / `BACK_OFFICE` | `CORE` (`BACK_OFFICE` 는 구글과 같이 조회 전용) |
| `redirectUri` | 생략 = 서버 설정의 웹 콜백. **iOS 앱은 빈 문자열** (SDK 의 serverAuthCode 는 콜백 없이 발급된다) | 쓰지 않음 |
| `name` | 쓰지 않음 | 선택 — 애플은 이름을 **첫 인가에서 한 번만** 준다. 저장하지 않고 `suggestedNickname` 으로만 돌려준다 |

### 판정

- **이메일** — 애플은 사용자가 숨기면 `…@privaterelay.appleid.com` 을 준다. 그대로 ACCOUNT.EMAIL 이 된다. 같은 이메일의 구글 계정이 이미 있으면 구글과 같은 409 `ACCOUNT_LINK_REQUIRED` (자동 병합 없음)
- **email_verified** — 애플은 문자열 `"true"` 로 주기도 한다. 아니면 400 `SOCIAL_LOGIN_EMAIL_REQUIRED`
- **id_token 서명** — 서버가 TLS 로 애플에게서 직접 받은 토큰이라 서명 대신 `iss`·`aud` 만 확인한다 (OIDC Core 3.1.3.7)
- **code 거절** (`invalid_grant`) — 401. 설정 누락 — 503 `EXTERNAL_SERVICE_ERROR`

### 탈퇴

`AccountDeletionService` 가 ACCOUNT_IDENTITY 를 지우기 전에 애플 refresh token 으로 `POST /auth/revoke` 를 부른다
(심사 5.1.1(v)). 실패해도 탈퇴는 계속한다 — 사용자는 애플 ID 설정에서 직접 끊을 수 있다.

### 설정

`APPLE_TEAM_ID` · `APPLE_KEY_ID` · `APPLE_CLIENT_ID`(번들 ID) · `APPLE_PRIVATE_KEY`(.p8 원문 또는 본문 한 줄).
값은 레포에 두지 않는다 — 인프라 담당자에게 요청. 비어 있어도 부팅되고 애플 로그인만 503.

### 스키마

`ACCOUNT_IDENTITY.PROVIDER_REFRESH_TOKEN` 추가 (V41). [ERD](../../docs/erd/ACCOUNT_IDENTITY.md)

## 퍼널·계측

- 단계: 가입 · 재방문 (앱 로그인 화면)
- 이벤트 변화 없음 — 앱 계측은 아직 없다. 가입 확정은 온보딩 완료(`User Signed Up`, [user-onboarding](../user-onboarding/spec.md))가 서버에서 보내고 제공자와 무관하다
- A/B 없음

## 한계 / 후속

- 웹 애플 로그인(Services ID·form_post 콜백)은 범위 밖
- client secret 은 요청마다 새로 서명한다 (수명 5분) — 캐시하지 않는다
- 이미 가입한 구글 계정에 애플을 "연결" 하는 화면은 없다 — 같은 이메일이면 409

## 변경이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-10-28 | 최초 작성 — iOS 애플 로그인 + 탈퇴 revoke, 구글 빈 redirectUri 허용 | 앱스토어 심사 4.8 · 5.1.1(v) |
