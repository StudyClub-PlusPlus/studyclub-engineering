# 회원가입·온보딩 흐름

소셜 로그인 **첫 성공이 곧 가입**이다. 로그인 직후 ACCOUNT·ACCOUNT_IDENTITY 를 만들고, 온보딩(필수 약관 + 닉네임 + 타임존)을 마쳐야 가입 완료. 완료 시점에 `UserRegisteredEvent` 를 **ACCOUNT 당 1회** 발행하고 웰컴메일은 알림팀이 받아서 보낸다.

MVP 는 **구글만** (기획 08/31). 애플은 같은 구조로 붙을 수 있게만 해 두고 구현하지 않는다 — [애플 붙일 때](#애플-붙일-때).
프로필 이미지는 온보딩에서 안 받는다 (마이페이지, 별도 스펙).

## 흐름

```
로그인 화면
  │
  └─ 구글 인증 → 토큰 검증 → sub · email · email_verified · name
                     │
                     ├─ email 없음 / email_verified≠true
                     │    └─ 가입 불가 안내 → 로그인 화면
                     │
                     └─ 검증 통과
                          │
                          ▼
        ACCOUNT_IDENTITY(ISSUER, PROVIDER_ACCOUNT_ID=sub) 조회
                          │
                          ├─ 있음
                          │    └─ 연결된 ACCOUNT 조회
                          │         ├─ 온보딩 미완료 → 온보딩 화면
                          │         └─ 온보딩 완료   → 홈 (next 있으면 거기)
                          │
                          └─ 없음
                               └─ 동일 EMAIL의 ACCOUNT 조회
                                    ├─ 있음
                                    │    └─ 409 ACCOUNT_LINK_REQUIRED
                                    │       새 계정 생성·자동 연결·JWT 발급 없음
                                    │       기존 로그인 수단으로 로그인 후 계정 연결 안내
                                    │
                                    └─ 없음 = 신규
                                         └─ ACCOUNT + ACCOUNT_IDENTITY 생성
                                            ONBOARDING_COMPLETED_AT=NULL
                                            NICKNAME=account_<랜덤> (임시)
                                            EMAIL=구글 이메일
                                            → JWT 발급 → 온보딩 화면

온보딩 화면
  │  약관 3종 · 닉네임(제공자 이름 미리 채움) · 타임존(브라우저 타임존 미리 선택)
  │
  ├─ 검증 실패 → 필드별 오류, 저장 없음 → 온보딩 화면
  │
  └─ 검증 성공 → 완료 처리 (한 트랜잭션)
                     │  ACCOUNT.NICKNAME · TIME_ZONE · ONBOARDING_COMPLETED_AT=now
                     │  ACCOUNT_CONSENT 3행
                     ▼
                UserRegisteredEvent 발행 → 알림팀 → 웰컴메일
                     │
                     ▼
                홈 (next 있으면 거기)
```

- 토큰은 신규·미완료·완료 전부에서 발급한다. 단, 동일 이메일의 기존 ACCOUNT가 발견되어 `ACCOUNT_LINK_REQUIRED`가 반환된 경우에는 발급하지 않는다. **온보딩 미완료도 로그인 상태**다. 쓸 수 있는 게 적을 뿐.
- 미완료·완료 로그인 때 `ACCOUNT_IDENTITY.LAST_LOGIN_AT` 을 갱신한다. ERD 에 있는 컬럼 — 그 로그인 수단으로 마지막에 들어온 시각. 신규는 행 만들 때 채워진다.

## 사람을 어떻게 찾나 — `(ISSUER, sub)`

이메일이 아니라 제공자가 준 고유값 `sub` 로 찾는다. `sub` 는 제공자 안에서만 고유하니 항상 `ISSUER` 와 쌍으로. ERD `ACCOUNT_IDENTITY` 의 `UNIQUE(ISSUER, PROVIDER_ACCOUNT_ID)` 가 그거다.

```
로그인 성공 → (issuer, sub, email, email_verified, name)

1. email 없음 / email_verified ≠ true                  → 가입 불가
2. ACCOUNT_IDENTITY(issuer, sub) 있음                   → 그 ACCOUNT
3. ACCOUNT_IDENTITY(issuer, sub) 없음 + 동일 email 있음 → 409 ACCOUNT_LINK_REQUIRED
4. ACCOUNT_IDENTITY(issuer, sub) 없음 + 동일 email 없음 → ACCOUNT + ACCOUNT_IDENTITY 신규
```

보안을 위해 이메일이 같다는 이유만으로 기존 ACCOUNT에 로그인 수단을 자동 연결하지 않는다. 처음 보는 `(issuer, sub)`인데 동일 이메일의 ACCOUNT가 이미 있으면 새 ACCOUNT를 만들거나 JWT를 발급하지 않고 `409 ACCOUNT_LINK_REQUIRED`를 반환한다. Google·Apple 계정 연결은 기존 로그인 수단으로 로그인한 상태에서 사용자가 명시적으로 진행하며, MVP 이후 별도 기능으로 구현한다.

예 — 진중이 구글로 가입하고, 나중에 애플도 연결한 상태:

```
ACCOUNT
  ID=7  EMAIL=jin@gmail.com  NICKNAME=jinjoong  ONBOARDING_COMPLETED_AT=2026-09-02 …

ACCOUNT_IDENTITY
  ID=1  ACCOUNT_ID=7  ISSUER=GOOGLE  PROVIDER_ACCOUNT_ID=110293847562938475  PROVIDER_EMAIL=jin@gmail.com
  ID=2  ACCOUNT_ID=7  ISSUER=APPLE   PROVIDER_ACCOUNT_ID=001234.abcd1234…    PROVIDER_EMAIL=abc@privaterelay.appleid.com

구글로 로그인 → (GOOGLE, 110293847562938475) → ACCOUNT_IDENTITY 1 → ACCOUNT 7. 완료 상태니 홈
애플로 로그인 → (APPLE, 001234.abcd1234…)   → ACCOUNT_IDENTITY 2 → ACCOUNT 7. 같은 사람
처음 보는 sub + 동일 이메일 ACCOUNT 없음      → ACCOUNT 8 새로 만들고 온보딩
처음 보는 sub + 동일 이메일 ACCOUNT 있음      → ACCOUNT_LINK_REQUIRED, 기존 계정으로 로그인 후 연결
```

로그인할 계정을 식별할 때는 이메일을 사용하지 않고 `(ISSUER, PROVIDER_ACCOUNT_ID)`를 사용한다. 이메일은 신규 계정 생성 전에 동일 이메일 ACCOUNT가 있는지 확인하여 중복 가입을 막을 때만 사용한다. `ACCOUNT.EMAIL`은 연락처, `ACCOUNT_IDENTITY.PROVIDER_EMAIL`은 "그 제공자가 준 원본" 기록용이다.

- 구글 문서: "Use `sub` within your application as the unique-identifier key for the user." — 이메일은 바뀔 수 있어서 식별자로 쓰지 말라고 못박아 뒀다. ([OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect))
- `ACCOUNT.EMAIL` 은 식별자가 아니라 **연락처**. **첫 가입한 제공자의 이메일**을 넣는다. 자유 입력 수정은 PRD 대로 없고, 제공자를 둘 이상 연결한 뒤 그중 하나로 바꾸는 것만 허용 — [미확정](#미확정-팀-결정).
- 제공자 `name` 은 **저장 안 한다.** 로그인 응답에 실어 온보딩 닉네임 칸 초기값으로만 쓴다. 사이트에서 부르는 이름은 `NICKNAME` 하나면 되고, 실명은 안 갖고 있는 게 낫다.
- 같은 `sub` 가 동시에 두 번 들어와 3 에서 INSERT 가 겹치면 UNIQUE 에 걸린다 → 재조회해서 2 로 태운다.

## 온보딩 입력

- **이용약관** — 필수. `true` 아니면 거부. `ACCOUNT_CONSENT` `TERMS_OF_SERVICE`
- **개인정보 수집·이용** — 필수. `true` 아니면 거부. `ACCOUNT_CONSENT` `PRIVACY_POLICY`
- **마케팅 수신** — 동의 여부는 선택이지만 요청 필드는 필수. `false`도 정상값이며 `ACCOUNT_CONSENT` `MARKETING`에 거부 이력을 남긴다
- **닉네임** — 필수. trim 후 2~20자, **중복 불가**. 모든 언어의 글자·숫자·밑줄(`_`)만 허용하고 공백·줄바꿈·그 외 특수문자는 허용하지 않는다. 밑줄만으로 구성할 수 없으며 영문 대소문자는 구분하지 않는다. `운영진`·`관리자`·`admin` 등 공식 계정으로 오해할 수 있는 이름과 `account_` 접두사는 사용할 수 없다. `ACCOUNT.NICKNAME`
- **타임존** — 필수. IANA ID (`ZoneId.of()` 통과). `ACCOUNT.TIME_ZONE`

약관 버전은 클라이언트가 안 보낸다. **서버가 현재 게시 버전을 붙인다.**
초기값 — 닉네임=제공자 `name`, 타임존=브라우저 `Intl.DateTimeFormat().resolvedOptions().timeZone`. 편의일 뿐, 검증은 똑같이 탄다. DB 의 임시 닉네임(`account_<랜덤>`)은 화면에 안 보여준다 — 온보딩에서 반드시 정한다.
하나라도 실패하면 아무것도 저장 안 하고 필드별 오류.

### 약관 문안·버전 관리

- 약관 문안과 현재 버전은 코드 또는 서버 설정으로 관리하고, MVP에는 별도 테이블·CMS·관리자 편집 화면을 만들지 않는다. 변경 이력은 Git으로 남긴다.
- 이용약관·개인정보처리방침·마케팅 동의 버전은 종류별로 관리하며, 동의 시점의 버전을 각각 `ACCOUNT_CONSENT.CONSENT_VERSION`에 저장한다.
- 약관 문안과 버전은 같은 PR에서 함께 변경한다. 약관 개정 후 기존 회원의 재동의는 별도 기획한다.

## API 계약

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/auth/social-login` | 구글 로그인. 신규면 ACCOUNT+ACCOUNT_IDENTITY 생성, 기존이면 조회. 완료 여부와 무관하게 토큰 발급 | X |
| GET | `/auth/me` | 현재 사용자 조회 — 온보딩 완료 여부 판단용 | O (미완료도 가능) |
| POST | `/accounts/onboarding` | 온보딩 완료 처리 (약관 3종 + 닉네임 + 타임존, 한 트랜잭션) | O (미완료도 가능) |

`POST /accounts/onboarding`은 기존 ACCOUNT 리소스 경로를 사용한다. 온보딩은 1회성 완료 액션이라 마이페이지 수정 API(별도 스펙, `/accounts/me` 형태 예상)와 경로를 분리한다.

### 인증된 ACCOUNT 식별

`POST /accounts/onboarding`은 `accountId`를 요청 바디·경로·쿼리에서 받지 않는다. 백엔드는 JWT의 `sub`에 저장된 `ACCOUNT.ID`로 현재 로그인한 ACCOUNT를 찾아 해당 계정의 온보딩만 처리한다.

### `POST /auth/social-login`

기존에 구현된 엔드포인트다. 요청은 그대로 `{code, provider, platform, redirectUri}` (`provider=GOOGLE`). 로그인 응답의 회원 정보 필드는 `user`에서 `account`로 변경하고, 로그인 전용 View를 사용한다:

- `nickname` — 신규 가입 직후엔 임시값(`account_<랜덤>`) 그대로 내려간다. 화면에는 보여주지 않는다.
- `onboardingCompletedAt` — `string | null` (ISO-8601 UTC). `null`이면 프론트가 `/[locale]/onboarding`으로 보낸다.
- `timeZone` — `string | null`.
- `suggestedNickname` — 구글이 이번 로그인에 제공한 `name`. 온보딩 닉네임 입력칸의 초기값으로만 사용하고 DB에는 저장하지 않는다.

에러:

- 이메일 없음 / `email_verified != true` → `400 SOCIAL_LOGIN_EMAIL_REQUIRED`. 프론트는 이 코드로 "가입 불가 안내" 화면을 다른 400 케이스와 구분해 분기한다.
- 처음 보는 `(issuer, sub)`이지만 동일 이메일의 ACCOUNT가 이미 있음 → `409 ACCOUNT_LINK_REQUIRED`. ACCOUNT·ACCOUNT_IDENTITY를 생성하거나 JWT를 발급하지 않는다. 프론트는 기존 로그인 수단으로 로그인한 뒤 계정을 연결하라고 안내한다.

### `GET /auth/me`

응답은 DB에 저장된 정보만 담는 `AccountView`를 사용한다. `onboardingCompletedAt`·`timeZone`은 포함하고 `suggestedNickname`은 포함하지 않는다. 미완료 사용자도 호출 가능하다.

### `POST /accounts/onboarding`

요청 바디:

```jsonc
{
  "termsOfServiceAgreed": true,   // 필수, true 아니면 거부
  "privacyPolicyAgreed": true,    // 필수, true 아니면 거부
  "marketingAgreed": false,       // 필수, false도 유효 (거부 이력 남김)
  "nickname": "jinjoong",         // 필수, 닉네임 규칙 적용
  "timeZone": "Asia/Seoul"        // 필수, ZoneId.of() 통과하는 IANA ID
}
```

성공 응답은 `200 OK`, body는 닉네임·타임존·`onboardingCompletedAt`이 반영된 `AccountView`.

완료 시각·동의 시각·마지막 로그인 시각 등 모든 시각은 UTC로 저장하고 API에서는 ISO-8601 UTC 형식으로 반환한다(예: `2026-09-05T18:30:00Z`). 화면에서는 ACCOUNT의 타임존에 맞게 변환한다.

멱등: 이미 `ONBOARDING_COMPLETED_AT`이 채워진 사용자가 다시 호출하면, **검증·중복 체크보다 먼저** 그 사실을 확인하고 요청 바디를 무시한 채 현재 상태 그대로 `200 OK`를 반환한다(위 참조). 이 순서를 지키지 않으면 — 예: 이미 완료된 사용자가 그 사이 다른 사람이 선점한 닉네임을 담아 재제출한 경우 — 검증이 먼저 돌아 `409 CONFLICT`가 나가버려 멱등이 깨진다.

에러:

- `400 INVALID_INPUT` — 약관 미동의, 닉네임 길이/형식 위반, 타임존 미유효. 이 검증들은 "가입 불가"와 달리 프론트가 별도 화면으로 분기할 이유가 없는 일반 폼 검증이라 전용 코드를 쓰지 않는다. `errorMessage`는 레포의 `@Valid` 컨벤션 그대로 **실패한 필드 전부**를 `"필드명: 사유"` 형태로 콤마 join 해서 담는다(예: `"termsOfServiceAgreed: 약관에 동의해야 합니다, nickname: 2~20자여야 합니다"`, `GlobalExceptionHandler.handleValidation` 참고) — 필드 배열 같은 새 포맷은 쓰지 않는다.
- `409 CONFLICT` — 닉네임 중복.
- `401 UNAUTHORIZED` — 토큰 없음/만료.

### 회원 전용 API 공통 규칙

`ONBOARDING_COMPLETED_AT IS NULL`인 사용자가 회원 전용 API(신청·출석·마이페이지 수정 등)를 호출하면 `403 ONBOARDING_REQUIRED`. 프론트는 이 코드를 받으면 별도 조회 없이 바로 `/[locale]/onboarding`으로 리다이렉트한다 — 순수 권한 없음(`FORBIDDEN`)과 다른 코드를 써서 두 화면(권한 오류 vs 온보딩 유도)을 구분한다.

### 후속 (이 문서 범위 밖)

- `ErrorCode` enum에 `SOCIAL_LOGIN_EMAIL_REQUIRED`(400), `ACCOUNT_LINK_REQUIRED`(409), `ONBOARDING_REQUIRED`(403) 추가.
- 백엔드 가이드의 에러코드 표에 위 세 코드 반영.
- 백엔드 `AuthResponse.user`와 프론트엔드의 `data.user` 사용 부분을 각각 `account`와 `data.account`로 함께 변경.
- `JwtAuthFilter`는 JWT `sub`의 `ACCOUNT.ID`를 현재 로그인한 사용자값(principal)으로 등록하고, `/auth/me`도 이메일이 아닌 `ACCOUNT.ID`로 조회하도록 변경.

## 미완료 사용자가 할 수 있는 것

`ONBOARDING_COMPLETED_AT IS NULL` 이면 온보딩·내 정보 조회·로그아웃·약관 열람만.

- 프론트: 로그인 필요한 페이지 들어오면 `/[locale]/onboarding` 으로 보낸다. 비회원 공개 범위(목록·상세)는 그대로.
- 백엔드: 회원 기능 API(신청·출석·마이페이지 수정…)는 미완료면 403. 프론트 가드만 믿지 않는다.

## 완료 처리와 이벤트

완료 처리는 **한 트랜잭션**이다 — 닉네임·타임존·완료 시각 저장과 약관 동의 3행 저장이 한 묶음. 하나만 저장되고 하나는 실패하는 상태는 없다.

- **중복 방지 기준 = `ONBOARDING_COMPLETED_AT` 이 NULL → 값으로 바뀐 그 요청.** 완료 시각은 "아직 NULL 인 경우에만" 채우고, 실제로 바뀐 요청에서만 이벤트를 낸다. 이미 완료된 사람이 또 요청하거나 두 탭에서 동시에 눌러도 DB 가 한 쪽만 통과시키니 ACCOUNT 당 1회. 나중에 애플 ACCOUNT_IDENTITY 가 붙어도 마찬가지. `sub` 기준으로 잡으면 ACCOUNT_IDENTITY 가 둘일 때 두 번 나갈 수 있어 ACCOUNT 기준.
- 이벤트는 저장이 확정된 **커밋 후**에 낸다 — 저장 실패했는데 웰컴메일 나가는 일 방지.
- 페이로드는 `accountId` 뿐. 마케팅 동의 여부 등은 알림팀이 `ACCOUNT_CONSENT` 에서 읽는다. 사용자 기능은 SES 를 직접 안 부른다.
- 완료된 사용자가 또 부르면 변경 없이 성공 (멱등). 닉네임·타임존 수정은 마이페이지 API (닉네임 중복 검사는 거기서도 같이).


**ACCOUNT**

- `NICKNAME` — `NOT NULL` 그대로. 로그인 직후엔 `account_<랜덤>` 임시값을 넣고 온보딩에서 정한다. **`UNIQUE(NICKNAME)` 추가** — 임시값이 겹치면 다시 생성
- `ONBOARDING_COMPLETED_AT` — **추가**, `DATETIME NULL`. NULL = 미완료. 이벤트 1회 기준
- `TIME_ZONE` — 온보딩시 정함. NULL 가능 
- `NAME` — 안 만든다. 굳이 실명을 써야할 이유가 없음

**ACCOUNT_IDENTITY**

- `UNIQUE(ISSUER, PROVIDER_ACCOUNT_ID)`가 소셜 계정의 중복 연결을 막는다.
- `PROVIDER_EMAIL`은 OAuth 제공자가 전달한 이메일 원본을 기록한다.
- 로그인·가입 요청에서 `EMAIL_VERIFIED=true`인 경우에만 처리하며, 검증 결과는 별도 컬럼으로 저장하지 않는다.


## 그외 - 애플 붙일 때

애플을 붙일 때 DB·온보딩을 다시 뜯지 않도록 미리 정해 둔 두 가지 —

**온보딩 전 `NICKNAME` 을 NULL 로 허용하나 → 아니오. `NOT NULL` 유지.** 
- 로그인 직후엔 `account_<랜덤>` 임시값을 넣고, 온보딩에서 사용자가 직접 정한다.
- NULL 을 허용하면 명부·후기 등 닉네임을 보여주는 모든 화면이 "닉네임 없는 회원" 을 따로 처리해야 한다.
- 제공자 이름을 닉네임에 넣는 것도 안 된다. 구글은 이름을 매번 주지만 애플은 첫 로그인에만 준다. 그러면 구글 / 애플 첫 로그인 / 애플 재로그인이 다 다르게 갈린다. 임시값을 넣으면 제공자가 뭐든 똑같이 흐른다.
- "ACCOUNT 를 온보딩 완료 때 만들면 되지 않나" — 그러면 온보딩 화면에서 저장 요청을 보낼 때 서버가 누구 요청인지 알 수 없다. 토큰에는 ACCOUNT ID 를 담는데 ACCOUNT 가 아직 없으니까. "아직 회원이 아닌 사람용 임시 토큰" 을 따로 설계해야 해서 더 복잡하다.

**애플 비공개 중계 주소(`@privaterelay.appleid.com`)를 `ACCOUNT.EMAIL` 로 인정하나 → 예. 그대로 저장.** 
- 식별은 `sub` 라 이메일이 뭐든 로그인엔 영향 없고, 중계 주소도 애플이 실제 메일함으로 전달해 주니 연락처로 유효하다. 
- 원본은 `ACCOUNT_IDENTITY.PROVIDER_EMAIL` 에 남는다. 단 구글 이메일과 달라 구글 계정이 있어도 자동으로 묶지 않는다 → 별개 ACCOUNT, 명시적 연결(후속). 다른 길인 "중계 주소면 가입 거부" 는 '이메일 가리기' 를 쓰는 애플 사용자를 통째로 못 받는다.
- 제공자가 둘 이상 연결되면 `ACCOUNT.EMAIL` 은 첫 가입 제공자 것이 그대로다. 애플(중계)로 먼저 가입하고 구글을 연결하면 진짜 주소를 알면서도 알림이 중계로 나가니, **연결된 ACCOUNT_IDENTITY의 `PROVIDER_EMAIL` 중 하나를 대표로 고르는 것**은 허용. 검증된 주소 중 선택이라 아무 주소나 넣는 걸 막는 PRD 취지와 안 부딪히고, 인증 메일도 필요 없다. MVP 는 구글만이라 선택 UI 없음 — 애플과 같이.

애플 문서 ([Authenticating users with Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple)):

> "The API collects this information and shares it with your app the first time the user logs in using Sign in with Apple."
> "Although Apple provides the user's email address in the identity token on all subsequent API responses, it doesn't include other information about the user, such as their name."

- 이름은 **첫 로그인에만** 온다 → 저장 안 하니 무관. 첫 로그인에서 온보딩 안 끝내고 나가면 다음엔 닉네임 칸 초기값이 빈칸 — 어차피 온보딩에서 정해야 하니 그냥 둔다.
- 이메일은 **매번** 온다 → "이메일 없음" 거부에 걸릴 일이 사실상 없다.
- '이메일 가리기' 면 중계 주소가 온다 → 위에서 정한 대로 그대로 저장.

## 미확정 (팀 결정)

- **완료 후 어디로** — 홈, `next` 있으면 `next`. 마이페이지로 보내 프로필 이미지 유도하는 안도 있다.
- **`ACCOUNT.EMAIL` 변경** — 자유 입력은 PRD 대로 안 함. 대신 **연결된 제공자 이메일 중 선택**은 허용하자는 제안 (애플 절 참고). 안 하면 애플(중계) 먼저 가입한 사람은 구글을 연결해도 알림을 영영 중계로 받는다. 자유 입력을 열려면 `UNIQUE(EMAIL)` 충돌 + 변경 인증 메일이 따라온다.

## 한계 / 후속

- **탈퇴** 시 ACCOUNT·ACCOUNT_CONSENT·ACCOUNT_IDENTITY 처리 — PRD 미정, 별도 스펙. ERD 원칙대로면 삭제 대신 `REMOVED_AT`.
- 약관 개정 **재동의** 흐름 없음. 버전은 남으니 나중에 구버전 동의자는 골라낼 수 있다.
- 구글·애플 **명시적 연결**(마이페이지 "계정 연결") — 애플과 같이.
- 프로필 이미지·마이페이지 수정 API 는 별도.
- 웰컴메일 실패 재시도는 알림팀. 여기선 "1회 발행" 까지.
