# 백오피스 회원 API Spec — 회원 목록 · 계정 권한 변경

> ERD: [ACCOUNT](../../docs/erd/ACCOUNT.md), [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md), [STUDY](../../docs/erd/STUDY.md)
> 생성일: 2026-10-01
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴으로서, 전체 회원 리스트를 조회할 수 있다](../../planning/stories/captain-list-users/PRD.md)
> - [캡틴으로서, 유저에게 서로 다른 역할과 권한을 줄 수 있다](../../planning/stories/captain-grant-roles/PRD.md)
>
> 정책: [POL-0001 역할과 권한](../../01-planning/_registry/policies/POL-0001-roles.md) — 계정 권한(캡틴·크루)과 스터디 역할(네비게이터)은 다른 층이다
> 관련: [back-office-login/spec.md](../back-office-login/spec.md) — 「2단계 — 역할 부여」를 이 스펙이 받는다. [user-leave/spec.md](../user-leave/spec.md) — 탈퇴 계정은 물리 삭제라 목록에 나오지 않는다
> 기준 프로토타입: playground 운영 콘솔 › 유저 (`frontend/apps/playground/src/proto/console/components/UsersTable.tsx`, `lib/roles.ts`)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/accounts | 회원 목록 — 필터·검색·페이지, 걸러진 뒤 총 인원 | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/accounts/{accountId}/role | 계정 권한 변경 (ADMIN ↔ MEMBER) | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/role-permissions | 역할별 기본 권한표 | O (ADMIN) | 스펙작성중 |
| ~~GET~~ | ~~/accounts~~ | 옛 유저 목록 — **구현 PR 에서 삭제** ([아래](#옛-get-accounts-를-없앤다)) | O (로그인만) | 변경예정 |

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

### 기획 문서(Notion)와 달라진 곳

Notion 스토리 본문의 시스템 요건을 이 레포의 규약·스키마에 맞춰 옮겼다. 동작은 같고 이름·모양만 다르다.

| Notion 기획 | 이 스펙 | 이유 |
|---|---|---|
| `GET /api/users?page=&size=&role=&q=` | `GET /api/admin/accounts?offset=&limit=&systemRole=&navigator=&q=` | 백오피스 API 는 `/api/admin` 아래 ([endpoint-convention](../../docs/backend-development-guide/api/endpoint-convention.md)). 리소스 이름은 테이블·엔티티(`ACCOUNT`)를 따른다. 페이지 계약은 프로젝트 공통 `items/total/offset/limit` |
| 필터 `role` 하나에 전체·캡틴·네비게이터·크루 | `systemRole` + `navigator` 두 파라미터 | 계정 권한과 스터디 역할은 다른 층(POL-0001). 한 파라미터에 섞으면 `NAVIGATOR` 가 계정 권한 값처럼 보인다 |
| `role: captain \| crew` | `systemRole: ADMIN \| MEMBER` | DB enum 그대로 (`/auth/me` 의 `role` 과 같은 값) |
| `navigatorOf: string[]` (스터디 id) | `navigatorOf: [{ studyId, title }]` | 화면이 **이름**을 적는다. id 만 주면 프론트가 스터디를 또 조회해야 한다 |
| `enrollment.navigator` 신규 필드 | 기존 `STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER` | 이미 있는 컬럼이다. **스키마 변경 없음** |
| `name` (null 이면 이메일 로컬파트) | `name` = `ACCOUNT.NICKNAME`, 온보딩 전이면 null | 온보딩 전 닉네임은 `account_<랜덤>` 임시값이라 사람 이름이 아니다 |
| `studyCount` | 응답에 없음. `dormant` 만 준다 | 정렬이 서버라 프론트가 개수를 쓸 곳이 없다. 휴면 판정도 서버 한 곳에서 |
| `PATCH /api/users/{id}/role` | `PATCH /api/admin/accounts/{accountId}/role` | 위와 같은 경로 규약 |
| 사유 코드 | `SELF_ROLE_CHANGE` · `LAST_ADMIN` (409) | [Error Responses](#error-responses-1) |

---

## 회원 목록 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/accounts`
- **인증**: 필요 — `SYSTEM_ROLE = ADMIN` 만. 요청마다 DB 로 판정한다 (`StudyCaptainGuard.assertCaptain`)
- **설명**: 가입한 회원을 필터·검색·페이지로 조회한다. 응답의 `total` 은 **걸러진 뒤 전체 수**다 (지금 페이지의 행 수가 아니다)

### Path Parameters

없음

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| systemRole | String | N | — | `ADMIN` \| `MEMBER`. 계정 권한으로 거른다 |
| navigator | Boolean | N | — | `true` = 담당 스터디가 있는 사람만, `false` = 없는 사람만, 생략 = 조건 없음 |
| q | String | N | — | 이름·이메일 부분 일치, 대소문자 무시. 앞뒤 공백을 자르고 빈 문자열이면 조건 없음. 최대 100자 |
| offset | Integer | N | 0 | 0 이상 |
| limit | Integer | N | 20 | 1 ~ 100. 화면은 20 고정 |

- 모든 조건은 **AND** 로 걸린다.
- `q` 는 응답의 `name` 과 같은 값(온보딩 완료자의 닉네임)과 `ACCOUNT.EMAIL` 에 건다. 온보딩 전 임시 닉네임(`account_…`)으로는 찾히지 않는다.
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
      "email": "gaon@example.com",
      "systemRole": "ADMIN",
      "navigatorOf": [],
      "dormant": true,
      "joinedAt": "2026-08-12T03:41:09Z",
      "roleChangeBlockedReason": "SELF"
    },
    {
      "id": 18,
      "name": "하늘",
      "email": "haneul@example.com",
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
      "email": "newbie@example.com",
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
| items[].id | Long | N | 계정 ID. `PATCH …/{accountId}/role` 의 경로 값 | ACCOUNT.ID |
| items[].name | String | Y | 표시 이름. **온보딩 전이면 null** — 화면은 이메일 로컬파트를 적는다 | ACCOUNT.NICKNAME (계산: `ONBOARDING_COMPLETED_AT IS NULL` 이면 null) |
| items[].email | String | N | 계정 이메일. 마스킹하지 않는다 ([보안](#보안개인정보)) | ACCOUNT.EMAIL |
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

**`roleChangeBlockedReason`** — 판정은 서버 한 곳에서 하고, 화면은 이 값으로 배지를 잠그고 사유 문구를 띄운다. 위에서부터 먼저 맞는 것 하나만 준다.

| 값 | 조건 | 화면 문구 |
|---|---|---|
| `SELF` | 이 행이 요청자 본인 | 자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요. |
| `LAST_ADMIN` | 이 행이 `ADMIN` 이고 `ADMIN` 이 1명뿐 | 마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요. |
| `null` | 위 둘 다 아님 | — |

> 요청자는 언제나 `ADMIN` 이므로, `ADMIN` 이 1명이면 그 1명은 요청자 본인이라 `SELF` 가 먼저 걸린다. 목록에서 `LAST_ADMIN` 이 보이는 일은 사실상 없다. **마지막 캡틴을 실제로 지키는 것은 `PATCH` 의 동시성 검사**다 — 캡틴 둘이 동시에 서로를 내리는 경우 ([아래](#처리-규칙)).

**빈 결과·범위 밖**

- 조건에 맞는 사람이 없으면 `{ "items": [], "total": 0, … }`. 화면은 「조건에 맞는 유저가 없습니다.」 와 「총 0명」, 페이지 이동 없음.
- `offset ≥ total` 이면 `items: []` 와 실제 `total` 을 준다 (에러 아님). 화면은 `total` 로 마지막 페이지를 계산해 다시 부른다 — 권한을 바꾼 뒤 필터 결과가 줄어드는 경우.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `offset < 0`, `limit` 이 1~100 밖, `systemRole` 이 `ADMIN`·`MEMBER` 가 아님, `navigator` 가 boolean 이 아님, `q` 가 100자 초과 |
| 401 | UNAUTHORIZED | 토큰 없음·무효, 또는 토큰의 계정이 없음(탈퇴) |
| 403 | FORBIDDEN | 요청자가 `ADMIN` 이 아님 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/users/page.tsx` — 지금은 `GET /accounts` 전체를 받아 그린다. 탭·검색·페이지·네비게이터 칸·휴면·권한 배지로 바꾼다 (프로토 `UsersTable` 기준)
- `frontend/apps/back-office-front/src/features/users/queries.ts` → `useUsers()` — `/api/admin/accounts` 로 교체, 쿼리 키에 필터·`offset` 포함
- `frontend/apps/back-office-front/src/features/users/types.ts` → `ApiUser` 를 이 응답 모양으로 교체
- `frontend/packages/mock/src/msw/handlers/accounts.ts` — 핸들러 그룹을 `/api/admin/accounts` 로 옮기고 `ApiAccount` 를 이 모양으로. 프리셋: 정상 · 빈 결과 · 403

---

## 계정 권한 변경

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/accounts/{accountId}/role`
- **인증**: 필요 — `SYSTEM_ROLE = ADMIN` 만
- **설명**: 대상 계정의 `SYSTEM_ROLE` 을 `ADMIN` 또는 `MEMBER` 로 바꾼다. 화면에서 고르는 즉시 호출한다 (저장 버튼 없음)

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

한 트랜잭션 안에서 아래 순서로 판정한다.

1. **요청자와 `ADMIN` 행들을 잠근다** — `SYSTEM_ROLE = ADMIN` 인 행을 `SELECT … FOR UPDATE` 로 읽는다. 요청자가 그 안에 없으면 `403 FORBIDDEN` (방금 다른 캡틴이 요청자를 내린 경우도 여기서 걸린다).
2. 대상 계정이 없으면 `404 NOT_FOUND`.
3. 대상이 요청자 본인이면 `409 SELF_ROLE_CHANGE`. 값이 같아도 막는다.
4. 대상의 현재 값과 요청 값이 같으면 **아무것도 바꾸지 않고 200** (중복 클릭·재시도에 안전).
5. `ADMIN → MEMBER` 이고 1 에서 읽은 `ADMIN` 수가 1 이하이면 `409 LAST_ADMIN`.
6. `Account` 의 상태 변경 메서드로 바꾼다 (setter 금지 — 규칙 3·5 는 서비스가 판정하고, 엔티티는 값 전이만 책임진다).
7. INFO 로그 한 줄 — `actorId`, `targetId`, `from`, `to`. 이메일·닉네임은 남기지 않는다.

**왜 1 에서 잠그나.** 캡틴이 A·B 둘일 때 A 가 B 를, B 가 A 를 동시에 내리면 두 요청 모두 「캡틴 2명」을 보고 통과해 캡틴이 0명이 된다. 백오피스에 아무도 못 들어오고 되돌리려면 SQL 이 필요하다. `ADMIN` 행에 잠금을 건 읽기로 세면 뒤 요청은 앞 요청이 커밋될 때까지 기다렸다가 갱신된 수(1명)를 보고 거절된다.

**반영 시점**

- **내림(ADMIN → MEMBER)은 즉시 먹는다.** 백오피스 API 는 요청마다 DB 로 `ADMIN` 을 보므로 내려진 사람의 다음 요청부터 `403` 이다. 이미 열린 백오피스 화면은 남아 있지만 데이터를 못 받는다.
- **올림(MEMBER → ADMIN)은 다음 백오피스 로그인부터.** 백오피스 로그인은 그 시점의 `SYSTEM_ROLE` 을 본다 ([back-office-login](../back-office-login/spec.md)). JWT 형식은 바뀌지 않는다.

### Response — 200

```json
{ "id": 18, "systemRole": "ADMIN" }
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | 대상 계정 ID | ACCOUNT.ID |
| systemRole | String | N | 변경 후 값 | ACCOUNT.SYSTEM_ROLE |

화면은 성공하면 목록 쿼리를 무효화해 다시 받는다 — 캡틴 수가 바뀌면 다른 행의 `roleChangeBlockedReason`·정렬·탭 결과도 바뀌기 때문이다. 실패하면 배지를 이전 값으로 되돌리고 `errorMessage` 를 띄운다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `systemRole` 없음, 또는 `ADMIN`·`MEMBER` 가 아님 |
| 401 | UNAUTHORIZED | 토큰 없음·무효, 또는 토큰의 계정이 없음(탈퇴) |
| 403 | FORBIDDEN | 요청자가 `ADMIN` 이 아님 (요청 처리 중 내려진 경우 포함) |
| 404 | NOT_FOUND | `accountId` 에 해당하는 계정 없음 (탈퇴 등) |
| 409 | SELF_ROLE_CHANGE | **신규.** 대상이 요청자 본인 — 「자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요.」 |
| 409 | LAST_ADMIN | **신규.** 마지막 `ADMIN` 을 `MEMBER` 로 내리려 함 — 「마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요.」 |

- 두 신규 코드는 `ErrorCode` 에 `CONFLICT` 뒤로 추가한다 (`fromStatus(409)` 는 첫 409 인 `CONFLICT` 를 써야 한다).
- 이름이 목록의 `roleChangeBlockedReason` 값과 같은 사유를 가리킨다 — 화면이 잠그는 이유와 서버가 거절하는 이유가 하나의 어휘다.

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/users/page.tsx` — 권한 배지 선택 (프로토 `RoleBadgeSelect`). `roleChangeBlockedReason` 이 있으면 잠그고 사유를 툴팁으로
- `frontend/apps/back-office-front/src/features/users/queries.ts` — `useChangeAccountRole()` mutation 신설. 낙관적 갱신 + 실패 시 되돌림 + 성공 시 목록 무효화
- `frontend/packages/mock/src/msw/handlers/accounts.ts` — 프리셋: 성공 · 409 SELF_ROLE_CHANGE · 409 LAST_ADMIN · 403

---

## 역할별 기본 권한표 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/role-permissions`
- **인증**: 필요 — `SYSTEM_ROLE = ADMIN` 만
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

- 키는 프로토 `lib/roles.ts` 의 `PermissionKey`(`crew.view` …)를 대문자 스네이크로 옮긴 것이다. 1:1 대응.
- 표 제목(「스터디 단위 권한」·「사이트 전체 권한」)과 제목 옆 한마디(「네비게이터 권한은 담당 스터디에 국한」)는 `scope` 로 프론트가 정한다 — 그룹은 둘로 고정이다.
- **출석 체크는 권한이 아니라 여기 없다.** 기록된 출석을 고치는 일(`ATTENDANCE_EDIT`)만 있다 (POL-0001).
- 역할 밖의 개별 권한 예외는 두지 않는다 — 사람마다 권한을 켜는 API 는 없다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음·무효 |
| 403 | FORBIDDEN | 요청자가 `ADMIN` 이 아님 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/users/page.tsx` — 제목 옆 ⓘ 로 여는 권한표 모달 (프로토 `PermissionMatrixDialog`). 모달을 열 때 부르고 `staleTime` 을 길게 둔다 — 배포 사이에 바뀌지 않는다
- `frontend/packages/mock/src/msw/handlers/` — 신규 핸들러

---

## 옛 `GET /accounts` 를 없앤다

`AccountController` 의 `GET /accounts` 는 **로그인만 하면 누구나** 전체 회원의 이메일을 받는다. [back-office-login](../back-office-login/spec.md#한계--후속) 이 「후속 PR 에서 ADMIN 가드를 붙인다」고 남긴 구멍이다. 부르는 곳은 백오피스 유저 화면 하나뿐이라(`features/users/queries.ts`) 그 화면이 `/api/admin/accounts` 로 옮기는 구현 PR 에서 함께 지운다.

- `POST /accounts/onboarding` 은 그대로 둔다 — 관객이 다른 사용자 사이트 API 다.
- 새 엔드포인트는 `AdminAccountController` 에 둔다 (`@RequestMapping("/api/admin")` 아래 `/accounts`·`/role-permissions`). 사용자 쪽 컨트롤러와 섞지 않는다 ([endpoint-convention](../../docs/backend-development-guide/api/endpoint-convention.md) 규칙 2·4).
- `docs/backend-development-guide/api/endpoint-convention.md` 의 엔드포인트 표에서 `GET /users` 행을 새 경로로 고친다.

## 보안·개인정보

- 세 엔드포인트 모두 `/api/admin` 아래라 `SecurityConfig` 의 기본 `authenticated()` 를 탄다. `permitAll` 추가 없음.
- 권한 판정은 서버가 요청마다 한다. 백오피스 로그인 게이트·화면 잠금은 보조다.
- **이메일을 마스킹하지 않는다.** 이 목록의 목적이 회원을 알아보는 것이고, 캡틴만 받는 운영 API 다 (PRD 「이메일이 담긴 목록은 운영 콘솔 API 로만 돌려준다」). [security-guide](../../docs/backend-development-guide/security-guide.md) 의 응답 마스킹 규칙에 대한 예외로 둔다 — [미확정 1](#미확정).
- 로그에는 ID 만 남긴다.
- 탈퇴 계정은 `ACCOUNT` 행이 물리 삭제되므로 별도 조건 없이 목록에 나오지 않는다 ([user-leave](../user-leave/spec.md)).

## 스키마

변경 없음. 마이그레이션 없음.

- 쓰는 컬럼: `ACCOUNT`(ID·NICKNAME·EMAIL·SYSTEM_ROLE·CREATED_AT·ONBOARDING_COMPLETED_AT), `STUDY_PARTICIPANT`(ACCOUNT_ID·STUDY_ID·STATUS·PARTICIPANT_ROLE·JOINED_AT), `STUDY`(ID·TITLE).
- 명부 집계는 기존 인덱스 `idx_study_participant_account(ACCOUNT_ID)` 를 탄다. 회원 수가 수백 명 규모라 목록 한 번에 집계 서브쿼리를 붙여도 된다 — 구현 방식은 plan 에서.
- 참고: `docs/erd/STUDY_PARTICIPANT.md` 는 아직 `STUDY_CLASS_ID`·`STUDY_COHORT_ID` 로 적혀 있지만 코드는 `STUDY_GROUP_ID`·`STUDY_ID` 다 (V15 이름 변경). 이 스펙은 코드를 따른다.

## 테스트 (구현 PR 기준)

통합 — 스펙의 성공·에러 응답 그대로.

| 대상 | 경우 | 기대 |
|---|---|---|
| GET 목록 | ADMIN 요청 | 200, 정렬 순서(ADMIN → 담당 있음 → 참여 수 → 가입일), `total` 은 필터 뒤 수 |
| | `systemRole` · `navigator` · `q` 조합 | AND 로 걸림. `q` 대소문자 무시, 이메일·이름 부분 일치 |
| | 온보딩 전 계정 | `name = null`, 임시 닉네임으로 검색 안 됨 |
| | 하차·완주한 네비게이터 | `navigatorOf` 에 없음, 참여 수에 안 셈 |
| | 본인 행 | `roleChangeBlockedReason = SELF` |
| | `offset ≥ total` | 200, `items = []`, `total` 은 실제 값 |
| | MEMBER 요청 / 토큰 없음 / `limit=0` | 403 / 401 / 400 |
| PATCH 권한 | MEMBER → ADMIN | 200, DB 반영 |
| | 같은 값 | 200, 변경 없음 |
| | 본인 | 409 SELF_ROLE_CHANGE |
| | 없는 계정 / MEMBER 요청 / `systemRole=LEADER` | 404 / 403 / 400 |
| GET 권한표 | ADMIN / MEMBER | 200 (POL-0001 표와 같은 11행) / 403 |

단위 — `LAST_ADMIN` 은 HTTP 로 차례차례 부르면 만들 수 없다 (ADMIN 이 1명이면 그 사람이 요청자라 `SELF` 가 먼저 걸린다). 판정 로직을 단위 테스트로 검증하고, 「캡틴 둘이 동시에 서로를 내리면 한쪽만 성공」은 잠금 읽기가 H2 에서 MySQL 과 같게 동작하는지에 달려 있어 검증 방식(Testcontainers 등)을 plan 에서 정한다.

## 범위 밖

- 네비게이터 지정·해제 — 스터디 크루 명단 소관 ([captain-view-attendees](../../planning/stories/captain-view-attendees/PRD.md))
- 회원 상세 화면 · 초대 · 정지 · 탈퇴 처리 · 명단 내보내기(CSV)
- 정지 계정 — `ACCOUNT` 에 정지 상태가 없다. 생기면 목록 포함 여부를 그때 정한다
- `CO_LEADER` 제거 — 별도 작업 (POL-0001)
- 로그인 이후 일반 백오피스 API 전반의 ADMIN 가드 정리 — 이 스펙은 자기 엔드포인트에만 건다

## 미확정

- [NEEDS CLARIFICATION] **이메일 전체 표시 유지 여부** — 제안: 전체 표시 (캡틴 전용 + 회원 식별이 목적). 가린다면 검색도 함께 바뀐다 (가린 값으로 찾을 수 없음). Notion 미확정 4
- [NEEDS CLARIFICATION] **「참여 중」에 `PAUSED` 를 넣는가** — 제안: 넣는다 (잠시 쉼은 명부에 남아 있고 정원도 차지한다 — `countByStudyIds` 와 같은 기준). 휴면·정렬·네비게이터 칸 모두 같은 기준을 쓴다
- [NEEDS CLARIFICATION] **권한표의 역할 키 어휘** — 제안: DB 값 `ADMIN`·`LEADER`·`MEMBER` (이 스펙 전체가 DB 값을 쓰므로). 대안은 `CAPTAIN`·`NAVIGATOR`·`CREW` 를 권한 정의 전용 어휘로 새로 두는 것 — 문서 어휘와 같아지지만 한 기능 안에 두 어휘가 생긴다
- [NEEDS CLARIFICATION] **권한표를 이번에 서버에서 내릴지** — 제안: 이번에 같이 (게이팅이 참조할 권한 이름을 먼저 확정하는 게 Notion 「다음 할 일」). 일정이 빠듯하면 화면은 프로토 상수로 먼저 띄우고 엔드포인트를 뒤로 미룰 수 있다
- [NEEDS CLARIFICATION] **권한 변경 이력** — 제안: 이번엔 INFO 로그만. 「누가 언제 바꿨는지」를 화면에서 봐야 하면 이력 테이블을 별도 스펙으로. repo PRD 미확정 3
- 리소스 이름 `accounts` vs `users` — 이 스펙은 테이블·엔티티를 따라 `accounts`. 화면 이름(「유저」)과 다르다는 점은 리뷰에서 확인
