# 백오피스 회원 API Spec — 회원 목록 · 이메일 보기 · 계정 권한 변경

> ERD: [ACCOUNT](../../docs/erd/ACCOUNT.md), [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md), [STUDY](../../docs/erd/STUDY.md), [ADMIN_AUDIT_LOG](../../docs/erd/ADMIN_AUDIT_LOG.md) (신규)
> 생성일: 2026-10-01
> 갱신: 2026-10-04 — PR #163 리뷰 반영. 인가는 `@RequireAdmin`, 이메일은 마스킹 + 「보기」 + 감사 로그, 권한 변경 화면은 응답 뒤 반영, 미확정 정리 ([결정 기록](#결정-기록))
> 갱신: 2026-10-05 — 권한 변경 성공 시 디스코드 설정 안내 추가. 디스코드 역할은 자동으로 바꾸지 않는다
> 갱신: 2026-10-07 — POL-0001 변경(#199 등) 반영. 권한표 스터디 단위에 「회차 관리」 행, 담당 캡틴 명부 행도 「참여 중」으로 센다 (기획 확인 대기 — [미확정](#미확정))
> 상태: 스펙작성중 — 남은 미확정 1건 (감사 로그 보관 기간)
>
> Story PRD:
> - [캡틴으로서, 전체 회원 리스트를 조회할 수 있다](../../planning/stories/captain-list-users/PRD.md)
> - [캡틴으로서, 유저에게 서로 다른 역할과 권한을 줄 수 있다](../../planning/stories/captain-grant-roles/PRD.md)
>
> 정책: [POL-0001 역할과 권한](../../01-planning/_registry/policies/POL-0001-roles.md) — 계정 권한(캡틴·크루)과 스터디 역할(네비게이터)은 다른 층이다
> 관련: [authz-guards/spec.md](../authz-guards/spec.md) — 인가는 이 스펙을 따른다. [back-office-login/spec.md](../back-office-login/spec.md) — 「2단계 — 역할 부여」를 이 스펙이 받는다. [user-leave/spec.md](../user-leave/spec.md) — 탈퇴 계정은 물리 삭제라 목록에 나오지 않는다
> 기준 프로토타입: playground 운영 콘솔 › 유저 (`frontend/apps/playground/src/proto/console/components/UsersTable.tsx`, `lib/roles.ts`). 이메일 「보기」는 playground 반영 전이다 — 화면 모양은 반영되면 그것을 따른다

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/accounts | 회원 목록 — 필터·검색·페이지, 걸러진 뒤 총 인원. 이메일은 가려서 준다 | O (`@RequireAdmin`) | 스펙작성중 |
| POST | /api/admin/accounts/{accountId}/email-reveals | 한 명의 이메일 원본 보기 — 감사 로그를 남긴다 | O (`@RequireAdmin`) | 스펙작성중 |
| PATCH | /api/admin/accounts/{accountId}/role | 계정 권한 변경 (ADMIN ↔ MEMBER) — 감사 로그를 남긴다 | O (`@RequireAdmin`) | 스펙작성중 |
| GET | /api/admin/role-permissions | 역할별 기본 권한표 | O (`@RequireAdmin`) | 스펙작성중 |
| ~~GET~~ | ~~/accounts~~ | 옛 유저 목록 — **구현 PR 에서 삭제** ([아래](#옛-get-accounts-를-없앤다)) | O (`@RequireAdmin`, #178) | 변경예정 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 먼저 읽을 것 — 용어와 저장 값

화면은 POL-0001 의 이름(캡틴·네비게이터·크루)을 쓰고, API 는 **DB enum 값 그대로** 주고받는다. 화면 이름으로 바꾸는 일은 프론트의 라벨 맵 한 곳에서 한다.

| 화면 | 층 | API·DB 값 | 누가 바꾸나 |
|---|---|---|---|
| 캡틴 | 계정 권한 | `ACCOUNT.SYSTEM_ROLE = ADMIN` | 캡틴이 이 화면에서 (`PATCH …/role`) |
| 크루 | 계정 권한 | `ACCOUNT.SYSTEM_ROLE = MEMBER` | 〃 |
| 네비게이터 | 스터디 역할 | `STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER` | 그 스터디의 크루 명단에서 — **이 스펙 범위 밖** |

- **네비게이터는 계정 값이 아니다.** 한 사람이 여러 스터디를 맡을 수 있고 맡은 스터디마다 명부 행이 따로 선다. 그래서 `PATCH …/role` 은 `ADMIN`·`MEMBER` 둘만 받는다.
- 「담당 스터디가 있다」 = 명부 행 중 `PARTICIPANT_ROLE ∈ {LEADER, CO_LEADER}` 이고 `STATUS ∈ {ACTIVE, PAUSED}` 인 것이 하나라도 있다. `CO_LEADER` 는 POL-0001 이 없애기로 했지만 enum·데이터가 남아 있어 [`StudyCaptainGuard`](../../backend/api/src/main/java/com/studyclub/api/study/StudyCaptainGuard.java) 처럼 함께 본다 — 정리되면 여기서도 빠진다.
- 「참여 중인 스터디」 = 명부 행 중 `STATUS ∈ {ACTIVE, PAUSED}` 인 것의 `STUDY_ID` 개수(중복 제거). 하차(`WITHDRAWN`)·완주(`COMPLETED`)는 지난 일이라 세지 않는다.
  - `PARTICIPANT_ROLE` 은 가리지 않는다. POL-0001 대로 **담당 캡틴이 스터디를 만들 때 명부에 들어가면**(백엔드 미구현) 그 행도 센다 — 스터디를 맡아 운영 중인 캡틴을 「휴면」으로 적지 않는다. 담당 캡틴 행은 `LEADER` 가 아니므로 「담당 스터디(네비게이터)」에는 잡히지 않는다.

### 인가 — authz-guards 를 따른다

[authz-guards](../authz-guards/spec.md) 대로 **권한은 어노테이션으로만 건다.** 새 컨트롤러 `AdminAccountController` 클래스에 `@RequireAdmin` 을 붙이고, 서비스 안에서 `assertCaptain` 같은 권한 검사를 다시 하지 않는다. 판정은 `AdminGuardInterceptor` 가 요청마다 DB 로 `SYSTEM_ROLE = ADMIN` 을 본다.

- `PATCH …/role` 은 authz-guards 표 A 의 「역할 변경」 행(구현 시 `@RequireAdmin`)이 가리키는 엔드포인트다.
- `PATCH` 안에서 `ADMIN` 행을 잠그는 것은 권한 검사가 아니라 **캡틴 수 판정의 동시성 장치**다 ([처리 규칙](#처리-규칙)).

### 기획 문서(Notion)와 달라진 곳

Notion 스토리 본문의 시스템 요건을 이 레포의 규약·스키마에 맞춰 옮겼다. 마지막 행만 리뷰에서 새로 정해진 것이고, 나머지는 동작이 같고 이름·모양만 다르다.

| Notion 기획 | 이 스펙 | 이유 |
|---|---|---|
| `GET /api/users?page=&size=&role=&q=` | `GET /api/admin/accounts?offset=&limit=&systemRole=&navigator=&q=` | 백오피스 API 는 `/api/admin` 아래 ([endpoint-convention](../../docs/backend-development-guide/api/endpoint-convention.md)). 리소스 이름은 테이블·엔티티(`ACCOUNT`)를 따른다. 페이지 계약은 프로젝트 공통 `items/total/offset/limit` |
| 필터 `role` 하나에 전체·캡틴·네비게이터·크루 | `systemRole` + `navigator` 두 파라미터 | 계정 권한과 스터디 역할은 다른 층(POL-0001). 한 파라미터에 섞으면 `NAVIGATOR` 가 계정 권한 값처럼 보인다 |
| `role: captain \| crew` | `systemRole: ADMIN \| MEMBER` | DB enum 그대로 (`/auth/me` 의 `role` 과 같은 값) |
| `navigatorOf: string[]` (스터디 id) | `navigatorOf: [{ studyId, title }]` | 화면이 **이름**을 적는다. id 만 주면 프론트가 스터디를 또 조회해야 한다 |
| `enrollment.navigator` 신규 필드 | 기존 `STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER` | 이미 있는 컬럼이다 |
| `name` (null 이면 이메일 로컬파트) | `name` = `ACCOUNT.NICKNAME`, 온보딩 전이면 null. 화면은 **마스킹된** 로컬파트를 적는다 | 온보딩 전 닉네임은 `account_<랜덤>` 임시값이라 사람 이름이 아니다. 원본 로컬파트를 쓰면 마스킹이 무너진다 |
| `studyCount` | 응답에 없음. `dormant` 만 준다 | 정렬이 서버라 프론트가 개수를 쓸 곳이 없다. 휴면 판정도 서버 한 곳에서 |
| `PATCH /api/users/{id}/role` | `PATCH /api/admin/accounts/{accountId}/role` | 위와 같은 경로 규약 |
| 사유 코드 | `SELF_ROLE_CHANGE` · `LAST_ADMIN` (409) | [Error Responses](#error-responses-2) |
| 이메일 전체 표시 (미확정 4) | 목록은 마스킹, 「보기」로 한 명씩 원본, 감사 로그 기록 | 리뷰에서 운영진과 정함 ([결정 기록](#결정-기록)). 기획 문서에는 아직 없다 |

---

## 회원 목록 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/accounts`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: 가입한 회원을 필터·검색·페이지로 조회한다. 이메일은 가려서 준다. 응답의 `total` 은 **걸러진 뒤 전체 수**다 (지금 페이지의 행 수가 아니다)

### Path Parameters

없음

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| systemRole | String | N | — | `ADMIN` \| `MEMBER`. 계정 권한으로 거른다 |
| navigator | Boolean | N | — | `true` = 담당 스터디가 있는 사람만, `false` = 없는 사람만, 생략 = 조건 없음 |
| q | String | N | — | **이름 부분 일치 또는 이메일 전체 일치**, 둘 다 대소문자 무시. 앞뒤 공백을 자르고 빈 문자열이면 조건 없음. 최대 100자 |
| offset | Integer | N | 0 | 0 이상 |
| limit | Integer | N | 20 | 1 ~ 100. 화면은 20 고정 |

- 모든 조건은 **AND** 로 걸린다. `q` 안의 이름·이메일 두 조건은 OR 다.
- 이름은 응답의 `name` 과 같은 값(온보딩 완료자의 닉네임)에 건다. 온보딩 전 임시 닉네임(`account_…`)으로는 찾히지 않는다.
- **이메일은 전체가 같을 때만 찾힌다.** 부분 일치를 두면 「보기」를 누르지 않고 검색만 반복해서 가려진 이메일을 알아낼 수 있다 — 감사 로그를 비켜 가는 길이 된다. 이미 아는 이메일로만 찾으므로 검색으로 새로 새는 정보가 없다.
- `q` 의 `%`·`_` 는 와일드카드가 아니라 글자로 취급한다 (LIKE 이스케이프).

**화면 탭 → 파라미터**

| 탭 | 보내는 값 | 결과에 포함되는 사람 |
|---|---|---|
| 전체 | (없음) | 모두 |
| 캡틴 | `systemRole=ADMIN` | 캡틴 계정 |
| 네비게이터 | `navigator=true` | 담당 스터디가 있는 사람 — 캡틴이 맡았으면 캡틴도 |
| 크루 | `systemRole=MEMBER` | 크루 계정 — 네비게이터도 계정은 크루라 함께 나온다 |

네 탭이 서로 배타적이지 않다. 프로토타입과 같은 동작이다.

### 정렬

서버가 정렬한다. 페이지가 서버에 있으므로 화면에서 정렬하면 한 페이지 안에서만 섞인다.

1. `systemRole = ADMIN` 먼저
2. 담당 스터디가 있는 사람
3. 참여 중인 스터디 수가 많은 순
4. 가입일 최신순 (`ACCOUNT.CREATED_AT DESC`)
5. `ACCOUNT.ID DESC` — 같은 값끼리 페이지를 넘길 때 순서가 흔들리지 않게

### Request Body

없음

### Response — 200

```json
{
  "items": [
    {
      "id": 3,
      "name": "가온",
      "maskedEmail": "g***@example.com",
      "systemRole": "ADMIN",
      "navigatorOf": [],
      "dormant": true,
      "joinedAt": "2026-08-12T03:41:09Z",
      "roleChangeBlockedReason": "SELF"
    },
    {
      "id": 18,
      "name": "하늘",
      "maskedEmail": "h***@example.com",
      "systemRole": "MEMBER",
      "navigatorOf": [
        { "studyId": 21, "title": "AI 논문 리딩" },
        { "studyId": 9, "title": "알고리즘 스터디" }
      ],
      "dormant": false,
      "joinedAt": "2026-09-01T11:00:00Z",
      "roleChangeBlockedReason": null
    },
    {
      "id": 27,
      "name": null,
      "maskedEmail": "n***@example.com",
      "systemRole": "MEMBER",
      "navigatorOf": [],
      "dormant": true,
      "joinedAt": "2026-09-30T08:15:42Z",
      "roleChangeBlockedReason": null
    }
  ],
  "total": 134,
  "offset": 0,
  "limit": 20
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items | Array | N | 이 페이지의 회원. 결과가 없거나 `offset` 이 범위 밖이면 `[]` | |
| items[].id | Long | N | 계정 ID. `…/{accountId}/email-reveals`·`…/{accountId}/role` 의 경로 값 | ACCOUNT.ID |
| items[].name | String | Y | 표시 이름. **온보딩 전이면 null** — 화면은 `maskedEmail` 의 로컬파트(`n***`)를 적는다 | ACCOUNT.NICKNAME (계산: `ONBOARDING_COMPLETED_AT IS NULL` 이면 null) |
| items[].maskedEmail | String | N | 가린 이메일. 앞 1자 + `***` + `@` 이후 (`h***@gmail.com`). 원본은 [이메일 보기](#이메일-보기)로만 | 계산: ACCOUNT.EMAIL 마스킹 ([security-guide](../../docs/backend-development-guide/security-guide.md#마스킹-기준)) |
| items[].systemRole | String | N | `ADMIN` \| `MEMBER` | ACCOUNT.SYSTEM_ROLE |
| items[].navigatorOf | Array | N | 담당 스터디. 없으면 `[]`. 편입 최신순 — 화면은 첫 개만 적고 나머지는 개수로 접는다 | 계산: STUDY_PARTICIPANT (`PARTICIPANT_ROLE ∈ {LEADER, CO_LEADER}`, `STATUS ∈ {ACTIVE, PAUSED}`), `JOINED_AT DESC` |
| items[].navigatorOf[].studyId | Long | N | | STUDY.ID |
| items[].navigatorOf[].title | String | N | | STUDY.TITLE |
| items[].dormant | Boolean | N | 「휴면」 표기. 계정 상태가 아니라 참여 이력으로 판정한다 | 계산: 참여 중인 스터디 수 = 0 |
| items[].joinedAt | String | N | 가입일. UTC ISO 8601 | ACCOUNT.CREATED_AT |
| items[].roleChangeBlockedReason | String | Y | 이 행의 권한을 지금 바꿀 수 없는 이유. 바꿀 수 있으면 null. 아래 표 | 계산: 요청자 ID · `SYSTEM_ROLE = ADMIN` 수 |
| total | Long | N | 걸러진 뒤 전체 수 — 화면의 「총 N명」 | 계산: COUNT |
| offset | Integer | N | 요청 값 그대로 | |
| limit | Integer | N | 요청 값 그대로 | |

- 필드 이름을 `email` 이 아니라 `maskedEmail` 로 둔다 — 원본으로 착각해 다른 곳에 쓰지 않게 이름이 말하게 한다.
- 마스킹은 서버가 한다. 원본을 내려보내고 화면에서 가리면 응답·브라우저 개발자 도구에 원본이 남는다.

**`roleChangeBlockedReason`** — 판정은 서버 한 곳에서 하고, 화면은 이 값으로 배지를 잠그고 사유 문구를 띄운다. 위에서부터 먼저 맞는 것 하나만 준다.

| 값 | 조건 | 화면 문구 |
|---|---|---|
| `SELF` | 이 행이 요청자 본인 | 자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요. |
| `LAST_ADMIN` | 이 행이 `ADMIN` 이고 `ADMIN` 이 1명뿐 | 마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요. |
| `null` | 위 둘 다 아님 | — |

> 요청자는 언제나 `ADMIN` 이므로, `ADMIN` 이 1명이면 그 1명은 요청자 본인이라 `SELF` 가 먼저 걸린다. 목록에서 `LAST_ADMIN` 이 보이는 일은 사실상 없다. **마지막 캡틴을 실제로 지키는 것은 `PATCH` 의 잠금 판정**이다 — 캡틴 둘이 동시에 서로를 내리는 경우 ([아래](#처리-규칙)).

**빈 결과·범위 밖**

- 조건에 맞는 사람이 없으면 `{ "items": [], "total": 0, … }`. 화면은 「조건에 맞는 유저가 없습니다.」 와 「총 0명」, 페이지 이동 없음.
- `offset ≥ total` 이면 `items: []` 와 실제 `total` 을 준다 (에러 아님). 화면은 `total` 로 마지막 페이지를 계산해 다시 부른다 — 권한을 바꾼 뒤 필터 결과가 줄어드는 경우.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `offset < 0`, `limit` 이 1~100 밖, `systemRole` 이 `ADMIN`·`MEMBER` 가 아님, `navigator` 가 boolean 이 아님, `q` 가 100자 초과 |
| 401 | UNAUTHORIZED | 토큰 없음·무효, 또는 토큰의 계정이 없음(탈퇴) |
| 403 | FORBIDDEN | 요청자가 `ADMIN` 이 아님 (`@RequireAdmin`) |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/users/page.tsx` — 지금은 `GET /accounts` 전체를 받아 그린다. 탭·검색·페이지·네비게이터 칸·휴면·권한 배지·이메일 「보기」로 바꾼다 (프로토 `UsersTable` 기준)
- `frontend/apps/back-office-front/src/features/users/queries.ts` → `useUsers()` — `/api/admin/accounts` 로 교체, 쿼리 키에 필터·`offset` 포함
- `frontend/apps/back-office-front/src/features/users/types.ts` → `ApiUser` 를 이 응답 모양으로 교체
- `frontend/packages/mock/src/msw/handlers/accounts.ts` — 핸들러 그룹을 `/api/admin/accounts` 로 옮기고 `ApiAccount` 를 이 모양으로. 프리셋: 정상 · 빈 결과 · 403

---

## 이메일 보기

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/accounts/{accountId}/email-reveals`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: 한 명의 이메일 원본을 돌려준다. 돌려줄 때마다 [감사 로그](#감사-로그)에 `EMAIL_REVEAL` 한 행을 남긴다

**왜 POST 인가.** 이 요청은 「보기」라는 사건을 하나 기록한다. GET 으로 두면 프리페치·재시도·링크 미리보기만으로도 감사 기록이 쌓이거나, 반대로 캐시가 응답을 대신해 기록 없이 원본이 보일 수 있다. POST 는 브라우저와 라이브러리가 알아서 부르지 않는다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| accountId | Long | 이메일을 볼 계정 ID (`items[].id`) |

### Query Parameters / Request Body

없음

### 처리 규칙

한 트랜잭션 안에서:

1. 대상 계정이 없으면 `404 NOT_FOUND`. 감사 기록을 남기지 않는다.
2. `ADMIN_AUDIT_LOG` 에 `(ACTOR_ACCOUNT_ID = 요청자, ACTION = EMAIL_REVEAL, TARGET_ACCOUNT_ID = 대상)` 한 행을 쓴다.
3. 이메일 원본을 돌려준다.

- **기록이 안 남으면 이메일도 안 나간다.** 2 가 실패하면 트랜잭션이 롤백되고 `500 INTERNAL_ERROR` 다.
- 본인 이메일을 보는 것도 막지 않고 똑같이 기록한다 — 예외를 두지 않는 편이 기록을 읽을 때 헷갈리지 않는다.
- 응답 헤더에 `Cache-Control: no-store` 를 둔다. 원본이 브라우저·프록시 캐시에 남지 않게 한다.
- 횟수 제한은 두지 않는다. 누가 몇 번 봤는지는 감사 로그로 남는다.

### Response — 200

```json
{ "id": 18, "email": "haneul@example.com" }
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | 대상 계정 ID | ACCOUNT.ID |
| email | String | N | 이메일 원본 | ACCOUNT.EMAIL |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음·무효, 또는 토큰의 계정이 없음(탈퇴) |
| 403 | FORBIDDEN | 요청자가 `ADMIN` 이 아님 (`@RequireAdmin`). 감사 기록 없음 |
| 404 | NOT_FOUND | `accountId` 에 해당하는 계정 없음 (탈퇴 등). 감사 기록 없음 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/users/page.tsx` — 이메일 칸 옆 「보기」. 누르면 그 줄에 처리 중을 표시하고 중복 클릭을 막는다 (권한 변경과 같은 원칙). 성공하면 그 줄의 이메일을 원본으로 바꿔 보여준다
  - 받은 원본은 **그 화면의 메모리에만** 둔다. 쿼리 캐시에 오래 두거나 URL·localStorage 에 넣지 않는다
  - 목록을 다시 받거나 화면을 떠나면 다시 가려진다. 다시 보려면 다시 누른다(다시 기록된다)
  - 실패하면 가린 값을 그대로 두고 `errorMessage` 를 토스트로 띄운다
- `frontend/apps/back-office-front/src/features/users/queries.ts` — `useRevealEmail()` mutation 신설
- `frontend/packages/mock/src/msw/handlers/accounts.ts` — 프리셋: 성공 · 404 · 403

---

## 계정 권한 변경

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/accounts/{accountId}/role`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: 대상 계정의 `SYSTEM_ROLE` 을 `ADMIN` 또는 `MEMBER` 로 바꾸고 [감사 로그](#감사-로그)에 `ROLE_CHANGE` 를 남긴다. 화면에서 고르는 즉시 호출한다 (저장 버튼 없음)

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| accountId | Long | 대상 계정 ID (`items[].id`) |

### Query Parameters

없음

### Request Body

```json
{ "systemRole": "ADMIN" }
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| systemRole | String | Y | `ADMIN` \| `MEMBER`. 그 밖의 값(`LEADER` 등)은 400 |

### 처리 규칙

요청자가 캡틴인지는 `@RequireAdmin` 이 이미 봤다. 서비스는 한 트랜잭션 안에서 아래 순서로 판정한다.

1. **`ADMIN` 행들을 잠그고 센다** — `SYSTEM_ROLE = ADMIN` 인 행을 `SELECT … FOR UPDATE` 로 읽는다.
2. 대상 계정이 없으면 `404 NOT_FOUND`.
3. 대상이 요청자 본인이면 `409 SELF_ROLE_CHANGE`. 값이 같아도 막는다.
4. 대상의 현재 값과 요청 값이 같으면 **아무것도 바꾸지 않고 200**. 감사 기록도 남기지 않는다 (중복 클릭·재시도에 안전).
5. `ADMIN → MEMBER` 이고 1 에서 센 `ADMIN` 수가 1 이하이면 `409 LAST_ADMIN`.
6. `Account` 의 상태 변경 메서드로 바꾼다 (setter 금지 — 규칙 3·5 는 서비스가 판정하고, 엔티티는 값 전이만 책임진다).
7. `ADMIN_AUDIT_LOG` 에 `(ACTOR_ACCOUNT_ID = 요청자, ACTION = ROLE_CHANGE, TARGET_ACCOUNT_ID = 대상, BEFORE_VALUE, AFTER_VALUE)` 한 행을 쓴다. 6 과 같은 트랜잭션이라 기록 없이 권한만 바뀌는 일은 없다.

**왜 1 에서 잠그고 세나.** 캡틴이 A·B 둘일 때 A 가 B 를, B 가 A 를 동시에 내린다고 하자. 잠그지 않으면 두 요청 모두 「캡틴 2명」을 보고 통과해 캡틴이 0명이 된다 — 백오피스에 아무도 못 들어오고, 되돌리려면 SQL 이 필요하다. 잠그고 세면:

1. 먼저 온 요청(A → B): `ADMIN` 2명을 보고 통과, B 가 크루가 된다.
2. 뒤에 온 요청(B → A): 앞 요청이 커밋될 때까지 기다렸다가 다시 세면 1명. 대상 A 가 마지막 캡틴이라 `LAST_ADMIN` 으로 거절된다.

캡틴이 0명이 되는 일은 이 판정만으로 막힌다. 그래서 「요청자가 아직 캡틴인가」를 서비스에서 다시 볼 필요가 없고, 그 판정은 `@RequireAdmin` 에 맡긴다 (authz-guards — 서비스 안에서 권한을 다시 보지 않는다).

**반영 시점**

- **내림(ADMIN → MEMBER)은 즉시 먹는다.** `@RequireAdmin` 이 요청마다 DB 로 `ADMIN` 을 보므로 내려진 사람의 다음 요청부터 `403` 이다. 이미 열린 백오피스 화면은 남아 있지만 데이터를 못 받는다.
- **올림(MEMBER → ADMIN)은 다음 백오피스 로그인부터.** 백오피스 로그인은 그 시점의 `SYSTEM_ROLE` 을 본다 ([back-office-login](../back-office-login/spec.md)). JWT 형식은 바뀌지 않는다.

### Response — 200

```json
{ "id": 18, "systemRole": "ADMIN" }
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | 대상 계정 ID | ACCOUNT.ID |
| systemRole | String | N | 변경 후 값 | ACCOUNT.SYSTEM_ROLE |

### 화면 동작 — 응답을 받은 뒤에 바꾼다

권한은 **저장된 상태를 정확히 보여주는 것**이 먼저다. 응답 전에 배지를 바꿔 두면 `409` 로 거절될 때 잠깐 캡틴으로 보였다가 돌아가는데, 캡틴 권한은 백오피스 접근과 바로 이어져 그 순간도 오해를 부른다. 기획의 완료 기준(「저장 성공 응답 수신 시점」)과도 맞는다.

1. 고르면 기존 배지는 그대로 두고 그 줄에 「변경 중」을 표시한다.
2. 처리 중에는 **그 줄만** 막는다. 다른 줄은 계속 바꿀 수 있다.
3. 성공하면 목록을 다시 받는다 — 캡틴 수가 바뀌면 다른 줄의 `roleChangeBlockedReason`·정렬·탭 결과도 바뀌기 때문이다.
   함께 **디스코드 설정은 따로 바꿔야 한다는 안내**를 띄운다 — 운영자에게 문의하라는 내용. 올림·내림 모두 띄운다 ([아래](#디스코드-역할은-자동으로-바꾸지-않는다)).
4. 거절되면 기존 배지를 그대로 두고 사유를 안내한다. 디자인이 정해지기 전까지는 `errorMessage` 를 토스트로 띄운다.

「변경 중」과 실패 안내를 어떻게 보여줄지는 기획에도 미구현으로 남아 있다 — 디자인에서 정한다.

### 디스코드 역할은 자동으로 바꾸지 않는다

캡틴·크루가 바뀌면 그 회원의 디스코드 서버 설정(역할)도 바뀌어야 한다. 다만 권한 변경은 자주 일어나는 일이 아니라서 **자동 연동 없이 운영자가 손으로 바꾸기로 했다** (2026-10-04 리드 회의, 디스코드 스쿼드 합의).

- 이 API 는 디스코드를 부르지 않는다. 응답도 바뀌지 않는다.
- 대신 화면이 권한 변경 성공 직후 「디스코드 설정은 운영자에게 문의해 바꿔 주세요」 취지의 안내를 띄운다. 정확한 문구와 모양은 playground 에 반영되는 대로 따른다.
- 실패(4xx)나 같은 값 요청에는 안내를 띄우지 않는다 — 바뀐 것이 없다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `systemRole` 없음, 또는 `ADMIN`·`MEMBER` 가 아님 |
| 401 | UNAUTHORIZED | 토큰 없음·무효, 또는 토큰의 계정이 없음(탈퇴) |
| 403 | FORBIDDEN | 요청자가 `ADMIN` 이 아님 (`@RequireAdmin`) |
| 404 | NOT_FOUND | `accountId` 에 해당하는 계정 없음 (탈퇴 등) |
| 409 | SELF_ROLE_CHANGE | **신규.** 대상이 요청자 본인 — 「자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요.」 |
| 409 | LAST_ADMIN | **신규.** 마지막 `ADMIN` 을 `MEMBER` 로 내리려 함 — 「마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요.」 |

- 두 신규 코드는 `ErrorCode` 에 `CONFLICT` 뒤로 추가한다 (`fromStatus(409)` 는 첫 409 인 `CONFLICT` 를 써야 한다).
- 이름이 목록의 `roleChangeBlockedReason` 값과 같은 사유를 가리킨다 — 화면이 잠그는 이유와 서버가 거절하는 이유가 하나의 어휘다.

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/users/page.tsx` — 권한 배지 선택 (프로토 `RoleBadgeSelect`). `roleChangeBlockedReason` 이 있으면 잠그고 사유를 툴팁으로. 처리 중 표시·그 줄 비활성화·성공 시 디스코드 안내는 [화면 동작](#화면-동작--응답을-받은-뒤에-바꾼다)
- `frontend/apps/back-office-front/src/features/users/queries.ts` — `useChangeAccountRole()` mutation 신설. 낙관적 갱신을 하지 않는다. 성공 시 목록 무효화
- `frontend/packages/mock/src/msw/handlers/accounts.ts` — 프리셋: 성공 · 409 SELF_ROLE_CHANGE · 409 LAST_ADMIN · 403

---

## 역할별 기본 권한표 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/role-permissions`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: 화면의 「역할별 기본 권한」 표 두 개(스터디 단위 · 사이트 전체)를 서버의 단일 정의에서 내려준다. 열람 전용

**왜 서버에 두나.** 권한 이름 목록은 출석 수정·공지·대시보드가 게이팅을 붙일 때 참조하는 기준이다. 화면 표와 서버 판정이 따로 정의되면 표에는 「허용」인데 서버는 막는 일이 생긴다. 서버에 `Permission` 정의를 하나 두고 표는 그것을 그대로 그린다. POL-0001 권한표가 기획 정본이고, 이 정의는 그것을 옮긴 것이다.

### Path Parameters / Query Parameters / Request Body

없음

### Response — 200

```json
{
  "groups": [
    {
      "scope": "STUDY",
      "roles": ["ADMIN", "LEADER", "MEMBER"],
      "permissions": [
        { "key": "CREW_VIEW", "label": "스터디 크루 명단 열람", "allowedRoles": ["ADMIN", "LEADER"] },
        { "key": "STUDY_EDIT", "label": "스터디 정보 수정", "allowedRoles": ["ADMIN", "LEADER"] },
        { "key": "ATTENDANCE_EDIT", "label": "출석 현황 수정", "allowedRoles": ["ADMIN", "LEADER"] },
        { "key": "MEETING_MANAGE", "label": "회차 관리 (추가·수정·삭제) — 담당 반에 한해", "allowedRoles": ["ADMIN", "LEADER"] },
        { "key": "NOTICE_STUDY", "label": "스터디 공지 발행", "allowedRoles": ["ADMIN", "LEADER"] }
      ]
    },
    {
      "scope": "SITE",
      "roles": ["ADMIN", "MEMBER"],
      "permissions": [
        { "key": "STUDY_CREATE", "label": "스터디 등록", "allowedRoles": ["ADMIN"] },
        { "key": "STUDY_PUBLISH", "label": "스터디 공개", "allowedRoles": ["ADMIN"] },
        { "key": "CREW_MANAGE", "label": "반 편성", "allowedRoles": ["ADMIN"] },
        { "key": "EVENT_MANAGE", "label": "행사 등록 및 수정", "allowedRoles": ["ADMIN"] },
        { "key": "NOTICE_SITE", "label": "사이트 공지 발행", "allowedRoles": ["ADMIN"] },
        { "key": "USER_VIEW", "label": "전체 유저 명단 열람", "allowedRoles": ["ADMIN"] },
        { "key": "USER_ROLE", "label": "유저 역할 수정", "allowedRoles": ["ADMIN"] }
      ]
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| groups | Array | N | 표 하나 = 그룹 하나. `STUDY` → `SITE` 순 | 계산: 서버 `Permission` 정의 |
| groups[].scope | String | N | `STUDY` (네비게이터 권한은 담당 스터디에 국한) \| `SITE` | 〃 |
| groups[].roles | Array\<String\> | N | 이 표의 열. 권한이 많은 쪽부터. `ADMIN`=캡틴, `LEADER`=네비게이터, `MEMBER`=크루 | 〃 |
| groups[].permissions | Array | N | 이 표의 행. 위 순서 그대로 그린다 | 〃 |
| groups[].permissions[].key | String | N | 권한 키. 게이팅 코드가 참조하는 이름 | 〃 |
| groups[].permissions[].label | String | N | 「하는 일」 칸 문구 | 〃 |
| groups[].permissions[].allowedRoles | Array\<String\> | N | 허용하는 역할. `roles` 의 부분집합 | 〃 |

- **행은 POL-0001 권한표를 따른다** (스터디 단위 5 · 사이트 전체 7). 키는 프로토 `lib/roles.ts` 의 `PermissionKey`(`crew.view` …)를 대문자 스네이크로 옮겼고, 프로토에 아직 없는 「회차 관리」만 `MEETING_MANAGE` 로 새로 지었다 — 프로토 권한표는 POL-0001 보다 한 행 적다.
- POL-0001 의 「신청 폼 · 신청 결과」 표는 **넣지 않는다.** 열이 담당 캡틴·다른 캡틴으로 나뉘어 역할별 기본 권한이 아니라 스터디마다 달라지는 규칙이고, 화면 기획(Notion)은 표 둘이다. 기획이 넣기로 하면 그룹을 하나 더 보탠다 — 응답 모양은 그대로 받을 수 있다 ([미확정](#미확정)).
- 역할 키는 DB 값(`ADMIN`·`LEADER`·`MEMBER`)을 쓴다 — 이 스펙 전체가 DB 값을 쓰므로 한 기능 안에 어휘를 둘 두지 않는다.
- 표 제목(「스터디 단위 권한」·「사이트 전체 권한」)과 제목 옆 한마디(「네비게이터 권한은 담당 스터디에 국한」)는 `scope` 로 프론트가 정한다.
- **화면은 응답을 그대로 그린다.** 그룹·열·행을 화면 코드에 박지 않는다 — 행이나 그룹이 늘어도 서버 정의만 고치면 된다. 이름표가 없는 역할 키·`scope` 는 키 문자열을 그대로 보인다.
- **출석 체크는 권한이 아니라 여기 없다.** 기록된 출석을 고치는 일(`ATTENDANCE_EDIT`)만 있다 (POL-0001).
- 역할 밖의 개별 권한 예외는 두지 않는다 — 사람마다 권한을 켜는 API 는 없다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음·무효 |
| 403 | FORBIDDEN | 요청자가 `ADMIN` 이 아님 (`@RequireAdmin`) |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/users/page.tsx` — 제목 옆 ⓘ 로 여는 권한표 모달 (프로토 `PermissionMatrixDialog`). 모달을 열 때 부르고 `staleTime` 을 길게 둔다 — 배포 사이에 바뀌지 않는다
- `frontend/packages/mock/src/msw/handlers/` — 신규 핸들러

---

## 감사 로그

운영자가 개인정보를 보거나 권한을 바꾼 일을 DB 에 남긴다. 앱 로그(Loki)는 30일이 지나면 지워져 「누가 언제 이 사람 이메일을 봤나」·「누가 이 사람을 캡틴으로 올렸나」에 답할 수 없다.

테이블: [`ADMIN_AUDIT_LOG`](../../docs/erd/ADMIN_AUDIT_LOG.md) (신규)

| ACTION | 언제 쓰나 | BEFORE_VALUE / AFTER_VALUE |
|---|---|---|
| `EMAIL_REVEAL` | [이메일 보기](#이메일-보기) 성공 | NULL / NULL |
| `ROLE_CHANGE` | [계정 권한 변경](#계정-권한-변경)으로 값이 실제로 바뀜 | `MEMBER` / `ADMIN` 처럼 변경 전후 `SYSTEM_ROLE` |

- **개인정보를 담지 않는다.** 계정 ID 와 행위만 남긴다. 이메일·닉네임을 넣으면 회원이 탈퇴해도 이 테이블에 개인정보가 남는다.
- `ACCOUNT` 와 FK 를 걸지 않는다 (애그리거트 사이 — [database-guide](../../docs/backend-development-guide/database-guide.md#외래키-정책)). 회원이 탈퇴해 `ACCOUNT` 행이 지워져도 기록은 남고, 남은 ID 로는 더 이상 사람을 되짚을 수 없다 — [user-leave](../user-leave/spec.md) 의 「식별할 수 없게 처리한 뒤 남긴다」와 같은 방식이다.
- 기록은 **그 행위와 같은 트랜잭션**에서 쓴다. 기록이 실패하면 행위도 일어나지 않는다.
- insert-only 다. 고치거나 지우는 API 는 없다.
- 보관 기간은 [미확정](#미확정). 정해지면 그보다 오래된 행을 지우는 작업을 따로 둔다.
- 기록을 조회하는 화면·API 는 이 스펙 범위 밖이다. 필요해지면 별도 스펙으로 연다.

---

## 옛 `GET /accounts` 를 없앤다

`AccountController` 의 `GET /accounts` 는 원래 로그인만 하면 누구나 전체 회원 이메일을 받던 구멍이었고, #178 에서 `@RequireAdmin` 이 붙어 닫혔다. 이 스펙의 `GET /api/admin/accounts` 가 그 자리를 대신하므로, 부르는 곳(백오피스 유저 화면 `features/users/queries.ts`)을 옮기는 구현 PR 에서 함께 지운다. 남겨 두면 마스킹 없이 원본 이메일을 주는 경로가 하나 더 있게 된다.

- `POST /accounts/onboarding` 은 그대로 둔다 — 관객이 다른 사용자 사이트 API 다.
- 새 엔드포인트는 `AdminAccountController` 에 둔다 (`@RequestMapping("/api/admin")` 아래 `/accounts`·`/role-permissions`, 클래스에 `@RequireAdmin`). 사용자 쪽 컨트롤러와 섞지 않는다 ([endpoint-convention](../../docs/backend-development-guide/api/endpoint-convention.md) 규칙 2·4).
- `docs/backend-development-guide/api/endpoint-convention.md` 의 엔드포인트 표에서 `GET /users` 행을 새 경로로 고친다.

## 보안·개인정보

- 네 엔드포인트 모두 `/api/admin` 아래라 `SecurityConfig` 의 기본 `authenticated()` 를 타고, `@RequireAdmin` 이 캡틴만 통과시킨다. `permitAll` 추가 없음.
- **목록의 이메일은 서버에서 가린다.** 원본은 「보기」로 한 명씩만, 볼 때마다 감사 로그에 남는다.
- **이메일 검색은 전체 일치만** — 부분 검색으로 가린 이메일을 알아내는 길을 막는다 ([Query Parameters](#query-parameters)).
- 이메일 보기 응답은 `Cache-Control: no-store`.
- 마스킹 함수는 공용 유틸로 올린다. 지금 `NotificationListResponse.maskEmail` 이 주석에 「두 번째 사용처가 생기면 공용 유틸로 승격한다」고 남겨 둔 바로 그 경우다.
- 앱 로그에는 ID 만 남긴다.
- 탈퇴 계정은 `ACCOUNT` 행이 물리 삭제되므로 별도 조건 없이 목록에 나오지 않는다 ([user-leave](../user-leave/spec.md)).

## 스키마

**테이블 1개 추가** — [`ADMIN_AUDIT_LOG`](../../docs/erd/ADMIN_AUDIT_LOG.md). ERD 문서는 이 PR 에, 마이그레이션(`V{n}__admin_audit_log.sql`)과 엔티티는 구현 PR 에 넣는다. 번호는 구현 PR 을 올릴 때의 `beta` 최신 번호 다음 (번호 충돌은 `backend-migration-check` 가 잡는다).

- 그 밖에 쓰는 컬럼: `ACCOUNT`(ID·NICKNAME·EMAIL·SYSTEM_ROLE·CREATED_AT·ONBOARDING_COMPLETED_AT), `STUDY_PARTICIPANT`(ACCOUNT_ID·STUDY_ID·STATUS·PARTICIPANT_ROLE·JOINED_AT), `STUDY`(ID·TITLE). 기존 테이블은 바꾸지 않는다.
- 명부 집계는 기존 인덱스 `idx_study_participant_account(ACCOUNT_ID)` 를 탄다. 회원 수가 수백 명 규모라 목록 한 번에 집계 서브쿼리를 붙여도 된다 — 구현 방식은 plan 에서.
- 참고: `docs/erd/STUDY_PARTICIPANT.md` 는 아직 `STUDY_CLASS_ID`·`STUDY_COHORT_ID` 로 적혀 있지만 코드는 `STUDY_GROUP_ID`·`STUDY_ID` 다 (V15 이름 변경). 이 스펙은 코드를 따른다.

## 테스트 (구현 PR 기준)

통합 — 스펙의 성공·에러 응답 그대로.

| 대상 | 경우 | 기대 |
|---|---|---|
| GET 목록 | ADMIN 요청 | 200, 정렬 순서(ADMIN → 담당 있음 → 참여 수 → 가입일), `total` 은 필터 뒤 수, `maskedEmail` 이 `h***@…` 꼴 |
| | 응답 본문 | 이메일 원본이 어디에도 없다 |
| | `systemRole` · `navigator` · `q` 조합 | AND 로 걸림. `q` 는 이름 부분 일치(대소문자 무시) |
| | `q` 에 이메일 전체 / 이메일 일부 | 전체는 찾힘(대소문자 무시) / 일부는 안 찾힘 |
| | 온보딩 전 계정 | `name = null`, 임시 닉네임으로 검색 안 됨 |
| | 하차·완주한 네비게이터 | `navigatorOf` 에 없음, 참여 수에 안 셈 |
| | 본인 행 | `roleChangeBlockedReason = SELF` |
| | `offset ≥ total` | 200, `items = []`, `total` 은 실제 값 |
| | MEMBER 요청 / 토큰 없음 / `limit=0` | 403 / 401 / 400 |
| POST 이메일 보기 | ADMIN 요청 | 200 원본, `Cache-Control: no-store`, `EMAIL_REVEAL` 1행 (요청자·대상 ID) |
| | 없는 계정 / MEMBER 요청 | 404 / 403, 감사 기록 0행 |
| PATCH 권한 | MEMBER → ADMIN | 200, DB 반영, `ROLE_CHANGE` 1행 (`MEMBER` → `ADMIN`) |
| | 같은 값 | 200, 변경 없음, 감사 기록 0행 |
| | 본인 | 409 SELF_ROLE_CHANGE, 감사 기록 0행 |
| | 없는 계정 / MEMBER 요청 / `systemRole=LEADER` | 404 / 403 / 400 |
| GET 권한표 | ADMIN / MEMBER | 200 (POL-0001 스터디 단위 5행 · 사이트 전체 7행과 같은 순서·허용) / 403 |

단위·기타:

- `LAST_ADMIN` 은 HTTP 로 차례차례 부르면 만들 수 없다 (ADMIN 이 1명이면 그 사람이 요청자라 `SELF` 가 먼저 걸린다). 판정 로직을 단위 테스트로 검증한다.
- 「캡틴 둘이 동시에 서로를 내리면 한쪽만 성공」은 잠금 읽기가 H2 에서 MySQL 과 같게 동작하는지에 달려 있어 검증 방식(Testcontainers 등)을 plan 에서 정한다.
- 감사 기록 쓰기가 실패하면 이메일을 돌려주지 않고 권한도 바뀌지 않는다 — 저장소를 실패시키는 테스트로 확인한다.
- 마스킹 유틸 — 일반 · `@` 앞 1자 · `@` 없음 · null.

## 범위 밖

- 네비게이터 지정·해제 — 스터디 크루 명단 소관 ([captain-view-attendees](../../planning/stories/captain-view-attendees/PRD.md))
- 회원 상세 화면 · 초대 · 정지 · 탈퇴 처리 · 명단 내보내기(CSV)
- 정지 계정 — `ACCOUNT` 에 정지 상태가 없다. 생기면 목록 포함 여부를 그때 정한다
- `CO_LEADER` 제거 — 별도 작업 (POL-0001)
- 감사 로그 조회 화면·API, 보관 기간이 지난 기록을 지우는 작업 — 보관 기간이 정해진 뒤 별도로
- 이메일 보기 횟수 제한
- 디스코드 역할 자동 연동 — 운영자가 수동으로 바꾼다 ([위](#디스코드-역할은-자동으로-바꾸지-않는다))

## 결정 기록

| 날짜 | 결정 | 근거 |
|---|---|---|
| 2026-10-04 | 인가는 `@RequireAdmin` 으로만. 서비스 안 권한 재확인 없음. `PATCH` 의 잠금은 캡틴 수 판정용으로만 남긴다 | #178 머지, authz-guards 스펙. PR #163 리뷰 |
| 2026-10-04 | 이메일은 목록에서 마스킹, 「보기」(`POST …/email-reveals`)로 한 명씩 원본, 볼 때마다 감사 로그. 이메일 검색은 전체 일치만 | PR #163 리뷰 — 운영진(디스코드) 의견. Notion 미확정 4 를 대체 |
| 2026-10-04 | 권한 변경도 같은 감사 로그 테이블에 남긴다 (`ROLE_CHANGE`) | PR #163 리뷰. 처음 제안(INFO 로그만)을 대체 |
| 2026-10-04 | 권한 변경 화면은 응답을 받은 뒤 바꾼다. 처리 중엔 그 줄만 막는다 | PR #163 리뷰 |
| 2026-10-04 | 「참여 중」에 `PAUSED` 포함 · 권한표 역할 키는 DB 값 · 권한표는 서버에서 · 리소스 이름 `accounts` | PR #163 리뷰 — 제안대로 합의 |
| 2026-10-04 | 권한이 바뀌어도 디스코드 역할은 자동으로 바꾸지 않는다. 성공 시 화면이 운영자 문의 안내를 띄운다 | 리드 회의 — 디스코드 스쿼드 합의. PR #163 리뷰로 전달 |

## 미확정

- [NEEDS CLARIFICATION] **감사 로그 보관 기간** — 운영진 확인 중. 개인정보 접속기록은 1년 이상 보관하라는 기준(개인정보의 안전성 확보조치 기준)이 있는 것으로 알고 있어 그 이상을 제안한다. 근거 조항은 확인 뒤 여기에 적는다
- 「변경 중」·「보기」 처리 중·실패 안내의 화면 모양 — 디자인에서 정한다. API 계약에는 영향 없음. 정해지기 전까지 실패는 `errorMessage` 토스트
- 이메일 「보기」·마스킹·감사 로그는 아직 기획 문서(Notion·PRD)에 없다 — 기획 반영은 기획 쪽에서
- **권한표에 POL-0001 「신청 폼 · 신청 결과」 표를 넣을지** — 기획 확인 대기. 지금은 넣지 않는다 ([권한표](#역할별-기본-권한표-조회)). 넣기로 하면 서버 정의에 그룹 추가 + 화면 열 이름표에 「담당 캡틴」·「다른 캡틴」
- **담당 캡틴의 명부 행을 「참여 중」으로 셀지** — 기획 확인 대기. 지금은 센다 ([용어](#먼저-읽을-것--용어와-저장-값)). 바꾸면 목록 DAO 의 조건 한 곳
- 프로토 권한표에 「회차 관리」 행이 없다 — POL-0001 과 맞추는 것은 기획 쪽에서
