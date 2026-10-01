# 프로필 수정 — 닉네임·시간대·마케팅 수신 동의를 마이페이지에서 고친다

마이페이지 내 정보 카드에서 **닉네임·시간대**를 고쳐 서버에 저장한다. 저장 API 는 `PATCH /api/me` 신규.
이메일은 보이기만 하고 바뀌지 않는다. 닉네임 규칙은 온보딩과 같다 — 형식도, 중복도. 다만 **지금 쓰고 있는 자기 닉네임은 중복으로 보지 않는다.**
**마케팅 수신 동의**도 마이페이지에서 바꾼다. 조회·변경 API 는 `GET`·`PUT /api/me/marketing-consent` 신규이고, 프로필 저장과 따로 간다.

## 지금 (beta 기준)

- core-front 마이페이지의 `ProfileDialog` 는 이름·거주 지역을 브라우저 localStorage(`sc_display_name`·`sc_region`)에만 저장한다. 서버로 가지 않고, 기기가 바뀌면 사라진다.
- 백엔드에 계정 수정 API 가 없다. ACCOUNT 의 닉네임·시간대는 `POST /accounts/onboarding` 때 한 번 정해지고 그 뒤 바꿀 길이 없다. `Account` 에 시간대 setter 도 없다.
- 닉네임 확인 `GET /api/nicknames/availability` 는 있다. 본인이 지금 쓰는 닉네임도 "사용 중" 으로 답한다 — 온보딩 스펙이 마이페이지 판정을 별도 계약으로 남겨 뒀다.
- 회원용 디스코드 연결 코드는 없다. ACCOUNT 에 `DISCORD_ID`·`DISCORD_HANDLE` 컬럼만 있고, `api/discord/` 는 전부 스터디 봇(출석·`STUDY_DISCORD_LINK`) 쪽이다.
- 마케팅 수신 동의는 온보딩 때 `ACCOUNT_CONSENT` 에 한 행 저장되고 끝이다. 현재 값을 읽는 API 도, 바꾸는 API 도 없다. 회원 데이터 정책은 변경 지면을 마이페이지로 적어 뒀다.

## 범위

이 스펙이 다루는 것:

- `PATCH /api/me` — 닉네임·시간대 저장
- 닉네임 확인 API 를 프로필 수정에서 쓰는 방식 (본인 제외)
- `GET`·`PUT /api/me/marketing-consent` — 마케팅 수신 동의 조회·변경
- core-front 내 정보 카드의 API 연결

다루지 않는 것:

- **디스코드 연결·해제** — 디스코드팀 이슈 "[기능] Discord 계정 연결" 이 개발 중이다. 카드의 연결 상태 표시·버튼은 그 API 가 나온 뒤 붙인다 — [한계 / 후속](#한계--후속).
- **회원 탈퇴** — 별도 스펙(`DELETE /api/me`, 영현). 카드 아래 탈퇴 링크는 그쪽 지면으로 보내기만 한다.
- **프로필 이미지** — 회원 데이터 정책이 받지 않기로 했다. 화면에서 사람을 가리키는 이름은 닉네임 하나다.

## 흐름

```
마이페이지 › 내 정보 카드 → 고치기 → 닉네임 · 시간대 편집

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
- **본인 제외.** 요청 닉네임을 trim 한 값이 현재 `ACCOUNT.NICKNAME` 과 대소문자 무시로 같으면 중복 검사를 건너뛴다. 자기 이름을 자기가 쓰고 있을 뿐이다. `Jin` → `jin` 처럼 표기만 바꾸는 것도 이 규칙으로 통과하고, 저장값은 새 표기다.
- **그 밖의 닉네임은 `existsByNicknameIgnoreCase` 로 본다.** 있으면 409. 검사와 flush 사이에 다른 계정이 먼저 가져간 경우는 `UNIQUE(NICKNAME)` 위반(`DataIntegrityViolationException`)을 받아 같은 409 로 — 온보딩과 같은 마지막 방어선.
- **비교 기준은 대소문자 무시까지.** 닉네임 정책은 "trim → NFC → 소문자" 로 비교한다고 돼 있는데 서버는 NFC 를 안 한다. 온보딩 스펙이 그렇게 결정했고 여기서 혼자 바꾸지 않는다 — [한계 / 후속](#한계--후속).
- **시간대 — 서버는 존재하는 IANA ID 를 전부 받고, 화면은 넷만 보여준다.**
  - 서버: 온보딩과 같은 `@ValidTimeZone`. `ZoneId.of()` 를 통과하면 통과다. `Asia/Tokyo` 도 `Europe/London` 도 저장된다.
  - 화면: 드롭다운에 한국 · 서울 / 북미 동부 · 뉴욕, 토론토 / 북미 서부 · 밴쿠버 / 북미 서부 · LA 넷을 둔다. 온보딩 화면과 같은 목록이다.
  - 왜 넷인가: 시간대 정책 문서는 밴쿠버와 LA 를 한 줄로 묶어 셋이다. 그런데 둘은 서머타임 적용이 달라 특정 기간에 1시간 차이가 날 수 있어서 온보딩 화면이 둘을 나눴다. 다시 합칠지는 기획팀이 논의 중이고, 결정이 나오면 온보딩과 같이 고친다.
  - 왜 서버는 안 막나: 온보딩 서버가 먼저 만들어졌고 그때는 목록을 제한하는 정책이 없었다. 지금 온보딩은 전부 받는다. 프로필 수정만 넷으로 막으면 온보딩으로 다른 값이 저장된 계정이 닉네임만 바꿔도 400 을 맞는다. 두 API 는 같은 검증기를 쓰므로 한쪽만 바꿀 수도 없다.
  - 그래서 이번 PR 은 온보딩과 같은 검증을 그대로 쓴다. **서버를 화면 목록으로 막는 건 후속 PR 이다** — 검증기 하나를 고치면 온보딩과 프로필이 같이 막힌다. [한계 / 후속](#한계--후속).
- **지역은 시간대에서 파생한다.** `Asia/Seoul` 이면 한국, 그 밖이면 북미. 서버는 `REGION_GROUP` 을 채우지 않는다(지금도 아무 코드가 안 채운다). 프론트가 신청 폼 시간대 기준으로 쓰는 region 값은 timeZone 에서 계산한다.
- **이메일은 요청에 없다.** DTO 에 필드가 없어 보내도 무시된다. 응답에는 실린다.
- **부분 갱신은 없다.** 두 필드 다 필수. 카드가 "한 번에 고치고 한 번에 저장" 이라 한 필드만 오는 경우가 없고, null 분기를 안 만든다. 값이 하나도 안 바뀌어도 200.
- **마케팅 수신 동의는 프로필 저장과 따로 간다.** `PATCH /api/me` 바디에 싣지 않고 `AccountView` 에도 싣지 않는다.
  - 저장 위치가 다르다. 닉네임·시간대는 ACCOUNT 한 행이고 동의는 `ACCOUNT_CONSENT` 다.
  - `AccountView` 에 실으면 로그인과 `GET /auth/me` 가 매번 동의 테이블을 읽는다. 값이 필요한 곳은 마이페이지 하나다.
  - 화면 수정본이 아직 없다. API 가 따로면 동의 항목이 카드 안에 들어가든 밖에 놓이든 그대로 쓴다.
- **보는 행은 현재 약관 버전의 `MARKETING` 행 하나.** 온보딩이 저장할 때 쓰는 `ConsentType.MARKETING.currentVersion()` 과 같은 버전이다. 행이 있으면 그 값, 없으면 미동의로 답한다.
- **변경은 그 행을 덮어쓴다.** `AGREED` 와 `AGREED_AT` 을 바꾼다. 행이 없으면 현재 버전으로 만든다. 행을 새로 쌓지 않는 이유 — `UNIQUE(ACCOUNT_ID, CONSENT_TYPE, CONSENT_VERSION)` 이 같은 버전 행을 하나만 허용한다. 알림팀이 `ACCOUNT_CONSENT` 를 읽는 방식도 안 바뀐다. 대신 바꾼 이력은 남지 않는다 — [미확정](#미확정-팀-결정) 1.
- **값이 지금과 같으면 아무것도 안 바꾼다.** 200 이고 `AGREED_AT` 도 그대로다. `AGREED_AT` 은 지금 값으로 정한 시각이어야 한다.
- **이용약관·개인정보 동의는 여기서 못 바꾼다.** 경로와 바디에 동의 종류를 받지 않는다.

## API 계약

### `PATCH /api/me` (신규)

로그인한 본인의 닉네임·시간대를 한 번에 저장한다. 마이페이지 내 정보 카드의 저장 버튼이 부른다. 누구를 고칠지는 토큰으로 정하고, 이메일은 안 받는다.

인증 필요 + 온보딩 완료 필요.

Request:

```jsonc
{
  "nickname": "honggildong",        // 필수. 온보딩과 같은 규칙
  "timeZone": "America/Vancouver"   // 필수. IANA ID
}
```

Response `200 OK` — `AccountView`. `GET /auth/me` 와 같은 모양이고 `nickname`·`timeZone` 에 새 값이 실린다. 프론트는 이 응답으로 세션 user 를 갱신하고 다시 조회하지 않는다.

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

### `GET /api/nicknames/availability` (변경 없음)

지금 계약 그대로 쓴다 — 인증 필요, 온보딩 미완료도 가능, 본인 현재 닉네임은 `available=false`.

본인 제외는 **프론트가 한다.** 입력값을 trim 하고 대소문자 무시로 현재 닉네임과 비교해 같으면 서버에 묻지 않는다. 서버에 "본인 제외" 옵션을 넣지 않는 이유 — 프론트는 현재 값을 이미 갖고 있고, 내 닉네임은 `UNIQUE` 라 남이 가져갈 수 없다. 그래서 화면 판정이 저장 시점 서버 판정과 어긋날 일이 없다. 저장은 어차피 서버가 다시 본다.

### 경로가 `/api/me` 인 이유

온보딩 스펙은 마이페이지 수정 API 를 "`/accounts/me` 형태 예상" 으로 적어 뒀다. 그 뒤 기획이 `PATCH /api/me`(프로필)·`DELETE /api/me`(탈퇴)로 잡았고, 참가자 허브·북마크가 이미 `/api/me/studies`·`/api/me/bookmarks` 를 쓴다. 마이페이지 = `/api/me` 로 모은다. `GET /auth/me` 는 그대로 둔다 — 조회 경로를 `/api/me` 로 옮기는 건 프로필 수정이 끝난 뒤다. [한계 / 후속](#한계--후속).

### 바뀌지 않는 것

`GET /auth/me`, `POST /accounts/onboarding`, `GET /api/nicknames/availability` 전부 그대로. `AccountView` 모양도 그대로다 — 마케팅 동의 값을 싣지 않는다. `SecurityConfig` 도 안 건드린다 — `anyRequest().authenticated()` 라 새 경로가 자동으로 인증 대상이다.

## 백엔드 구현 지점

- `Account` 에 닉네임·시간대를 한 번에 바꾸는 메서드 하나. setter 둘로 나누지 않는다 — 닉네임은 중복 검사를 거친 값만 들어와야 하는데 setter 를 열어두면 검사 없이 바꾸는 경로가 생긴다. 이미 있는 `setNickname` 은 사용처가 없고 이번에도 쓰지 않는다. 형식 검증은 `completeOnboarding` 과 같이 DTO 가 끝낸 값이 온다고 가정한다.
- `PATCH /api/me` 컨트롤러는 새 클래스. 기존 `AccountController` 는 `/accounts` 아래라 여기에 못 얹는다. 북마크·참가자 허브 컨트롤러가 같은 base path 를 쓰지만 메서드·하위 경로가 다르니 충돌 없다. `@RequireOnboarding` + `@Valid` — 온보딩과 달리 멱등 체크가 검증보다 먼저여야 할 이유가 없어서 400 은 `GlobalExceptionHandler` 에 맡긴다.
- 서비스는 `AccountOnboardingService` 와 같은 모양 — `@Transactional` 안에서 잠금 조회, 판정 규칙대로 본인 제외 → 중복 검사 → 저장. 응답은 `AccountView`.
- `NicknamePolicy`·`@ValidNickname`·`@ValidTimeZone`·확인 API 는 안 건드린다. 온보딩과 한 벌이라 여기서 바꾸면 두 화면이 갈린다.
- 마케팅 동의 조회·변경은 `PATCH /api/me` 와 같은 컨트롤러에 둔다. 둘 다 `@RequireOnboarding`, 변경은 `@Valid`.
- `AccountConsent` 에 동의 여부와 시각을 같이 바꾸는 메서드 하나. 지금은 생성자뿐이라 저장된 행을 바꿀 길이 없다. `AccountConsentRepository` 에는 계정·종류·버전으로 한 행을 찾는 조회를 더한다.
- 변경 서비스는 `@Transactional` 안에서 계정 행을 먼저 잠그고 동의 행을 찾는다. 잠금이 없으면 연달아 온 두 요청이 둘 다 "행 없음" 을 보고 만들다가 한쪽이 `UNIQUE` 에 걸린다.

## 프론트 (core-front)

- **화면은 프로토(playground `/proto/core/ko/my`)를 따른다** — 보기와 편집이 한 카드 안에서 바뀐다. 지금의 모달(`ProfileDialog`)을 카드로 바꾼다.
- **닉네임·시간대의 진본은 서버다.** `lib/me.ts` 의 브라우저 저장(displayName·region)을 없애고 세션 user 의 `nickname`·`timeZone` 에서 읽는다. 신청 폼의 region 은 timeZone 에서 파생한다.
- **저장은 `http('/api/me', PATCH)` 직접 호출.** 중계 라우트 없음(`lib/http.ts` 관례). 성공 응답으로 `setUser` 갱신.
- **닉네임 상태 줄은 온보딩 화면과 같은 검사·같은 문구.** 형식은 화면에서, 중복은 디바운스 후 확인 API. 현재 값과 같으면(trim·대소문자 무시) 안 묻는다. 시간대 셀렉트는 온보딩과 같은 넷 — 온보딩 화면의 선택 컴포넌트를 같이 쓴다. 목록이 한 곳에만 있어야 밴쿠버·LA 를 합치는 결정이 나와도 한 번에 바뀐다.
- **오류** — 400 은 해당 필드 줄, 409 는 닉네임 줄, 401 은 재로그인, 403 `ONBOARDING_REQUIRED` 는 온보딩으로. 입력은 지우지 않는다.
- **디스코드 줄은 「연결 안 됨」 표시만.** 연결·해제는 디스코드팀 API 가 나온 뒤.
- **마케팅 수신 동의는 켜고 끄는 한 줄.** 화면에 들어올 때 조회하고, 바꾸면 바로 `PUT` 한다. 실패하면 이전 값으로 되돌리고 사유를 보여준다. 기획팀이 프로토에 이 항목을 넣는 중이라 위치·문구는 수정본이 나오면 맞춘다. 그때까지 문구는 온보딩 동의 화면의 마케팅 항목을 따른다.

## 미확정 (팀 결정)

1. **마케팅 수신 동의를 바꾼 이력을 남기나.** 지금 스펙은 현재 버전 행을 덮어써서 마지막 값과 그 시각만 남는다. 언제 동의했다가 언제 껐는지까지 남기려면 `ACCOUNT_CONSENT` 의 `UNIQUE` 를 풀고 행을 쌓아야 한다. 마이그레이션과 ERD 변경이 따라오고, 알림팀도 "가장 최근 행" 을 읽도록 바꿔야 한다.

## 한계 / 후속

- **조회 경로를 `/api/me` 로 옮기기** — 프로필 수정이 끝난 뒤 진행한다. 스터디 상세 이슈와 모바일 이슈가 `GET /api/me` 를 기다린다. 이번엔 `GET /auth/me` 를 그대로 쓴다.
- **마케팅 수신 동의 화면** — 프로토 수정본이 나오면 위치·문구를 맞춘다. API 는 그대로다.
- **약관 버전이 오를 때** — 지금 `MARKETING` 버전은 1.0 하나다. 개정 때 이전 버전 동의를 새 버전으로 넘길지는 그때 정한다.
- **디스코드 연결·해제** — 디스코드팀. 카드에 연결 상태를 그리려면 `AccountView` 에 `discordHandle` 같은 필드가 필요한데, 그 API 의 응답 모양과 같이 정한다. 이 스펙은 「연결 안 됨」 고정 표시까지.
- **NFC 정규화** — 정책은 NFC 비교인데 서버는 대소문자 무시까지다. 도입하려면 확인 API·최종 검사·기존 데이터를 한 번에 봐야 한다. 온보딩 스펙과 같은 유보.
- **서버 시간대 검증을 화면 목록으로 막는 후속 PR.** 지금은 서버가 존재하는 IANA ID 를 전부 받고 화면만 넷을 보여준다. 시간대 정책은 정해진 목록만 허용이므로 서버도 맞춰야 한다. `@ValidTimeZone` 검증기 하나를 "목록 중 하나인가" 로 바꾸면 온보딩과 프로필 수정이 같이 막힌다. 온보딩 스펙의 시간대 줄과 테스트도 그때 같이 고친다. 이 PR 에서 안 하는 이유는 온보딩 코드까지 건드리는 일이라 범위를 나눈 것이다. 밴쿠버·LA 를 합칠지 기획 결정이 나온 뒤에 한다 — 목록이 정해져야 막을 수 있다.


## 변경이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-09-29 | 최초 작성 — `PATCH /api/me` 닉네임·시간대, 본인 제외 중복 판정, 디스코드·탈퇴·마케팅 동의는 범위 밖 | 마이페이지 값이 브라우저에만 남아 기기가 바뀌면 사라진다. 닉네임·시간대 규칙은 온보딩과 한 벌이어야 두 화면이 같은 말을 한다 |
| 2026-10-01 | 리뷰 반영 — 시간대 선택지 셋 → 넷(밴쿠버·LA 분리), 마케팅 수신 동의 조회·변경 `GET`·`PUT /api/me/marketing-consent` 추가, 조회 경로 `/api/me` 이전은 후속으로. 온보딩 프론트가 머지돼 `name` → `nickname` 표기를 맞추고 프론트 PR 순서 항목을 뺐다 | 시간대 목록은 온보딩 화면과 같아야 한다. 마케팅 동의는 회원 데이터 정책이 마이페이지에서 바꾼다고 정했다 |
