# 백오피스 로그인 — ADMIN 만 들어온다

백오피스(`back-office-front`) 로그인은 **`ACCOUNT.SYSTEM_ROLE = ADMIN` 인 계정만** 통과한다. 이메일 allowlist(env `BACK_OFFICE_ALLOWED_EMAILS`)는 버린다.
계정이 없거나 MEMBER 면 거절한다.

## 지금 (beta 기준)

- `POST /auth/social-login` 에 `platform=BACK_OFFICE` 가 오면 `AuthService.assertBackOfficePermitted` 가 env allowlist 로 이메일을 본다. 통과하면 core-front 와 똑같이 `findOrRegister` — 없던 사람은 **MEMBER 로 자동 생성**된다.

## 흐름 (변경 후)

```
백오피스 /login → 구글 팝업 → 백오피스 /api/auth/social/login (platform=BACK_OFFICE 서버측 강제)
  → Spring POST /auth/social-login
      구글 code 교환 → sub · email · email_verified          (core-front 와 동일)
      email 없음 / 미검증 → 400 SOCIAL_LOGIN_EMAIL_REQUIRED    (core-front 와 동일)
      platform=BACK_OFFICE
        ├─ ACCOUNT_IDENTITY(GOOGLE, sub) 없음         → 403 SIGNUP_REQUIRED. 아무것도 만들지 않는다
        ├─ 있음, ACCOUNT.SYSTEM_ROLE ≠ ADMIN          → 403 FORBIDDEN. 승격하지 않는다
        └─ 있음, ACCOUNT.SYSTEM_ROLE = ADMIN          → LAST_LOGIN_AT 갱신 → JWT 발급 (core-front 와 동일)
      platform=CORE → 기존 그대로 (findOrRegister, 자동 가입)
```

## 판정 규칙

