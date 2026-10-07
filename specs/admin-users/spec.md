# 회원 관리 (백오피스) API Spec

> ERD: [ACCOUNT](../../docs/erd/ACCOUNT.md) · [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md)
> 정책: [POL-0001 역할과 권한](../../01-planning/_registry/policies/POL-0001-roles.md) · [POL-0007 회원 데이터와 탈퇴](../../01-planning/_registry/policies/POL-0007-account-data.md)
> 생성일: 2026-10-06
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 전체 회원 리스트를 조회할 수 있다.](../../01-planning/stories/captain-list-users/PRD.md)
> - [캡틴은 유저에게 서로 다른 역할과 권한을 줄 수 있다.](../../01-planning/stories/captain-grant-roles/PRD.md)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/users | 회원 목록 (역할 탭 · 검색 · 페이지) | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/users/{accountId}/system-role | 계정 권한 변경 (캡틴 ↔ 크루) | O (ADMIN) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

컨트롤러는 `/api/admin/*` 규칙대로 `@RequireAdmin` 을 단다. 화면 가드만으로 막지 않는다.

---

## 회원 목록

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/users`
- **인증**: 필요 — `SYSTEM_ROLE = ADMIN`
- **설명**: 가입한 회원 전체(탈퇴한 계정은 이미 삭제돼 없다)를 역할 · 검색어로 거르고 20명씩 돌려준다.

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| role | String | N | `ALL` | `ALL` · `CAPTAIN` · `NAVIGATOR` · `CREW` |
| q | String | N | | 닉네임 · 이메일 부분 일치 (대소문자 무시, 앞뒤 공백 제거) |
| offset | Int | N | 0 | |
| limit | Int | N | 20 | 1~100 |

`role` 판정:

| 값 | 조건 |
|----|------|
| `CAPTAIN` | `ACCOUNT.SYSTEM_ROLE = ADMIN` |
| `NAVIGATOR` | 활성 명부 행(`STATUS IN (ACTIVE, PAUSED)`) 중 `PARTICIPANT_ROLE = LEADER` 가 하나 이상 |
| `CREW` | 위 둘이 아님 |

한 사람이 캡틴이면서 네비게이터일 수 있다. `CAPTAIN` 탭과 `NAVIGATOR` 탭에 모두 나온다.

### Request Body

없음

### Response — 200

```json
{
  "items": [
    {
      "accountId": 12,
      "nickname": "jamie",
      "email": "jamie@example.com",
      "systemRole": "ADMIN",
      "joinedAt": "2026-08-01T03:00:00Z",
      "participatingStudyCount": 2,
      "navigatingStudies": [{ "studyId": 3, "title": "AI 논문 스터디" }],
      "dormant": false
    }
  ],
  "total": 134,
  "offset": 0,
  "limit": 20
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items[].accountId | Long | N | | ACCOUNT.ID |
| items[].nickname | String | N | 화면의 이름 칸 | ACCOUNT.NICKNAME |
| items[].email | String | N | 운영 콘솔 응답에만 싣는다 | ACCOUNT.EMAIL |
| items[].systemRole | String | N | `ADMIN` · `MEMBER` | ACCOUNT.SYSTEM_ROLE |
| items[].joinedAt | String (ISO-8601 UTC) | N | 가입일 | ACCOUNT.CREATED_AT |
| items[].participatingStudyCount | Int | N | 활성 명부 행이 있는 서로 다른 스터디 수 | 계산: STUDY_PARTICIPANT(ACTIVE·PAUSED) → STUDY_GROUP.STUDY_ID distinct |
| items[].navigatingStudies | Array | N | 네비게이터로 맡은 스터디. 없으면 `[]` | 계산: STUDY_PARTICIPANT(LEADER, ACTIVE·PAUSED) |
| items[].dormant | Boolean | N | 참여 스터디가 없으면 true — 화면 「휴면」 | 계산: participatingStudyCount = 0 |
| total | Int | N | 거른 뒤 전체 수 (페이지와 무관) | 계산 |

정렬: 캡틴 → 네비게이터 → 나머지, 그 안에서 `participatingStudyCount` 내림차순, 같으면 `accountId` 오름차순.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `role` 값이 목록 밖 · `limit` 범위 밖 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |

### 프론트엔드 사용처

- back-office-front 유저 화면 (미구현) — 프로토: playground `console/users`

---

## 계정 권한 변경

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/users/{accountId}/system-role`
- **인증**: 필요 — `SYSTEM_ROLE = ADMIN`
- **설명**: 회원의 계정 권한을 캡틴(`ADMIN`) 또는 크루(`MEMBER`)로 바꾼다. 네비게이터는 계정 권한이 아니라 스터디별 명부 역할이라 여기서 다루지 않는다 — [분반·명단 스펙](../study-group/spec.md).

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| accountId | Long | 대상 계정 ID |

### Request Body

```json
{ "systemRole": "MEMBER" }
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| systemRole | String | Y | `ADMIN` · `MEMBER` |

### 서버 동작

1. 요청자 = 대상이면 409 `CANNOT_CHANGE_OWN_ROLE`.
2. `ADMIN` 계정 행들을 잠그고(`SELECT … FOR UPDATE`) 수를 센다. 대상이 마지막 `ADMIN` 인데 `MEMBER` 로 내리면 409 `LAST_ADMIN_REQUIRED`.
3. 같은 값이면 아무것도 바꾸지 않고 200.
4. 바꾼 권한은 대상의 **다음 로그인**부터 백오피스 접근에 반영된다 — [back-office-login](../back-office-login/spec.md). 이미 발급된 토큰은 만료까지 그대로다.

### Response — 200

```json
{ "accountId": 12, "systemRole": "MEMBER" }
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `systemRole` 누락 · 목록 밖 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 없는 계정 |
| 409 | CANNOT_CHANGE_OWN_ROLE | 자기 권한 변경 |
| 409 | LAST_ADMIN_REQUIRED | 마지막 캡틴을 크루로 내림 |

### 프론트엔드 사용처

- back-office-front 유저 화면 권한 칸 (미구현)

### 미확정

- [NEEDS CLARIFICATION] 코드의 Role 이름(`STUDENT` · `OPERATOR` · `ADMIN`)과 ERD 의 `MEMBER` · `ADMIN` 매핑 — 이 스펙은 ERD 값을 쓴다
- [NEEDS CLARIFICATION] 권한 변경 이력(누가 언제)을 남길지
- [NEEDS CLARIFICATION] 권한을 내린 즉시 기존 토큰을 끊을지 — 지금은 다음 로그인부터
- [NEEDS CLARIFICATION] 회원 목록의 이름 칸을 닉네임으로 할지 Google 이름으로 할지 (PRD 미확정) — 이 스펙은 닉네임
