# 참여 중단 (출석부) API Spec

> ERD: [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md)
> 정책: [POL-0001 역할과 권한](../../01-planning/_registry/policies/POL-0001-roles.md)
> 생성일: 2026-10-07
> 상태: 구현완료 (2026-10-20)
> 갱신: 2026-10-22 — 서버 동작에 잠금 순서(분반 → 명부 행 → 회차)를 적었다. 회원 탈퇴 · 발표 신청도 같은 잠금을 쓴다 (#301 에서 옮겨 옴)
> 갱신: 2026-10-23 — 백오피스 경로도 `withdrawals[]` 를 받는다. 담당 캡틴만, 대상에 네비게이터도 (기획 결정 · 아래 「백오피스 경로」)
>
> Story PRD:
> - [네비게이터는 참여자를 스터디에서 제명할 수 있다.](../../01-planning/stories/navigator-withdraw-participant/PRD.md)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| POST | /api/me/studies/{studyId}/attendances | 출석 저장에 `withdrawals[]`(참여 중단) 추가 — 한 요청 · 한 트랜잭션 | O (같은 분반 네비게이터 · 담당 캡틴) | 구현완료 |
| POST | /api/admin/studies/{studyId}/attendances | 백오피스 출석 저장에 같은 `withdrawals[]` | O (담당 캡틴) | 구현완료 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

**새 엔드포인트를 만들지 않는다.** 출석부에서 참여 중단은 출석 고치기와 같은 「저장」으로 나간다 — 네비게이터가 칸을 고치고 사람을 「중단 예정」으로 둔 뒤 저장 한 번에 둘 다 반영한다 (2026-10-07 기획 결정). 그래서 기존 [출석 생성/수정 API](../attendance/spec.md#출석-생성수정-upsert) 의 요청에 필드를 하나 더한다. 둘을 따로 부르면 하나만 성공하는 경우를 화면이 설명해야 한다.

되돌리는 API(다시 참여)는 두지 않는다 (2026-10-07 기획 결정).

**경로**: 출석 API 가 사용자 사이트(`/api/me/…`) · 백오피스(`/api/admin/…`)로 나뉜 뒤(#241 · #244), `withdrawals[]` 는 처음에 사용자 사이트 경로에만 더했다 (2026-10-20). **2026-10-23 기획 결정**으로 백오피스 경로도 받는다 — 백오피스 출석부에서 담당 캡틴이 크루와 네비게이터의 참여를 중단시킨다. 두 경로는 **누가 · 누구를** 만 다르고 요청 · 판정 순서 · 잠금 · 감사 로그 · 이벤트는 같다.

| 경로 | 누가 | 누구를 |
|------|------|--------|
| `/api/me/…` (사용자 사이트) | 같은 분반 네비게이터 · 담당 캡틴 | 크루(`MEMBER`)만. 네비게이터 · 담당 캡틴 행은 403 |
| `/api/admin/…` (백오피스) | 담당 캡틴만 (다른 캡틴은 출석만 고친다) | 크루 · 네비게이터(`LEADER`). 담당 캡틴 자신은 400 `CANNOT_WITHDRAW_SELF` |

---

## 출석 저장 + 참여 중단

### 기본 정보

- **Method**: POST
- **Path**: `/api/me/studies/{studyId}/attendances`
- **인증**: 필요 — 아래 권한
- **설명**: 기존 출석 upsert 에 `withdrawals[]` 를 더한다. `updates[]` 만 보내면 지금과 똑같다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | `STUDY.ID` |

### Request Body

```json
{
  "studyGroupId": 7,
  "updates": [
    { "meetingId": 4, "participantId": 23, "status": "PRESENT" }
  ],
  "withdrawals": [20, 21]
}
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| studyGroupId | Long | Y | 기존 규칙 그대로 — 출석을 기록할 분반. 네비게이터는 이 분반의 행만 중단할 수 있다 |
| updates | array | N | 기존 규칙 그대로. **`withdrawals` 가 있으면 빈 배열이어도 된다** |
| withdrawals | Long[] | N | 참여를 중단할 명부 행 `STUDY_PARTICIPANT.ID`. 중복 → 400 |
| (둘 합쳐) | — | — | `updates` · `withdrawals` 가 모두 비면 400 |

> 기존 규칙 「`updates` 빈 배열 → 400」은 「`updates` · `withdrawals` 가 모두 비면 400」으로 바뀐다. `withdrawals` 를 보내지 않는 기존 호출은 결과가 같다.

### 권한

통과하는 호출자는 둘이다. `withdrawals` 가 있을 때 아래로 판정한다(`updates` 만 있으면 기존 출석 쓰기 권한).

- **같은 분반의 네비게이터** — 호출자의 명부 행이 요청의 `studyGroupId` 분반에 있고, `PARTICIPANT_ROLE = LEADER` 이며 살아 있다(`ACTIVE`·`PAUSED`). 출석 쓰기와 같은 분반 단위다 ([authz-guards](../authz-guards/spec.md) B — 타 분반 네비게이터 403). `CO_LEADER` 는 2026-10-09 에 없앴다 ([POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md))
- **담당 캡틴** — `STUDY.CREATED_BY = 호출자`. `CREATED_BY` 가 NULL 이면 캡틴(`ADMIN`) 누구나 ([POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md))

그 밖은 403. 크루로 참여한 다른 캡틴도 403 — 스터디 단위 가드 `@RequireCaptainOrNavigator` 는 `ADMIN` 이면 누구나 통과시키므로 `withdrawals` 판정에는 **쓰지 않는다**. 담당 캡틴은 `CREATED_BY` 로 판정한다.

서버에서 검증한다. 화면에서 체크박스를 숨기는 것은 편의일 뿐이다.

### 백오피스 경로 (2026-10-23 기획 결정)

- **호출자**: `@RequireAdmin`(캡틴) 을 지난 뒤, `withdrawals` 가 있으면 **담당 캡틴**만 — `STUDY.CREATED_BY = 호출자`, `CREATED_BY` 가 NULL 이면 캡틴 누구나(위 사용자 사이트와 같은 판정, `StudyCaptainGuard.assertOwnerCaptain`). 그 밖의 캡틴은 403 — 출석만 고치는 요청은 지금처럼 캡틴 누구나 된다
- **분반**: 담당 캡틴이라 요청의 `studyGroupId` 와 다른 분반의 행도 중단한다(사용자 사이트의 담당 캡틴과 같다)
- **대상**: 네비게이터(`LEADER`) 행도 된다. 나머지 제한은 그대로 — 나 자신 400 · 담당 캡틴의 명부 행 403(호출자가 담당 캡틴이라 실제로는 「나 자신」이 먼저 걸린다. `CREATED_BY` NULL 이면 해당 없음) · `DELETED`·`COMPLETED` 409 · 끝난 스터디 409 · 이미 `WITHDRAWN` 멱등
- **판정 순서 · 잠금 · 감사 로그 · 이벤트**: 아래 그대로 (`ParticipantWithdrawalService.prepareForBackOffice`)
- **디스코드**: 스터디 role 은 `study_participant.withdrawn` 구독자(DSC-09)가 뗀다. 중단된 사람이 네비게이터(`participantRole = LEADER`)면 같은 구독자가 navigator role 도 맞춘다 — 다른 진행 중 스터디에서 LEADER 면 유지, 아니면 회수 (DSC-09)
- 네비게이터를 중단하면 그 분반에 네비게이터가 없을 수 있다. 서버는 막지 않는다 — 새 네비게이터는 신청자 탭에서 캡틴이 정한다
- **중단된 네비게이터의 권한**: 행은 `WITHDRAWN` · `LEADER` 로 남는다 — 역할을 `MEMBER` 로 내리지 않는다(이벤트가 중단 직전 역할을 실어야 DSC-09 가 네비게이터 role 을 뗀다). 대신 네비게이터 권한은 **살아 있는 명부 행(`ACTIVE` · `PAUSED`)의 `LEADER`** 에만 준다 — 사이트 출석 저장 · 출석부 · 회차 추가 · 수정 · 삭제 · 비공개 상세 모두 403 / 404 (`StudyCaptainGuard`, 2026-10-24 #325 리뷰)

### 판정 순서

권한 없는 호출자가 403 · 404 차이로 다른 스터디의 명부 행을 알아내지 못하게 아래 순서로 본다.

1. 401 — 로그인 안 함
2. 404 — 없는 스터디
3. 403 — 호출자가 이 스터디의 네비게이터 · 담당 캡틴이 아님
4. 400 — `withdrawals[]` 의 ID 가 이 스터디의 명부 행이 아님 (`updates[].participantId` 와 같은 규칙)
5. 403 — 대상이 다른 분반(네비게이터 호출자일 때)
6. 대상 제한 (아래)

### 대상 제한 (`withdrawals[]` 각 항목)

| 대상 | 결과 |
|------|------|
| 나 자신 | 400 `CANNOT_WITHDRAW_SELF` — 스스로 그만두는 길은 따로다 |
| 네비게이터 행 (`LEADER`) | 사용자 사이트: 403 `FORBIDDEN` — 운영진의 참여는 백오피스에서 담당 캡틴이 중단한다. 백오피스: 중단한다 (2026-10-23) |
| 담당 캡틴의 명부 행 (`ACCOUNT_ID = STUDY.CREATED_BY`) | 403 `FORBIDDEN` — 같은 이유. `CREATED_BY` 가 NULL 이면 해당 없음 |
| `DELETED` (회원 탈퇴) · `COMPLETED` | 409 `PARTICIPANT_NOT_ACTIVE` |
| 끝난 스터디 (`STUDY.STATUS ∈ {ENDED, CLOSED}`) | 409 `STUDY_ENDED` |
| 이미 `WITHDRAWN` | 그대로 둔다(멱등). `LEFT_AT` 을 덮어쓰지 않는다 |

### 서버 동작

1. 요청 전체를 **한 트랜잭션**으로 묶는다. 하나라도 거절되면 출석도 중단도 반영하지 않는다
   - **잠금**: 트랜잭션의 첫 조회로 **이 스터디의 분반을 모두** ID 오름차순으로 잠근다(`FOR UPDATE`) — 담당 캡틴은 다른 분반 행도 중단하므로 대상이 어느 분반인지 미리 알 수 없다. 이어 중단 대상 명부 행, 요청한 분반 · 대상 분반의 회차를 잠그고 읽는다. 회차 수정 · 발표 신청 · 회원 탈퇴가 같은 분반 잠금과 같은 명부 행 잠금을 쓴다 — 동시에 들어온 발표 신청이 중단자를 다시 넣지 못하고, 회원 탈퇴의 `DELETED` 와 중단의 `LEFT_AT` 이 서로를 덮어쓰지 않는다 ([share D7](../../docs/share/2026-10-18-schedule-attendance-feedback.md), [회차 스펙 「잠금」](../study-meeting/spec.md))
   - `LEFT_AT` 은 잠금을 얻은 **뒤**의 서버 시각이다. 발표자를 비울 회차도 잠근 뒤에 「시작했는지」 판정한다 — 디스코드 출석이 같은 회차 잠금으로 회차를 시작한다
2. `updates[]` — 기존 출석 upsert 그대로
3. `withdrawals[]` — `STATUS = WITHDRAWN`, `LEFT_AT = now()` (UTC). 지난 날짜로 소급하지 않는다
4. 출석 행은 지우지 않는다. `SCHEDULED_AT > LEFT_AT` 인 회차는 출석률 집계에서 빠진다 — 시각으로 견주므로 같은 날 뒤 회차도 빠진다. 산식은 [attendance spec](../attendance/spec.md) 의 `upper_bound` 그대로
5. 같은 요청에서 중단 대상의 `LEFT_AT` 뒤 회차 칸을 고쳐도 저장은 하되 집계에서 빠진다
6. 이번에 중단된 행이 맡은 **중단 시각 뒤에 시작하는 회차**의 발표자1 · 2 칸을 비운다. 이미 시작한 회차의 발표 기록은 남는다 ([share D7](../../docs/share/2026-10-18-schedule-attendance-feedback.md), 2026-10-20 반영)
7. 이번에 중단된 행마다 도메인 이벤트 `study_participant.withdrawn` 을 발행한다 — 커밋 뒤 구독자가 받는다 ([domain-events](../domain-events/spec.md)). 이미 중단된 행은 발행하지 않는다. 디스코드 스터디 role 회수(DSC-09)가 듣는다

### 감사 로그

이번에 중단된 행마다 [ADMIN_AUDIT_LOG](../../docs/erd/ADMIN_AUDIT_LOG.md) 한 줄 — `ACTION = WITHDRAW` · `ACTOR` = 호출자 · `TARGET` = 중단된 사람 · `BEFORE` = 중단 직전 상태 · `AFTER` = 명부 행 ID · 시각. 출석 저장과 **같은 트랜잭션**이다. 이미 중단된 행은 남기지 않는다. 이름 · 이메일은 남기지 않는다. 사유는 받지도 남기지도 않는다 — 하차 · 제명을 가르지 않는다 ([출석부 PRD](../../01-planning/stories/navigator-edit-attendance/PRD.md) §2-1).

### Response — 204 No Content

기존과 같다. 응답 바디 없음 — 화면은 명부를 다시 읽어 `participantStatus` · `leftAt` 을 받는다 ([출석 명부 조회](../attendance/spec.md#출석-명부-조회)).

### Error Responses

기존 [출석 upsert 오류](../attendance/spec.md#출석-생성수정-upsert)에 아래를 더한다.

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `updates` · `withdrawals` 가 모두 비었음 · `withdrawals` 중복 · 스터디 소속 아닌 명부 행 |
| 400 | CANNOT_WITHDRAW_SELF | 호출자 자신의 행 |
| 403 | FORBIDDEN | 권한 없음(백오피스는 담당 캡틴이 아님) · 다른 분반 · 대상이 네비게이터(사용자 사이트만) · 담당 캡틴 |
| 409 | PARTICIPANT_NOT_ACTIVE | 대상이 `DELETED` · `COMPLETED` |
| 409 | STUDY_ENDED | 스터디가 `ENDED` · `CLOSED` |

### 테스트 (통합)

- 성공: 같은 분반 네비게이터가 `updates` 1건 + `withdrawals` 2건 → 204 · 출석 반영 · 두 행 `WITHDRAWN` · `LEFT_AT` 채워짐 · 출석 행 그대로
- 성공: `withdrawals` 만 (빈 `updates`) → 204
- 성공(기존 호환): `updates` 만 → 204, 명부 상태 변화 없음
- 멱등: 이미 `WITHDRAWN` 인 행 → 204 · `LEFT_AT` 그대로
- 원자성: `withdrawals` 한 건이 403 이면 같은 요청의 `updates` 도 반영되지 않음
- 401 · 둘 다 빔 400 · 나 자신 400 · 다른 분반 네비게이터 403 · 크루로 참여한 다른 캡틴 403 · 대상이 네비게이터 403 · 다른 스터디의 명부 행 400 · 탈퇴 행 409 · 끝난 스터디 409
- 백오피스(`AdminAttendanceIntegrationTest`): 담당 캡틴이 크루 · 네비게이터(다른 분반 포함) 중단 → 204 · 감사 로그 · 이벤트 · `CREATED_BY` NULL 이면 다른 캡틴도 204 · 담당 아닌 캡틴: 출석만 204, 중단 섞이면 403 + 출석 미반영 · 나 자신 400 · 탈퇴 행 409 · 끝난 스터디 409 · 다른 스터디 행 400 · 사용자 사이트는 여전히 네비게이터 대상 403

### 프론트엔드 사용처

- `frontend/apps/playground/src/proto/console/components/AttendanceTab.tsx` 의 저장 (프로토 — `// TODO(api)`)
- `frontend/apps/core-front/src/lib/joined-detail-api.ts` · `AttendanceTabContent.tsx` — 사용자 사이트 출석 탭 저장
- `frontend/apps/back-office-front/src/features/attendance/` — 백오피스 출석 탭 저장 (담당 캡틴이 아니면 서버 403 을 그대로 보여 준다). 네비게이터는 화면에서 참여 중단을 잠근다 — 신청자 탭에서 권한을 회수한 뒤 중단한다 (2026-10-24, [출석부 PRD](../../01-planning/stories/captain-view-attendance-roster/PRD.md) 개발 범위)

## 퍼널·계측

해당 없음 — 참여 중단에 분석 이벤트가 없다. 크루가 신청을 취소하는 `My Application Cancelled` 와는 다른 흐름이다.

## 미확정

- [NEEDS CLARIFICATION] 중단당한 사람에게 알림(메일 · 디스코드 DM)을 보낼지. 지금은 보내지 않는다 — 네비게이터가 디스코드에서 말한다
- 디스코드 채널 권한 회수 — `study_participant.withdrawn` 이벤트를 디스코드 쪽 구독자가 받아 스터디 role 을 뗀다 (DSC-09). 중단된 사람이 네비게이터면 navigator role 도 맞춘다. 링크(`discordChannelUrl`)는 `WITHDRAWN` 이면 감춘다 ([my-studies](../my-studies/spec.md) `relation = WITHDRAWN`)
- [NEEDS CLARIFICATION] 잘못 중단한 행을 되살리는 길 — 사용자 사이트에는 없다. 백오피스에 둘지 미정
