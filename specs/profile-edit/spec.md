# 프로필 수정 — 닉네임·시간대·마케팅 수신 동의를 마이페이지에서 고친다

> Story PRD: [크루는 프로필을 수정할 수 있다.](../../01-planning/stories/crew-edit-profile/PRD.md)

마이페이지 내 정보 카드에서 **닉네임·시간대**를 고쳐 서버에 저장한다. 저장 API 는 `PATCH /api/me` 신규.
이메일은 보이기만 하고 바뀌지 않는다. 닉네임 규칙은 온보딩과 같다 — 형식도, 중복도. 다만 **지금 쓰고 있는 자기 닉네임은 중복으로 보지 않는다.**
**마케팅 수신 동의**도 마이페이지에서 바꾼다. 조회·변경 API 는 `GET`·`PUT /api/me/marketing-consent` 신규이고, 프로필 저장과 따로 간다.

## 지금 (beta 기준)

- core-front 마이페이지의 `ProfileDialog` 는 이름·거주 지역을 브라우저 localStorage(`sc_display_name`·`sc_region`)에만 저장한다. 서버로 가지 않고, 기기가 바뀌면 사라진다.
- 백엔드에 계정 수정 API 가 없다. ACCOUNT 의 닉네임·시간대는 `POST /accounts/onboarding` 때 한 번 정해지고 그 뒤 바꿀 길이 없다. `Account` 에 시간대 setter 도 없다.
- 닉네임 확인 `GET /api/nicknames/availability` 는 있다. 본인이 지금 쓰는 닉네임도 "사용 중" 으로 답한다 — 온보딩 스펙이 마이페이지 판정을 별도 계약으로 남겨 뒀다.
- 디스코드 확인(2026-10-26): `POST`·`DELETE /api/me/discord/link` 구현. `GET /api/me`는 discordLinked·discordHandle·discordNickname을 반환한다.
- 마케팅 수신 동의는 온보딩 때 `ACCOUNT_CONSENT` 에 한 행 저장되고 끝이다. 현재 값을 읽는 API 도, 바꾸는 API 도 없다. 회원 데이터 정책은 변경 지면을 마이페이지로 적어 뒀다.

## 범위

이 스펙이 다루는 것:

- `PATCH /api/me` — 닉네임·시간대 저장
- 닉네임 확인 API 를 프로필 수정에서 쓰는 방식 (본인 제외)
- `GET`·`PUT /api/me/marketing-consent` — 마케팅 수신 동의 조회·변경
- core-front 내 정보 카드의 API 연결

다루지 않는 것:

- **Discord OAuth 연결 계약** — [study-application](../study-application/spec.md)에서 관리. 마이페이지 표시·해제 UX 요구사항은 아래 「디스코드 연결 화면 계약」에서 정의.
- **회원 탈퇴** — 별도 스펙(`DELETE /api/me`, 영현). 카드 아래 탈퇴 링크는 그쪽 지면으로 보내기만 한다.
- **프로필 사진** — 별도 스펙 [profile-image](../profile-image/spec.md) 에서 다룬다 (2026-10-07 결정으로 받기로 바뀌었다). 닉네임 편집과 상관없이 바로 반영되는 별도 API 다.

## 흐름