- 사람 찾기는 `(ISSUER, sub)`. 온보딩 스펙과 같다. 이메일로 찾지 않는다.
- 같은 이메일 계정은 있는데 sub 가 다른 경우, core-front 는 `409 ACCOUNT_LINK_REQUIRED` 다. 백오피스는 identity 가 없으면 전부 `SIGNUP_REQUIRED` 로 본다.
- 거절은 두 코드로 가른다. **계정 없음 → `403 SIGNUP_REQUIRED`(신규)**, **MEMBER → `403 FORBIDDEN`(기존)**. 부트스트랩이 "core-front 로그인 → 승격" 순서라, 계정 없는 사람에게 "먼저 서비스에서 로그인하라" 고 알려줘야 캡틴에게 헛요청이 안 간다. 계정 존재 여부가 새어 나갈 걱정은 없다 — 구글 인증을 통과해야 여기 오므로 자기 계정만 확인할 수 있다.
- 온보딩 완료 여부는 안 본다. ADMIN 은 core-front 에서 온보딩을 안 마쳤을 수 있고, 백오피스에는 온보딩 화면이 없다.
- ADMIN 판정은 **로그인 시점에 DB 를 읽는다.** 이번 PR 은 JWT 형식을 안 바꾼다. 로그인 뒤 요청의 ADMIN 판별은 후속 PR 에서 **요청마다 DB 조회**로 붙인다 — [한계 / 후속](#한계--후속).
- allowlist 는 제거한다. `AuthService` 의 `@Value`·`allowedEmailsRaw`, `application.yml` 의 `back-office.allowed-emails`, `.env.example`, 테스트 `application.yml` 전부.

## ADMIN 은 어떻게 생기나 (부트스트랩)

코드에 승격 경로가 없다. PRD `04b` 도 "최초 캡틴 부트스트랩 — 미정" 이다. 이 문서의 제안:

1. 운영자가 될 사람이 **core-front 로 먼저 로그인**한다 → ACCOUNT + ACCOUNT_IDENTITY 가 생긴다(MEMBER).
2. 운영 DB 접근 권한이 있는 사람(리더·인프라)이 직접 바꾼다. 운영 DB 접속 정보는 k8s 시크릿에만 있고 기여자는 못 만진다.
   ```sql
   UPDATE ACCOUNT SET SYSTEM_ROLE = 'ADMIN' WHERE EMAIL = '...';
   ```
   요청은 스쿼드 채널에 "이메일 + 사유" 로 남긴다.
3. 이후 백오피스 로그인.

**배포 순서가 중요하다.** allowlist 제거가 배포되기 **전에** 현재 allowlist 이메일들을 ADMIN 으로 바꿔 둔다. 안 그러면 배포 직후 아무도 못 들어온다.

SQL 은 첫 ADMIN 까지다. 그 뒤로는 ADMIN 이 백오피스 화면에서 다른 ADMIN 을 추가한다 — [2단계](#2단계--역할-부여-별도-pr).

## 2단계 — 역할 부여 (별도 PR)

이 스펙(1단계)은 로그인 게이트만 바꾼다. 게이트를 role 로 옮기면 "ADMIN 을 만드는 수단" 이 SQL 뿐이라, 화면에서 역할을 바꾸는 기능이 뒤따라야 한다.

- BE `PATCH /accounts/{id}/role` — 호출자 ADMIN 만. `MEMBER ↔ ADMIN`. 자기 자신 변경 금지. 마지막 남은 1명의 ADMIN 은 강등될 수 없음 (PRD `04b` "전원이 잠길 수 있다").
- 백오피스 `/users` — 역할 배지 클릭 → 변경. 화면 형태는 playground 프로토(`/proto/console/users`, 역할 드롭다운)를 따른다.
- 첫 ADMIN 은 그래도 SQL 이다. 이 기능은 두 번째 ADMIN 부터 쓴다.
- 기획 쪽 스토리 PRD "캡틴은 유저에게 서로 다른 역할과 권한을 줄 수 있다" 에 같은 기능이 이미 있다. 거기서는 역할이 캡틴·네비게이터·크루 3개고, API 를 `PATCH /api/users/{id}/role` 로 잡아 뒀다.
- 네비게이터는 SYSTEM_ROLE 값이 아니다. 스터디별 반장이라 `STUDY_PARTICIPANT.PARTICIPANT_ROLE` 이 `LEADER`·`CO_LEADER` 인 사람이다. 자주 바뀌는 자리라 enum 에 값을 넣지 않는다. 이 API 는 MEMBER·ADMIN 만 받는다.
- 그 스토리 PRD 에 담당자가 지정돼 있다. 우리가 먼저 API 를 만들면 그 사람 일과 겹칠 수 있으니 시작 전에 확인한다.

## API 계약

### `POST /auth/social-login` (변경)

Request 그대로. `platform` = `CORE` | `BACK_OFFICE`.
Response 200 그대로. `account.role` 은 이미 실려 있다(`AuthDtos.AccountView.role`).

| 상태 | errorCode | 조건 |
|---|---|---|
| 400 | INVALID_INPUT | code 없음 (기존) |
| 400 | SOCIAL_LOGIN_EMAIL_REQUIRED | 이메일 없음 / 미검증 (기존) |
| 403 | SIGNUP_REQUIRED | **BACK_OFFICE 만. 신규.** identity 없음. 생성·갱신·발급 아무것도 안 함 |
| 403 | FORBIDDEN | **BACK_OFFICE 만.** identity 는 있는데 SYSTEM_ROLE ≠ ADMIN. 갱신·발급 안 함 |
| 409 | ACCOUNT_LINK_REQUIRED | **CORE 만** (기존). BACK_OFFICE 에서는 안 나간다 — identity 없음은 곧 SIGNUP_REQUIRED |
| 503 | EXTERNAL_SERVICE_ERROR | 구글 교환 실패 (기존) |

메시지:
- `SIGNUP_REQUIRED` — `먼저 서비스에서 로그인해 계정을 만들어 주세요.`
- `FORBIDDEN` — `백오피스 운영 권한이 없는 계정입니다.`

`ErrorCode` 에 `SIGNUP_REQUIRED(403)` 추가. 이름은 기존 `ONBOARDING_REQUIRED`·`ACCOUNT_LINK_REQUIRED` 처럼 "뭘 해야 하는지" 로 짓는다. 온보딩 스펙대로 첫 로그인이 곧 가입이라 SIGNUP 이다.

### 바뀌지 않는 것

`GET /auth/me`, `POST /auth/refresh` 그대로. 백오피스는 refresh 를 안 쓴다(쿠키에 access 만 심는다).

## 백엔드 구현 지점

- `AuthService.socialLogin` — `assertBackOfficePermitted` + `findOrRegister` 자리에서 platform 으로 갈린다. BACK_OFFICE 는 **조회 전용** 경로, `AccountRegistrar.findOrRegister` 의 분기 3(신규 생성)을 타지 않는다.
- 조회 전용 메서드를 `AccountRegistrar` 에 둘지 `AuthService` 가 `accountIdentityRepository` 를 직접 볼지는 구현 때 정한다. `LAST_LOGIN_AT` 갱신(`recordLogin`)은 `@Transactional` 안이어야 dirty checking 으로 반영된다 — 분기 1 과 같은 함정.
- `JwtAuthFilter`·`SecurityConfig` 는 안 건드린다. #78 과 충돌하고 이번 범위 밖.

## 프론트 (back-office-front)

화면 신설 없음. API 연결만 진행

- `src/app/api/auth/social/login/route.ts` — 백엔드 403 은 지금처럼 그대로 넘긴다. 추가로 **`data.account.role !== 'ADMIN'` 이면 쿠키를 심지 않고 403** 을 돌려준다. 이때도 응답은 `errorCode: FORBIDDEN` + 같은 메시지로 맞춰서, 로그인 화면이 백엔드 403 과 구분 없이 처리한다. 백엔드가 뚫려도 프론트가 한 번 더 막는다(PRD `04b` "두 겹으로 막는다"). 파일 상단 allowlist 주석 갱신.
- `src/app/login/page.tsx` — `errorCode` 로 가른다. `FORBIDDEN` 이면 PRD BO-05 문구 「운영 권한이 없어요. 캡틴에게 요청하세요.」, `SIGNUP_REQUIRED` 면 「먼저 스터디클럽 사이트에서 로그인해 주세요.」. 나머지 에러는 지금처럼 `errorMessage`.

## 테스트

`SocialLoginIntegrationTest` 에 추가. ADMIN 은 `new Account(..., SystemRole.ADMIN)` + `AccountIdentity` 를 직접 저장해서 심는다.

- BACK_OFFICE + 처음 보는 sub → 403 SIGNUP_REQUIRED. ACCOUNT·ACCOUNT_IDENTITY 행 수 그대로.
- BACK_OFFICE + MEMBER 계정 → 403 FORBIDDEN. SYSTEM_ROLE 그대로 MEMBER, LAST_LOGIN_AT 안 바뀜.
- BACK_OFFICE + ADMIN 계정 → 200. 토큰 발급, LAST_LOGIN_AT 갱신, `account.role = ADMIN`.
- BACK_OFFICE + ADMIN 인데 온보딩 미완료 → 200 (온보딩을 안 본다).
- CORE 기존 5건 그대로 통과 — allowlist 제거가 core-front 에 영향 없음.
- 테스트 `application.yml` 의 `back-office.allowed-emails` 제거.

## 문서·설정 정리 (같은 PR)

- `specs/auth-google-login/spec.md` — WHAT 의 "allowlist 통과자만", HOW 플로우의 `assertBackOfficePermitted(email)`, 표의 "allowlist SoT" 행, 한계의 "롤가드는 후속" → 이 문서로 교체. 변경이력 한 줄.
- `docs/erd/ACCOUNT.md` — 미확정 "allowlist → SYSTEM_ROLE=ADMIN" 항목을 결정으로.
- `.env.example` — `BACK_OFFICE_ALLOWED_EMAILS` 줄 삭제. README 등에 언급 있으면 같이.
- 운영 env 의 `BACK_OFFICE_ALLOWED_EMAILS` 는 리더가 정리(배포 후 무해하지만 남겨 두면 헷갈린다).
- 백엔드 가이드 에러코드 표에 `SIGNUP_REQUIRED` 추가(온보딩 스펙이 세 코드를 추가할 때와 같은 자리).
- `docs/backend-development-guide/auth-guide.md` 의 role claim 설명은 코드와 다르다. 이번 PR 에서 안 고친다 — 별도.

## 리뷰에서 결정 (2026-09-15)

- **백오피스 로그인에서 계정을 만들지 않는다.** 만들어도 MEMBER 라 어차피 못 들어오고, 공개 URL 에서 로그인 버튼만 눌러도 온보딩 미완료 MEMBER 행이 쌓인다. 부트스트랩의 "core-front 에서 먼저 로그인" 단계와 `SIGNUP_REQUIRED` 코드는 그대로 간다. (j00hyun · rowing0328)
- **네비게이터(반장)는 SYSTEM_ROLE 로 안 푼다.** 스터디별 반장이라 `STUDY_PARTICIPANT.PARTICIPANT_ROLE` 이 `LEADER`·`CO_LEADER` 인 사람이다. **이 PR 은 ADMIN(=캡틴)만 본다.** 기획이 네비게이터 백오피스 접근을 확정하면 별도 PR 에서 게이트를 `SYSTEM_ROLE = ADMIN OR PARTICIPANT_ROLE IN (LEADER, CO_LEADER)` 로 넓힌다. (j00hyun)
- **로그인 이후 요청의 ADMIN 판별은 요청마다 DB 조회.** 아래 [한계 / 후속](#한계--후속). (j00hyun)

## 미확정 (팀 결정)

1. **최초 ADMIN 부트스트랩 — 누구를 ADMIN 으로 올리나.** 방식은 SQL 로 간다(rowing0328). 다만 누가 캡틴인지, 첫 ADMIN 을 누구로 잡을지는 j00hyun 이 주영님께 확인 뒤 알려주기로 함. **이 답을 기다리지 않고 구현은 시작한다.** 배포 전에만 정해지면 된다 — [부트스트랩](#admin-은-어떻게-생기나-부트스트랩)의 배포 순서 참고.

## 한계 / 후속

- **로그인 이후 요청은 아직 role 을 안 본다.** core-front 로 받은 MEMBER 토큰으로 `GET /accounts` 를 부르면 전체 회원 이메일이 나온다. allowlist 시절부터 있던 구멍이라 이번 작업으로 나빠지진 않지만 없어지지도 않는다. 후속 PR 에서 백오피스 API 에 ADMIN 가드를 붙인다(**#78 머지 후**). 그때까지는 프론트의 두 번째 방어(`role !== 'ADMIN'` 이면 쿠키 안 심기)만 있다.
  - **방식은 요청마다 DB 조회로 확정** — `@RequireAdmin` + 인터셉터. 온보딩 가드(`RequireOnboarding`)와 같은 모양이라 통일된다. ACCOUNT PK 1건이라 운영자 몇 명 규모에선 비용이 없다. 강등 즉시 반영. 토큰 형식 불변이라 core-front 회귀 없음.
  - JWT 에 role claim 을 넣는 안은 안 간다. 강등이 토큰 만료까지 안 먹고, 지금 access 가 7일·백오피스에 refresh 가 없어서 만료 단축 + refresh 라우트 + `JwtService`·`JwtAuthFilter`·프론트를 한 세트로 건드려야 한다.

## 변경이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-09-14 | 최초 작성 — allowlist → SYSTEM_ROLE=ADMIN 전환, 자동 가입·승격 없음, 역할 부여는 2단계 별도 PR | 커뮤니티 스쿼드 회의 4 배정 + 리더 확답(ADMIN 전원), PRD 01 인증 BO-05 / 04b IAM, ERD ACCOUNT.md 미확정 |
| 2026-09-16 | 리뷰 반영 — 계정 미생성 확정, 네비게이터는 PARTICIPANT_ROLE 로(enum 추가 안 함), 후속 ADMIN 가드는 DB 조회로 확정, 프론트 2차 차단도 FORBIDDEN 으로, 부트스트랩은 SQL·대상자 확인 보류 | PR #80 리뷰(j00hyun 4건, rowing0328 1건) |
