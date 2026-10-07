# 참여 중단 · 다시 참여 (사용자 사이트) API Spec

> ERD: [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md)
> 정책: [POL-0001 역할과 권한](../../01-planning/_registry/policies/POL-0001-roles.md)
> 생성일: 2026-10-07
> 상태: 스펙작성중
>
> Story PRD:
> - [네비게이터는 참여자를 스터디에서 제명할 수 있다.](../../01-planning/stories/navigator-withdraw-participant/PRD.md)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| POST | /api/studies/{studyId}/participants/{participantId}/withdraw | 참여 중단 (`ACTIVE`·`PAUSED` → `WITHDRAWN`) | O (같은 분반 네비게이터 · 담당 캡틴) | 스펙작성중 |
| POST | /api/studies/{studyId}/participants/{participantId}/restore | 다시 참여 (`WITHDRAWN` → `ACTIVE`) | O (같은 분반 네비게이터 · 담당 캡틴) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

사용자 사이트 출석부에서 부른다. 백오피스용 명부 API([study-group](../study-group/spec.md))와 권한 판정이 달라 경로를 나눈다 ([endpoint-convention](../../docs/backend-development-guide/api/endpoint-convention.md)).

## 공통

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | `STUDY.ID` |
| participantId | Long | 명부 행 `STUDY_PARTICIPANT.ID` (계정 ID 가 아니다) |

### 권한

통과하는 호출자는 둘이다.

- **같은 분반의 네비게이터** — 호출자의 명부 행이 대상 행과 같은 분반이고, `PARTICIPANT_ROLE IN (LEADER, CO_LEADER)` 이며 살아 있다(`ACTIVE`·`PAUSED`). 출석 쓰기와 같은 분반 단위다 ([authz-guards](../authz-guards/spec.md) B — 타 분반 네비게이터 403). `CO_LEADER` 는 데이터 정리 전까지만 함께 본다 ([authz-guards](../authz-guards/spec.md) · [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md)). 정리 뒤에는 `LEADER` 만
- **담당 캡틴** — `STUDY.CREATED_BY = 호출자`. `CREATED_BY` 가 NULL 이면 캡틴(`ADMIN`) 누구나 ([POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md) — 신청 폼과 같은 규칙)

그 밖은 403. 크루로 참여한 다른 캡틴도 403 — 기존 스터디 단위 가드 `@RequireCaptainOrNavigator` 는 `ADMIN` 이면 누구나 통과시키므로 **쓰지 않는다**. 담당 캡틴은 `CREATED_BY` 로 판정한다.

서버에서 검증한다. 화면에서 버튼을 숨기는 것은 편의일 뿐이다.

### 판정 순서

권한 없는 호출자가 403 · 404 차이로 다른 스터디의 명부 행을 알아내지 못하게 아래 순서로 본다.

1. 401 — 로그인 안 함
2. 404 — 없는 스터디
3. 403 — 호출자가 이 스터디의 네비게이터 · 담당 캡틴이 아님
4. 404 — `participantId` 가 이 스터디의 명부 행이 아님
5. 403 — 대상이 다른 분반(네비게이터 호출자일 때)
6. 대상 제한 (아래)

### 대상 제한

| 대상 | 결과 |
|------|------|
| 나 자신 | 400 `CANNOT_WITHDRAW_SELF` — 스스로 그만두는 길은 따로다 |
| 네비게이터 행 (`LEADER` · `CO_LEADER`) | 403 `FORBIDDEN` — 운영진의 역할 · 참여는 백오피스에서 캡틴이 바꾼다 |
| 담당 캡틴의 명부 행 (`ACCOUNT_ID = STUDY.CREATED_BY`) | 403 `FORBIDDEN` — 같은 이유. `CREATED_BY` 가 NULL 이면 해당 없음 |
| `DELETED` (회원 탈퇴) · `COMPLETED` | 409 `PARTICIPANT_NOT_ACTIVE` — 되살리거나 바꾸지 않는다 |
| 끝난 스터디 (`STUDY.STATUS ∈ {ENDED, CLOSED}`) | 409 `STUDY_ENDED` |

### 사유

하차 · 제명을 가르지 않는다. 요청에 사유를 받지 않고, 저장하지도 않는다 ([출석부 PRD](../../01-planning/stories/navigator-edit-attendance/PRD.md) §2-1).

### 감사 로그

`who`(호출자 ACCOUNT_ID) · `participantId` · `action`(`WITHDRAW` · `RESTORE`) · `at`. 이름 · 이메일은 남기지 않는다. 멱등 호출(상태 그대로)도 남긴다.

---

## 참여 중단

### 기본 정보

- **Method**: POST
- **Path**: `/api/studies/{studyId}/participants/{participantId}/withdraw`
- **인증**: 필요 — 위 권한
- **설명**: 명부 행의 참여를 끝낸다. 출석 기록은 지우지 않는다.

### Request Body

없음.

### 서버 동작

