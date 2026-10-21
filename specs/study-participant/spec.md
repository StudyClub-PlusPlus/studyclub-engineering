# 참여 중단 (사용자 사이트) API Spec

> ERD: [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md)
> 정책: [POL-0001 역할과 권한](../../01-planning/_registry/policies/POL-0001-roles.md)
> 생성일: 2026-10-07
> 상태: 구현완료
>
> Story PRD:
> - [네비게이터는 참여자를 스터디에서 제명할 수 있다.](../../01-planning/stories/navigator-withdraw-participant/PRD.md)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| POST | /api/me/studies/{studyId}/attendances | 출석 저장에 `withdrawals[]`(참여 중단) 추가 — 한 요청 · 한 트랜잭션 | O (같은 분반 네비게이터 · 담당 캡틴) | 구현완료 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

**새 엔드포인트를 만들지 않는다.** 출석부에서 참여 중단은 출석 고치기와 같은 「저장」으로 나간다 — 네비게이터가 칸을 고치고 사람을 「중단 예정」으로 둔 뒤 저장 한 번에 둘 다 반영한다 (2026-10-07 기획 결정). 그래서 기존 [출석 생성/수정 API](../attendance/spec.md#출석-생성수정-upsert) 의 요청에 필드를 하나 더한다. 둘을 따로 부르면 하나만 성공하는 경우를 화면이 설명해야 한다.

되돌리는 API(다시 참여)는 두지 않는다 (2026-10-07 기획 결정).

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
  "studyGroupId": 1,
  "updates": [
    { "meetingId": 4, "participantId": 23, "status": "PRESENT" }
  ],
  "withdrawals": [20, 21]
}
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| studyGroupId | Long | Y | 요청 분반. `withdrawals` 전원이 이 분반 소속이어야 한다 |
| updates | array | N | 기존 규칙 그대로. **`withdrawals` 가 있으면 빈 배열이어도 된다** |
| withdrawals | Long[] | N | 참여를 중단할 명부 행 `STUDY_PARTICIPANT.ID`. 중복·null 원소 → 400 |
| (둘 합쳐) | — | — | `updates` · `withdrawals` 가 모두 비면 400 |

> 기존 규칙 「`updates` 빈 배열 → 400」은 「`updates` · `withdrawals` 가 모두 비면 400」으로 바뀐다. `withdrawals` 를 보내지 않는 기존 호출은 결과가 같다.

### 권한

통과하는 호출자는 둘이다. `withdrawals` 가 있을 때 아래로 판정한다(`updates` 만 있으면 기존 출석 쓰기 권한).

- **같은 분반의 네비게이터** — 호출자의 명부 행이 대상 행과 같은 분반이고, `PARTICIPANT_ROLE = LEADER` 이며 살아 있다(`ACTIVE`·`PAUSED`). 출석 쓰기와 같은 분반 단위다 ([authz-guards](../authz-guards/spec.md) B — 타 분반 네비게이터 403). `CO_LEADER` 는 V35에서 `LEADER`로 정리되고 enum에서 제거됐다.
- **담당 캡틴** — `STUDY.CREATED_BY = 호출자`. `CREATED_BY` 가 NULL 이면 캡틴(`ADMIN`) 누구나 ([POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md))

그 밖은 403. 크루로 참여한 다른 캡틴도 403 — 스터디 단위 가드 `@RequireCaptainOrNavigator` 는 `ADMIN` 이면 누구나 통과시키므로 `withdrawals` 판정에는 **쓰지 않는다**. 담당 캡틴은 `CREATED_BY` 로 판정한다.

서버에서 검증한다. 화면에서 체크박스를 숨기는 것은 편의일 뿐이다.

### 판정 순서

권한 없는 호출자가 403 · 404 차이로 다른 스터디의 명부 행을 알아내지 못하게 아래 순서로 본다.

1. 401 — 로그인 안 함
2. 404 — 없는 스터디
3. 403 — 호출자가 이 스터디의 네비게이터 · 담당 캡틴이 아님
4. 400 — `withdrawals[]` 의 ID 가 이 스터디의 명부 행이 아님 (`updates[].participantId` 와 같은 규칙)
5. 400 — 대상이 요청한 분반 소속이 아님(사용자·관리자 경로 공통)
6. 대상 제한 (아래)

### 대상 제한 (`withdrawals[]` 각 항목)

| 대상 | 결과 |
|------|------|
| 나 자신 | 400 `CANNOT_WITHDRAW_SELF` — 스스로 그만두는 길은 따로다 |
| 네비게이터 행 (`LEADER`) | 403 `FORBIDDEN` — 운영진의 역할 · 참여는 백오피스에서 캡틴이 바꾼다 |
| 담당 캡틴의 명부 행 (`ACCOUNT_ID = STUDY.CREATED_BY`) | 403 `FORBIDDEN` — 같은 이유. `CREATED_BY` 가 NULL 이면 해당 없음 |
| `DELETED` (회원 탈퇴) · `COMPLETED` | 409 `PARTICIPANT_NOT_ACTIVE` |
| 끝난 스터디 (`STUDY.STATUS ∈ {ENDED, CLOSED}`) | 409 `STUDY_ENDED` |
| 이미 `WITHDRAWN` | 그대로 둔다(멱등). `LEFT_AT` 을 덮어쓰지 않는다 |

### 서버 동작