```
마이페이지 › 내 정보 카드 → 고치기 → 닉네임 · 시간대 편집

  편집 진입 → GET /api/me
    ├─ 200 AccountSelfView                 → 입력칸 · 세션 user 를 최신 값으로, 편집 열림
    ├─ 401 UNAUTHORIZED                    → 재로그인 안내. 편집 안 열림
    └─ 그 밖의 실패                         → "불러오지 못했습니다" 안내. 편집 안 열림

  닉네임 입력이 멈추고 400ms
    ├─ 형식 위반                          → 화면에서 사유. 서버에 안 묻는다
    ├─ 현재 닉네임과 같음 (trim · 대소문자 무시) → 서버에 안 묻는다. 상태 줄은 기본 문구
    └─ GET /api/nicknames/availability?value= → 사용 가능 / 이미 사용중

  저장 → PATCH /api/me { nickname, timeZone }
    ├─ 토큰 없음 · 만료                    → 401 UNAUTHORIZED
    ├─ 온보딩 미완료                        → 403 ONBOARDING_REQUIRED
    ├─ 형식 위반                            → 400 INVALID_INPUT  ("nickname: 사유, timeZone: 사유")
    ├─ 다른 계정이 쓰는 닉네임               → 409 CONFLICT
    └─ 200 AccountView                     → 카드가 보기 상태로, 세션 user 갱신

마이페이지 › 마케팅 수신 동의

  화면 진입 → GET /api/me/marketing-consent → 200 { agreed, agreedAt }

  변경 → PUT /api/me/marketing-consent { agreed }
    ├─ 토큰 없음 · 만료                    → 401 UNAUTHORIZED
    ├─ 온보딩 미완료                        → 403 ONBOARDING_REQUIRED
    ├─ agreed 누락                          → 400 INVALID_INPUT
    └─ 200 { agreed, agreedAt }            → 화면이 응답 값으로 바뀐다
```

## 판정 규칙