- `STATUS = WITHDRAWN`, `LEFT_AT = now()` (UTC). 지난 날짜로 소급하지 않는다
- `STUDY_ATTENDANCE` 행은 지우지 않는다. `SCHEDULED_AT > LEFT_AT` 인 회차는 출석률 집계에서 빠진다 — 시각으로 견주므로 같은 날 뒤 회차도 빠진다. 산식은 [attendance spec](../attendance/spec.md) 의 `upper_bound` 그대로
- 앞으로의 발표자 배정은 그대로 둔다. 화면은 「이름 (참여 종료)」로 보이고 네비게이터가 바꾼다
- 이미 `WITHDRAWN` 이면 그대로 200 (멱등). `LEFT_AT` 을 덮어쓰지 않는다

### Response — 200

```json
{ "participantId": 41, "status": "WITHDRAWN", "leftAt": "2026-10-07T11:20:00Z" }
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| participantId | Long | N | 명부 행 ID | STUDY_PARTICIPANT.ID |
| status | String | N | `WITHDRAWN` | STUDY_PARTICIPANT.STATUS |
| leftAt | String | N | 참여 중단 시각(UTC, ISO-8601) | STUDY_PARTICIPANT.LEFT_AT |

### Error Responses

[공통 판정 순서 · 대상 제한](#판정-순서) · [Error Responses (공통)](#error-responses-공통).

### 프론트엔드 사용처

- `frontend/apps/playground/src/app/(proto)/proto/core/[locale]/my/joined/[id]/schedule/attendance/page.tsx` (프로토 — `// TODO(api)`)
- core-front 출석부 탭: 미정

---

## 다시 참여

### 기본 정보

- **Method**: POST
- **Path**: `/api/studies/{studyId}/participants/{participantId}/restore`
- **인증**: 필요 — 위 권한
- **설명**: 중단한 명부 행을 다시 활동 중으로 돌린다.

### Request Body

없음.

### 서버 동작

- `WITHDRAWN` 행만 바꾼다. `STATUS = ACTIVE`, `LEFT_AT = NULL`
- 중단해 있던 동안의 회차는 다시 출석률 분모 후보가 된다. 그 사이 출석 행이 없으면 미체크로 보인다 — 네비게이터가 체크한다
- 이미 `ACTIVE`·`PAUSED` 면 그대로 200 (멱등)

### Response — 200

```json
{ "participantId": 41, "status": "ACTIVE", "leftAt": null }
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| participantId | Long | N | 명부 행 ID | STUDY_PARTICIPANT.ID |
| status | String | N | `ACTIVE` (이미 `PAUSED` 였으면 `PAUSED`) | STUDY_PARTICIPANT.STATUS |
| leftAt | String | Y | 늘 null | STUDY_PARTICIPANT.LEFT_AT |

### Error Responses

[공통 판정 순서 · 대상 제한](#판정-순서) · [Error Responses (공통)](#error-responses-공통).

### 프론트엔드 사용처

- 위 「참여 중단」과 같은 화면

---

## Error Responses (공통)

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | CANNOT_WITHDRAW_SELF | 호출자 자신의 행 |
| 401 | UNAUTHORIZED | 로그인 안 함 |
| 403 | FORBIDDEN | 권한 없음 · 다른 분반 · 대상이 네비게이터 · 담당 캡틴 |
| 404 | NOT_FOUND | 없는 스터디 · 그 스터디의 명부 행이 아님 |
| 409 | PARTICIPANT_NOT_ACTIVE | 대상이 `DELETED` · `COMPLETED` |
| 409 | STUDY_ENDED | 스터디가 `ENDED` · `CLOSED` |

### 테스트 (통합)

- 성공: 같은 분반 네비게이터가 크루를 중단 → 200 · `LEFT_AT` 채워짐 · 출석 행 그대로
- 성공: 담당 캡틴이 다시 참여 → 200 · `LEFT_AT` NULL
- 멱등: 이미 `WITHDRAWN` 인 행을 다시 중단 → 200 · `LEFT_AT` 그대로
- 401 · 나 자신 400 `CANNOT_WITHDRAW_SELF` · 다른 분반 네비게이터 403 · 크루로 참여한 다른 캡틴 403 · 대상이 네비게이터 403 · 다른 스터디의 `participantId` 404 · 탈퇴 행 409 · 끝난 스터디 409 `STUDY_ENDED`

## 미확정

- [NEEDS CLARIFICATION] 중단당한 사람에게 알림(메일 · 디스코드 DM)을 보낼지. 지금은 보내지 않는다 — 네비게이터가 디스코드에서 말한다
- [NEEDS CLARIFICATION] 디스코드 채널 권한 회수. 지금은 링크(`discordChannelUrl`)만 감춘다 ([my-studies](../my-studies/spec.md) `relation = WITHDRAWN`)
- [NEEDS CLARIFICATION] 스스로 그만둔 사람을 네비게이터가 다시 참여시키는 것을 막을지 — 하차 · 제명을 가르지 않아 구분할 수 없다. 지금은 감사 로그로 추적한다