1. 요청 전체를 **한 트랜잭션**으로 묶는다. 하나라도 거절되면 출석도 중단도 반영하지 않는다
2. `updates[]` — 기존 출석 upsert 그대로
3. `withdrawals[]` — `STATUS = WITHDRAWN`, `LEFT_AT = now()` (UTC). 지난 날짜로 소급하지 않는다
4. 출석 행은 지우지 않는다. `SCHEDULED_AT > LEFT_AT` 인 회차는 출석률 집계에서 빠진다 — 시각으로 견주므로 같은 날 뒤 회차도 빠진다. 산식은 [attendance spec](../attendance/spec.md) 의 `upper_bound` 그대로
5. 같은 요청에서 중단 대상의 `LEFT_AT` 뒤 회차 칸을 고쳐도 저장은 하되 집계에서 빠진다
6. `SCHEDULED_AT > LEFT_AT`인 회차의 발표자1·2에서 중단자를 비운다. 이전 회차의 발표 기록과 다른 발표자는 유지한다 ([10-18 D7](../../docs/share/2026-10-18-schedule-attendance-feedback.md)).
7. 회차 수정·발표 신청과 같은 분반 잠금을 먼저 얻고 권한을 판정한 뒤 회차를 잠근다. 중단 시각은 잠금을 얻은 뒤 서버 시각이다. 같은 분반의 동시 저장은 순서대로 처리한다. 발표 신청·배정은 분반 잠금 후 명부도 잠금 조회해 MySQL REPEATABLE READ의 과거 스냅샷으로 중단자를 다시 배정하지 않는다.

관리자 경로 `POST /api/admin/studies/{studyId}/attendances`도 같은 요청·대상 제한·트랜잭션·잠금을 사용한다. 호출 권한은 기존 백오피스 규칙대로 `ADMIN`이다. 사용자 경로의 담당 캡틴 제한과 구분한다.

회원 탈퇴도 계정 잠금 후 소속 분반을 ID 오름차순으로 잠그고 명부를 잠금 조회한다. 참여 중단은 대상 명부를 잠금 조회한 뒤 상태를 판정한다. 중단이 먼저면 회원 탈퇴가 최초 `LEFT_AT`을 보존하며 `DELETED`로 전환하고, 탈퇴가 먼저면 중단은 409로 거절한다.

참여 중단 후 사용자 사이트 상세의 디스코드·드라이브 링크는 `null`이다. 크루로 참여한 다른 캡틴도 `ADMIN` 권한으로 우회하지 못한다. 다른 스터디의 권한에는 영향을 주지 않는다.

### 감사 로그

트랜잭션 커밋 후 `withdrawals[]` 마다 `who`(호출자 ACCOUNT_ID) · `participantId` · `action=WITHDRAW` · `at`. 이름 · 이메일은 남기지 않는다. 사유는 받지도 남기지도 않는다 — 하차 · 제명을 가르지 않는다 ([출석부 PRD](../../01-planning/stories/navigator-edit-attendance/PRD.md) §2-1).

### Response — 204 No Content

기존과 같다. 응답 바디 없음 — 화면은 명부를 다시 읽어 `participantStatus` · `leftAt` 을 받는다 ([출석 명부 조회](../attendance/spec.md#출석-명부-조회)).

### Error Responses

기존 [출석 upsert 오류](../attendance/spec.md#출석-생성수정-upsert)에 아래를 더한다.

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `updates` · `withdrawals` 가 모두 비었음 · `withdrawals` 중복 · 스터디·요청 분반 소속 아닌 명부 행 |
| 400 | CANNOT_WITHDRAW_SELF | 호출자 자신의 행 |
| 403 | FORBIDDEN | 권한 없음 · 대상이 네비게이터 · 담당 캡틴 |
| 409 | PARTICIPANT_NOT_ACTIVE | 대상이 `DELETED` · `COMPLETED` |
| 409 | STUDY_ENDED | 스터디가 `ENDED` · `CLOSED` |

### 테스트 (통합)

- 미래 회차 발표자 해제 · 지난 회차 기록 보존 · 다른 발표자 유지
- 사용자·관리자 경로 모두 다른 분반 대상 혼합 시 400 · 출석 미저장
- 발표 신청과 동시 실행해도 중단자가 미래 회차 발표자로 남지 않음

- 성공: 같은 분반 네비게이터가 `updates` 1건 + `withdrawals` 2건 → 204 · 출석 반영 · 두 행 `WITHDRAWN` · `LEFT_AT` 채워짐 · 출석 행 그대로
- 성공: `withdrawals` 만 (빈 `updates`) → 204
- 성공(기존 호환): `updates` 만 → 204, 명부 상태 변화 없음
- 멱등: 이미 `WITHDRAWN` 인 행 → 204 · `LEFT_AT` 그대로
- 원자성: `withdrawals` 한 건이 403 이면 같은 요청의 `updates` 도 반영되지 않음
- 401 · 둘 다 빔 400 · 나 자신 400 · 다른 분반 네비게이터 403 · 크루로 참여한 다른 캡틴 403 · 대상이 네비게이터 403 · 다른 스터디의 명부 행 400 · 탈퇴 행 409 · 끝난 스터디 409

### 프론트엔드 사용처

- `frontend/apps/playground/src/proto/console/components/AttendanceTab.tsx` 의 저장 (프로토 — `// TODO(api)`)
- `frontend/apps/core-front/src/components/AttendanceTabContent.tsx` → `lib/joined-detail-api.ts` (중단자 포함 재조회)

## 미확정

- [NEEDS CLARIFICATION] 중단당한 사람에게 알림(메일 · 디스코드 DM)을 보낼지. 지금은 보내지 않는다 — 네비게이터가 디스코드에서 말한다
- [NEEDS CLARIFICATION] 디스코드 채널 권한 회수. 지금은 링크(`discordChannelUrl`)만 감춘다 ([my-studies](../my-studies/spec.md) `relation = WITHDRAWN`)
- [NEEDS CLARIFICATION] 잘못 중단한 행을 되살리는 길 — 사용자 사이트에는 없다. 백오피스에 둘지 미정