- **누구를 고치나** — JWT `sub` 의 `ACCOUNT.ID`. 경로·바디·쿼리에 id 를 받지 않는다. 온보딩과 같다.
- **온보딩 미완료 계정은 못 부른다.** `@RequireOnboarding` — 온보딩 스펙의 "회원 전용 API 공통 규칙" 그대로 403 `ONBOARDING_REQUIRED`.
- **닉네임 형식은 `NicknamePolicy` 그대로.** trim 후 2~20자, 모든 언어의 글자·숫자·밑줄만, 밑줄만은 불가, `운영진`·`관리자`·`admin`·`account_` 접두사 불가. 온보딩과 같은 `@ValidNickname` 을 쓴다. 한쪽만 규칙이 다르면 두 화면이 다른 말을 한다.
- **본인 제외.** 중복 검사는 자기 계정을 뺀 다른 계정만 본다. 자기 이름을 자기가 쓰고 있을 뿐이다. `Honggildong` → `honggildong` 처럼 표기만 바꾸는 것도 통과하고, 저장값은 새 표기다.
- **"자기 닉네임인가" 를 서버에서 문자열로 비교하지 않는다.** DB 는 `cafe` 와 `café`, 반각과 전각을 같은 닉네임으로 본다. 서버가 대소문자 무시로만 비교하면 이런 표기 변경을 다른 닉네임으로 보고 중복 검사를 돌리고, DB 는 자기 행을 찾아내 409 가 된다. 그래서 비교하지 않고 조회에서 자기 계정을 뺀다.
- **다른 계정이 쓰고 있으면 409.** 대소문자 무시 비교는 온보딩과 같다. 검사와 flush 사이에 다른 계정이 먼저 가져간 경우는 `UNIQUE(NICKNAME)` 위반(`DataIntegrityViolationException`)을 받아 같은 409 로 — 온보딩과 같은 마지막 방어선.
- **비교 기준은 대소문자 무시까지.** 닉네임 정책은 "trim → NFC → 소문자" 로 비교한다고 돼 있는데 서버는 NFC 를 안 한다. 온보딩 스펙이 그렇게 결정했고 여기서 혼자 바꾸지 않는다 — [한계 / 후속](#한계--후속).
- **시간대 — 서버도 화면도 넷만 받는다.** `Asia/Seoul` · `America/New_York` · `America/Vancouver` · `America/Los_Angeles`.
  - 서버: 온보딩과 같은 `@ValidTimeZone`. 검증기가 "목록 중 하나인가" 를 본다. `Asia/Tokyo` 처럼 존재하는 IANA ID 라도 목록에 없으면 400 `INVALID_INPUT`. 온보딩과 프로필 수정이 같은 검증기를 쓰므로 둘이 같이 막힌다.
  - 화면: 드롭다운에 한국 · 서울 / 북미 동부 · 뉴욕, 토론토 / 북미 서부 · 밴쿠버 / 북미 서부 · LA 넷을 둔다. 온보딩 화면과 같은 목록이다.
  - 왜 넷인가: 시간대 정책 문서는 밴쿠버와 LA 를 한 줄로 묶어 셋이다. 그런데 둘은 서머타임 적용이 달라 특정 기간에 1시간 차이가 날 수 있어서 온보딩 화면이 둘을 나눴다.
  - 막기 전에 저장된 값: 서버가 전부 받던 때 넷 밖 시간대로 저장된 계정은 조회는 그대로 된다. 편집에 들어가면 드롭다운이 "지역을 선택해 주세요" 로 보이고, 넷 중 하나를 골라야 저장된다. 닉네임만 바꾸려 해도 시간대를 같이 골라야 한다 — 두 필드가 한 요청이라서다.
- **지역은 시간대에서 파생한다.** `Asia/Seoul` 이면 한국, 그 밖이면 북미. 서버는 `REGION_GROUP` 을 채우지 않는다(지금도 아무 코드가 안 채운다). 프론트가 신청 폼 시간대 기준으로 쓰는 region 값은 timeZone 에서 계산한다.
- **이메일은 요청에 없다.** DTO 에 필드가 없어 보내도 무시된다. 응답에는 실린다.
- **부분 갱신은 없다.** 두 필드 다 필수. 카드가 "한 번에 고치고 한 번에 저장" 이라 한 필드만 오는 경우가 없고, null 분기를 안 만든다. 값이 하나도 안 바뀌어도 200.
- **마케팅 수신 동의는 프로필 저장과 따로 간다.** `PATCH /api/me` 바디에 싣지 않고 `AccountView` 에도 싣지 않는다.
  - 저장 위치가 다르다. 닉네임·시간대는 ACCOUNT 한 행이고 동의는 `ACCOUNT_CONSENT` 다.
  - `AccountView` 에 실으면 로그인과 `GET /api/me` 가 매번 동의 테이블을 읽는다. 값이 필요한 곳은 마이페이지 하나다.
  - 화면 수정본이 아직 없다. API 가 따로면 동의 항목이 카드 안에 들어가든 밖에 놓이든 그대로 쓴다.
- **보는 행은 현재 약관 버전의 `MARKETING` 행 하나.** 온보딩이 저장할 때 쓰는 `ConsentType.MARKETING.currentVersion()` 과 같은 버전이다. 행이 있으면 그 값, 없으면 미동의로 답한다.
- **변경은 그 행을 덮어쓴다.** `AGREED` 와 `AGREED_AT` 을 바꾼다. 행이 없으면 현재 버전으로 만든다. 행을 새로 쌓지 않는 이유 — `UNIQUE(ACCOUNT_ID, CONSENT_TYPE, CONSENT_VERSION)` 이 같은 버전 행을 하나만 허용한다. 알림팀이 `ACCOUNT_CONSENT` 를 읽는 방식도 안 바뀐다. 대신 바꾼 이력은 남지 않는다. 마케팅 수신 동의에 따로 약관이 없어서 마지막 값과 그 시각만 남기기로 했다.
- **값이 지금과 같으면 아무것도 안 바꾼다.** 200 이고 `AGREED_AT` 도 그대로다. `AGREED_AT` 은 지금 값으로 정한 시각이어야 한다.
- **이용약관·개인정보 동의는 여기서 못 바꾼다.** 경로와 바디에 동의 종류를 받지 않는다.

## API 계약

### `GET /api/me` (옮김)

로그인한 본인의 `AccountSelfView`. 편집에 들어갈 때 최신 값을 받으려고 부른다. 온보딩 미완료 계정도 부를 수 있다 — 프론트가 이 응답의 `onboardingCompletedAt` 으로 온보딩 화면으로 보낼지 정한다. 응답은 온보딩 스펙의 `AccountView` 필드에 아래 세 줄을 더한 모양이다. `PATCH /api/me` 응답도 같은 모양이다.

- `discordNickname` — 스터디 신청에서 제출한 서버 별명. 없으면 null.
- `discordLinked` — 디스코드 계정 연동 여부(boolean). `ACCOUNT.DISCORD_ID` 가 있으면 true. ID 는 내리지 않는다. 신청 버튼이 연동 창을 띄울지 이 값으로 정한다 (DSC-02).
- `discordHandle` — 연동한 디스코드 `username`. 마이페이지의 「연결된 계정」 표시용. 미연동이면 null. 서버 별명 `discordNickname` 과 다른 값이다.

| 상태 | errorCode | 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 토큰 없음 · 만료 · 계정 없음 |

### `PATCH /api/me` (신규)

로그인한 본인의 닉네임·시간대를 한 번에 저장한다. 마이페이지 내 정보 카드의 저장 버튼이 부른다. 누구를 고칠지는 토큰으로 정하고, 이메일은 안 받는다.

인증 필요 + 온보딩 완료 필요.

Request:

```jsonc
{
  "nickname": "honggildong",        // 필수. 온보딩과 같은 규칙
  "timeZone": "America/Vancouver"   // 필수. 고를 수 있는 넷 중 하나
}
```

Response `200 OK` — `AccountSelfView`. `GET /api/me` 와 같은 모양이고 `nickname`·`timeZone` 에 새 값이 실린다. 프론트는 이 응답으로 세션 user 를 갱신하고 다시 조회하지 않는다.

| 상태 | errorCode | 조건 |
|---|---|---|
| 400 | INVALID_INPUT | 닉네임·시간대 형식 위반. `errorMessage` 는 `"nickname: 2~20자여야 합니다, timeZone: ..."` — `@Valid` 컨벤션 그대로 실패한 필드 전부를 콤마로 |
| 401 | UNAUTHORIZED | 토큰 없음 · 만료 |
| 403 | ONBOARDING_REQUIRED | `ONBOARDING_COMPLETED_AT IS NULL` |
| 409 | CONFLICT | 다른 계정이 쓰는 닉네임 (대소문자 무시). 본인 현재 닉네임은 해당 없음 |

메시지:
- `CONFLICT` — `이미 사용 중인 닉네임입니다.` (온보딩과 같은 문장)

`ErrorCode` 추가 없음. 마이그레이션 없음.

### `GET /api/me/marketing-consent` (신규)

로그인한 본인의 마케팅 수신 동의 현재 값을 돌려준다. 마이페이지가 화면을 그릴 때 부른다.

인증 필요 + 온보딩 완료 필요.

Response `200 OK`:

```jsonc
{
  "agreed": true,
  "agreedAt": "2026-09-29T03:00:00Z"   // 지금 값으로 정한 시각. 행이 없으면 null
}
```

| 상태 | errorCode | 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 토큰 없음 · 만료 |
| 403 | ONBOARDING_REQUIRED | `ONBOARDING_COMPLETED_AT IS NULL` |

### `PUT /api/me/marketing-consent` (신규)

로그인한 본인의 마케팅 수신 동의를 켜거나 끈다. 누구 것을 바꿀지는 토큰으로 정한다.

인증 필요 + 온보딩 완료 필요.

Request:

```jsonc
{
  "agreed": false   // 필수. false 도 정상값
}
```

Response `200 OK` — 조회와 같은 모양이고 저장된 값이 실린다.

| 상태 | errorCode | 조건 |
|---|---|---|
| 400 | INVALID_INPUT | `agreed` 누락 · null |
| 401 | UNAUTHORIZED | 토큰 없음 · 만료 |
| 403 | ONBOARDING_REQUIRED | `ONBOARDING_COMPLETED_AT IS NULL` |

`ErrorCode` 추가 없음. 마이그레이션 없음.

### `GET /api/nicknames/availability` (본인 제외)

인증 필요, 온보딩 미완료도 가능. **저장 API 와 같은 조회(`existsByNicknameIgnoreCaseAndIdNot`)를 쓴다 — 부른 사람의 계정은 빼고 본다.** 미리 확인하는 판정과 저장 판정이 다르면 "확인은 안 되는데 저장은 된다" 가 생기므로 둘은 같은 기준이다. 자기 닉네임에 악센트를 붙이거나 전각으로 바꿔도 `available=true` 로 답한다.

프론트는 입력값을 trim 하고 대소문자 무시로 현재 닉네임과 비교해 같으면 서버에 묻지 않는다. 안 바뀐 값으로 요청을 보낼 이유가 없어서다. 온보딩 화면은 임시 닉네임(`account_` 접두사)이 형식 검사에서 먼저 걸려 본인 제외가 드러나지 않는다.

### 경로가 `/api/me` 인 이유

온보딩 스펙은 마이페이지 수정 API 를 "`/accounts/me` 형태 예상" 으로 적어 뒀다. 그 뒤 기획이 `PATCH /api/me`(프로필)·`DELETE /api/me`(탈퇴)로 잡았고, 참가자 허브·북마크가 이미 `/api/me/studies`·`/api/me/bookmarks` 를 쓴다. 마이페이지 = `/api/me` 로 모은다. 조회도 `GET /api/me` 다 — 프로필 수정이 끝난 뒤 `GET /auth/me` 에서 옮겼고, 온보딩 미완료 계정도 조회는 되게 가드를 수정·동의 메서드에만 건다. 인증 묶음(`/auth`)에는 로그인·토큰 갱신만 남는다.

### 바뀌지 않는 것

`POST /accounts/onboarding`, `GET /api/nicknames/availability` 전부 그대로. `AccountView`·`AccountSelfView` 모양도 그대로다 — 마케팅 동의 값을 싣지 않는다. `SecurityConfig` 도 안 건드린다 — `anyRequest().authenticated()` 라 새 경로가 자동으로 인증 대상이다.

## 백엔드 구현 지점

- `Account` 에 닉네임·시간대를 한 번에 바꾸는 메서드 하나. setter 둘로 나누지 않는다 — 닉네임은 중복 검사를 거친 값만 들어와야 하는데 setter 를 열어두면 검사 없이 바꾸는 경로가 생긴다. 이미 있는 `setNickname` 은 사용처가 없고 이번에도 쓰지 않는다. 형식 검증은 `completeOnboarding` 과 같이 DTO 가 끝낸 값이 온다고 가정한다.
- `PATCH /api/me` 컨트롤러는 새 클래스. 기존 `AccountController` 는 `/accounts` 아래라 여기에 못 얹는다. 북마크·참가자 허브 컨트롤러가 같은 base path 를 쓰지만 메서드·하위 경로가 다르니 충돌 없다. `@RequireOnboarding` + `@Valid` — 온보딩과 달리 멱등 체크가 검증보다 먼저여야 할 이유가 없어서 400 은 `GlobalExceptionHandler` 에 맡긴다.
- 서비스는 `AccountOnboardingService` 와 같은 모양 — `@Transactional` 안에서 잠금 조회, 자기 계정을 뺀 중복 검사 → 저장. 응답은 `AccountSelfView` — `GET /api/me` 와 같은 모양이라 프론트가 세션 user 를 그대로 덮어쓴다. 계정 저장소에 "이 계정 말고 이 닉네임을 쓰는 계정이 있나" 조회를 하나 더한다.
- `NicknamePolicy`·`@ValidNickname` 은 안 건드린다. 온보딩과 한 벌이라 여기서 바꾸면 두 화면이 갈린다. 확인 API 의 본인 제외는 이 PR 에서 바꿨다. `@ValidTimeZone` 의 목록 검증은 후속 PR 이다.
- 마케팅 동의 조회·변경은 `PATCH /api/me` 와 같은 컨트롤러에 둔다. 둘 다 `@RequireOnboarding`, 변경은 `@Valid`. `GET /api/me` 도 같은 컨트롤러인데 온보딩 미완료도 돼야 하므로 가드는 클래스가 아니라 메서드에 건다.
- `AccountConsent` 에 동의 여부와 시각을 같이 바꾸는 메서드 하나. 지금은 생성자뿐이라 저장된 행을 바꿀 길이 없다. `AccountConsentRepository` 에는 계정·종류·버전으로 한 행을 찾는 조회를 더한다.
- 변경 서비스는 `@Transactional` 안에서 계정 행을 먼저 잠그고 동의 행을 찾는다. 잠금이 없으면 연달아 온 두 요청이 둘 다 "행 없음" 을 보고 만들다가 한쪽이 `UNIQUE` 에 걸린다.

## 프론트 (core-front)

- **화면은 프로토(playground `/proto/core/ko/my`)를 따른다** — 보기와 편집이 한 카드 안에서 바뀐다. 지금의 모달(`ProfileDialog`)을 카드로 바꾼다.
- **닉네임·시간대의 진본은 서버다.** `lib/me.ts` 의 브라우저 저장(displayName·region)을 없애고 세션 user 의 `nickname`·`timeZone` 에서 읽는다. 신청 폼의 region 은 timeZone 에서 파생한다.
- **편집에 들어갈 때 `GET /api/me` 로 최신 값을 받는다.** 받은 값으로 입력칸과 세션 user 를 갱신한다. 휴대폰에서 먼저 바꿨으면 컴퓨터 세션에는 이전 값이 남아 있다. 못 받으면 편집을 열지 않는다 — 세션 값으로 열면 다른 기기에서 바꾼 뒤의 옛 닉네임을 보여주게 된다. 401 은 재로그인 안내, 그 밖은 "불러오지 못했습니다" 안내.
- **저장 중에는 입력칸·시간대·취소를 잠근다.** 저장 중에 취소하고 다시 연 편집을 먼저 보낸 저장 응답이 닫아 버리면 안 된다.
- **저장은 `http('/api/me', PATCH)` 직접 호출.** 중계 라우트 없음(`lib/http.ts` 관례). 성공 응답으로 `setUser` 갱신.
- **닉네임 상태 줄은 온보딩 화면과 같은 검사·같은 문구.** 형식은 화면에서, 중복은 디바운스 후 확인 API. 현재 값과 같으면(trim·대소문자 무시) 안 묻는다. 시간대 셀렉트는 온보딩과 같은 넷 — 온보딩 화면의 선택 컴포넌트를 같이 쓴다. 화면 목록은 그 컴포넌트 하나, 서버 목록은 검증기 하나다. 목록이 바뀌면 둘을 같이 고친다.
- **오류** — 400 은 해당 필드 줄, 409 는 닉네임 줄, 401 은 재로그인, 403 `ONBOARDING_REQUIRED` 는 온보딩으로. 입력은 지우지 않는다.
- **디스코드 줄** — 아래 「디스코드 연결 화면 계약」에 따라 연결 상태·계정 이름·버튼·해제 제한을 표시. 실제 core-front 연결은 후속 개발.
- **마케팅 수신 동의는 켜고 끄는 한 줄.** 화면에 들어올 때 조회하고, 바꾸면 바로 `PUT` 한다. 성공하면 어떤 값으로 언제 처리됐는지 알림으로 띄운다 — 체크 표시만 바뀌면 처리됐는지 알기 어렵다. 실패하면 이전 값으로 되돌리고 서버가 알려준 사유를 그대로 보여준다. 응답을 못 받은 실패만 고정 문구다. 조회에 실패하면 체크박스를 잠그고 새로고침을 안내한다. 기획팀이 프로토에 이 항목을 넣는 중이라 위치·문구는 수정본이 나오면 맞춘다. 그때까지 문구는 온보딩 동의 화면의 마케팅 항목을 따른다.

## 미확정 (팀 결정)

없음 — 마케팅 수신 동의를 바꾼 이력은 남기지 않기로 했다.

## 한계 / 후속

- **조회 경로를 `/api/me` 로 옮기기** — 완료. `GET /auth/me` 는 없애고 `GET /api/me` 로 받는다. 스터디 상세 이슈와 모바일 이슈가 기다리던 경로다.
- **마케팅 수신 동의 화면** — 프로토 수정본이 나오면 위치·문구를 맞춘다. API 는 그대로다.
- **약관 버전이 오를 때** — 지금 `MARKETING` 버전은 1.0 하나다. 개정 때 이전 버전 동의를 새 버전으로 넘길지는 그때 정한다.
- **디스코드 연결·해제** — API 구현완료. 연결·해제는 [study-application](../study-application/spec.md#디스코드-연결-해제), 계정 이름은 `GET /api/me` 의 `discordHandle`. core-front 화면 연결이 남았다. 시안은 아래 화면 계약 참조.
- **확인 API 의 본인 제외** — 완료. 확인 API 가 저장 API 와 같은 조회를 써서 부른 사람의 계정을 빼고 본다. 온보딩 화면은 영향 없다.
- **NFC 정규화** — 정책은 NFC 비교인데 서버는 대소문자 무시까지다. 도입하려면 확인 API·최종 검사·기존 데이터를 한 번에 봐야 한다. 온보딩 스펙과 같은 유보.
- **서버 시간대 검증을 화면 목록으로 막기** — 완료. `@ValidTimeZone` 검증기가 넷 중 하나인지 본다.


## 변경이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-09-29 | 최초 작성 — `PATCH /api/me` 닉네임·시간대, 본인 제외 중복 판정, 디스코드·탈퇴·마케팅 동의는 범위 밖 | 마이페이지 값이 브라우저에만 남아 기기가 바뀌면 사라진다. 닉네임·시간대 규칙은 온보딩과 한 벌이어야 두 화면이 같은 말을 한다 |
| 2026-10-01 | 리뷰 반영 — 시간대 선택지 셋 → 넷(밴쿠버·LA 분리), 마케팅 수신 동의 조회·변경 `GET`·`PUT /api/me/marketing-consent` 추가, 조회 경로 `/api/me` 이전은 후속으로. 온보딩 프론트가 머지돼 `name` → `nickname` 표기를 맞추고 프론트 PR 순서 항목을 뺐다 | 시간대 목록은 온보딩 화면과 같아야 한다. 마케팅 동의는 회원 데이터 정책이 마이페이지에서 바꾼다고 정했다 |
| 2026-10-01 | 본인 제외를 문자열 비교에서 "자기 계정을 뺀 조회" 로 변경 | DB 는 악센트·전각 차이를 같은 닉네임으로 본다. 문자열 비교로는 표기만 바꾸는 본인이 409 를 맞는다 |
| 2026-10-02 | 리뷰 반영 — 편집에 들어갈 때 `GET /auth/me` 로 최신 값을 받아 입력칸·세션 갱신, 마케팅 수신 동의 변경 이력은 남기지 않기로 확정 | 다른 기기에서 먼저 바꾸면 이 브라우저 세션에는 이전 값이 남는다. 마케팅 수신 동의에 따로 약관이 없어 마지막 값과 시각이면 된다 |
| 2026-10-13 | 조회 경로 이전 — `GET /auth/me` 를 없애고 `GET /api/me` 로. 응답은 `AccountSelfView`. 온보딩 미완료 계정도 조회는 된다 | 마이페이지 API 를 `/api/me` 한 묶음으로 모은다. 스터디 상세·모바일이 이 경로를 기다렸다 |
| 2026-10-13 | 확인 API 가 저장 API 와 같은 조회를 쓴다 — 부른 사람의 계정을 빼고 본다 | 확인 판정과 저장 판정이 다르면 "확인은 안 되는데 저장은 된다" 가 생긴다. 자기 닉네임의 표기(악센트·전각)만 바꾸면 화면이 "사용 중" 으로 막던 게 그 경우다 |
| 2026-10-13 | 구현과 맞춤 — `GET /api/me` 계약 추가(`discordNickname` 포함, `PATCH` 응답도 같은 모양), 편집 진입 실패 시 안 열림, 저장 중 잠금, 동의 변경 결과 알림·서버 사유 표시 | 구현 PR 리뷰에서 바뀐 동작이 스펙에 없었다 |
| 2026-10-13 | 서버 시간대 검증을 화면과 같은 넷으로 막는다 — 온보딩·프로필 수정 공통 | 시간대 정책은 정해진 목록만 허용하고, 반 편성이 이 값으로 갈린다. 화면만 막으면 API 로는 아무 값이나 들어온다 |
| 2026-10-23 | `GET`·`PATCH /api/me` 응답에 `discordLinked` 추가 — 디스코드 ID 는 내리지 않는다 | 신청 버튼이 제출 403 전에 연동 창을 띄우려면 연동 여부가 필요하다 ([share DSC-02](../../docs/share/2026-10-18-discord-automation-gap.md)) |
| 2026-10-26 | `GET`·`PATCH /api/me` 응답에 `discordHandle` 추가, 연결 해제 `DELETE /api/me/discord/link` 구현 | 마이페이지가 연결된 계정 이름과 해제 버튼을 보여 준다 (아래 「디스코드 연결 화면 계약」) |


## 디스코드 연결 화면 계약 (2026-10-25)

Playground 시안 반영 범위. 아래 제안 필드와 해제 API는 현재 서버 계약과 구분.

| 대상 | 현재 beta | 후속 개발 |
|---|---|---|
| 연결 | `POST /api/me/discord/link` 구현완료 | 실제 OAuth 화면 및 연결 성공 후 내 정보 재조회 |
| 연결 여부 | `GET /api/me`의 `discordLinked` 구현완료 | 버튼 상태 연결 |
| 계정 이름 | `GET /api/me`의 nullable `discordHandle` 구현완료 | 화면 표시 연결 |
| 해제 | `DELETE /api/me/discord/link` 구현완료 — 참여 중이면 409 `DISCORD_UNLINK_BLOCKED` | 버튼·차단 문구 연결 |

- 본인의 마이페이지에 연결된 계정 이름과 연결 해제 표시. 미연결 시 연결하기 표시.
- 계정 이름은 `discordHandle` 사용. 스터디클럽 서버 별명 `discordNickname`과 구분. 숫자 Discord ID는 화면 표시 대상에서 제외.
- 연결 실패·인증 취소 시 미연결 유지, 오류 안내 및 재시도 제공.
- 참여 중인 스터디가 하나 이상이면 연결 해제 거절, 연결 상태·계정 이름 유지.
- 차단 문구: 「참여 중인 스터디가 있어 디스코드 연결을 해제할 수 없어요. 연결을 해제하려면 참여 중인 모든 스터디의 참여를 중단한 뒤 다시 시도해 주세요.」
- 후속 행동: 「참여 중단 방법은 해당 스터디 운영진에게 문의해 주세요.」와 「내 스터디 확인하기」 링크(내 스터디룸).
- Playground 판정은 내 스터디룸과 같은 `lifeStatus`: 시작 전 확정·참여 중 포함, 완주·참여 중단 제외. 조회 불가한 참여 기록은 해제 허용으로 간주하지 않음.
- 서버는 명부 행이 ACTIVE·PAUSED(휴식 포함)인 스터디가 하나라도 있으면 거절한다. 내 스터디룸이 「시작 전·참여 중」으로 보여 주는 행과 같은 기준이다.
- 실서비스는 서버에서 로그인 본인의 참여 상태를 최종 판정. 계정 행을 잠근 뒤 명부를 보므로 조회와 해제 사이 신규 참여(신청 제출)가 끼어들지 못한다.
- 회원 탈퇴는 별도 계정 삭제 계약 적용. 디스코드 단독 해제 제한을 탈퇴 차단으로 재사용하지 않음.
