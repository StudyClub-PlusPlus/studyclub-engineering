# 행사 상태 전환 API Spec: 모집 마감 · 재모집 · 행사 취소

> ERD: 행사 테이블은 [event 스펙 「데이터 모델 제안」](../event/spec.md#데이터-모델-제안) (`CLUB_EVENT`, PR #478 의 V59 에서 생성 중). 신청 테이블은 [event-participant 스펙 「데이터 모델 제안」](../event-participant/spec.md#데이터-모델-제안-club_event_registration). `docs/erd/` 정본은 스펙 확정 뒤 구현 PR 에서 만든다
> 생성일: 2026-11-18
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 행사를 등록하고 신청자의 참가를 확정할 수 있다](../../01-planning/stories/captain-manage-events/PRD.md) (ST-037) §1 「행사 관리」
>
> 기준 스펙: [event](../event/spec.md) — 「상태」 · 「같은 행사에 쓰는 요청의 처리 순서」 · 「동시 수정 방지: 버전」(N3) · 「수정할 수 있는 범위」를 그대로 따른다
> 기준 프로토타입: playground `/proto/console/events/{id}` (`EventAdminDetail.tsx` 머리의 `모집 마감` · `모집 다시 열기` · `행사 취소`)
> 판정 로직의 근거: `frontend/apps/playground/src/proto/events/model.ts` `transition` 의 `STATUS` 분기 · `eventStatus` · `canManageEventRegistrations`
> 함께 읽을 스펙: [event-participant](../event-participant/spec.md) (취소가 바꾸는 신청 상태) · [event-mail](../event-mail/spec.md) (취소 뒤 보내는 취소 안내 메일)

## 엔드포인트 목록

**백오피스: `/api/admin/events/{eventId}/status` (`AdminClubEventStatusController` 제안, 캡틴만)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| PATCH | /api/admin/events/{eventId}/status | 모집 마감(`CLOSED`) · 재모집(`PUBLISHED`) · 행사 취소(`CANCELLED`) 중 하나로 저장 상태를 바꾼다. 취소는 유효 신청을 같은 트랜잭션에서 취소하고 취소 안내 대상을 보존한다 | O (ADMIN) | 스펙작성중 |

이 스펙은 [event](../event/spec.md) 의 `GET /api/admin/events/{eventId}` 응답에 판정 필드 여섯 개를 **추가**한다 (아래 「운영 상세에 더하는 판정 필드」). 경로가 새로 생기지 않아 위 표에는 넣지 않았다.

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 먼저 읽을 것

### 이 스펙이 다루는 것과 안 다루는 것

| 다룬다 | 다루지 않는다 | 닿는 곳 |
|---|---|---|
| 저장 상태 `CLUB_EVENT.STATUS` 의 세 전환 · 버전 증가 · 취소 때 신청 일괄 취소와 취소 안내 대상 보존 · 운영 상세의 전환 가능 여부 판정 | 행사 등록·수정 ([event](../event/spec.md)) | `version` 비교, 잠금 순서, `displayStatus` 계산 |
| | 참가자 개별 처리 · 종료 자동 전환 ([event-participant](../event-participant/spec.md)) | 취소가 쓰는 `CANCEL_REASON = EVENT_CANCELLED` |
| | 취소 안내 메일 작성·발송 ([event-mail](../event-mail/spec.md)) | 취소 안내 대상(`hasCancellationRecipients`)의 정의 |
| | 크루 신청·본인 취소·사이트 표시 (ST-038, [crew-apply-event](../../01-planning/stories/crew-apply-event/PRD.md)) | 모집 마감 뒤에도 신청 마감 전까지 본인 취소 허용 (crew-apply-event §4) |

### 인가

- [event 「인가」](../event/spec.md#인가) 와 같다. `@RequireAdmin` 으로 캡틴(`SYSTEM_ROLE = ADMIN`)만. 토큰 없으면 401, ADMIN 아니면 403
- 401 · 403 을 404 보다 먼저 본다. 없는 `eventId` 로 크루가 불러도 403 이다
- 버튼 숨김은 표시용이다. 서버가 요청마다 아래 처리 순서로 다시 판정한다

### 시각

- 응답의 모든 절대 시각은 UTC ISO 8601 (`2026-12-05T10:00:00Z`)
- 시각이 걸린 판정(종료 · 신청 마감 · 시작)은 서버 시각 `Instant.now()` 로 한다 ([판정은 서버가 내려준다](../../docs/backend-development-guide/api/endpoint-convention.md#판정은-서버가-내려준다))
- `effectiveEndsAt` 은 [event 「상태」](../event/spec.md#상태-저장-상태와-표시-상태를-나눈다) 의 정의 그대로다 (`ENDS_AT`, 없으면 행사 기준 시간대의 시작일 다음 날 00:00)

### 경로를 이렇게 정한 이유

| 후보 | 판단 |
|---|---|
| **`PATCH /api/admin/events/{eventId}/status`** (채택) | 저장 상태라는 **하위 리소스 하나**를 부분 수정한다. 레포 선례 `PATCH /api/admin/users/{accountId}/system-role` ([admin-users](../admin-users/spec.md)) 와 같은 모양이다. 동사 경로(`/close`, `/cancel`)를 만들지 않는다 ([endpoint-convention 「URL 구조」](../../docs/backend-development-guide/api/endpoint-convention.md#url-구조)) |
| `PATCH /api/admin/events/{eventId}` 에 `status` 를 섞기 | 같은 리소스의 `PUT` 이 편집 폼 전체 교체이고 `STATUS` 를 바꾸지 않는다고 이미 정했다 ([event 「행사 수정」](../event/spec.md#행사-수정)). 한 경로에 두 의미가 섞이면 검증·버전 규칙이 갈린다 |
| `POST /api/admin/events/{eventId}/cancellations` | 취소만 따로 떼면 같은 잠금·버전 규칙을 두 곳에 적어야 한다. 세 전환은 처리 순서 1~4 가 같다 |

---

## 상태 전환

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/events/{eventId}/status`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 저장 상태를 요청한 값으로 바꾼다. `STATUS` 가 실제로 바뀌면 `VERSION` 을 1 올린다 (event N3)

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters

없음

### Request Body

```json
{ "status": "CANCELLED", "version": 3 }
```

| 필드 | 타입 | 필수 | 검증 | 근거 |
|------|------|------|------|------|
| status | String | Y | `CLOSED` · `PUBLISHED` · `CANCELLED` 중 하나 | PRD §1 「모집 마감·모집 다시 열기·행사 취소」, `model.ts` `transition` STATUS 「지원하지 않는 행사 상태」 |
| version | Long | Y | 0 이상. 운영 상세(`GET /api/admin/events/{eventId}`)에서 받은 `version` | event N3 · Q14 |

**`version` 을 받는 이유 (event N3).** 상태 전환은 행사 행을 바꾸므로 `STATUS` 가 실제로 바뀔 때 `VERSION` 을 올린다. 그래서 다른 캡틴이 모집을 마감·취소한 뒤 이전 버전으로 편집하던 캡틴의 `PUT` 은 409 `EVENT_VERSION_CONFLICT` 로 막힌다. 반대 방향도 같다: 상태를 바꾸려는 캡틴이 보고 있던 화면이 낡았으면(그사이 다른 캡틴이 행사 정보를 저장했거나 상태를 바꿨으면) 이 요청도 409 로 막고, 화면은 최신 상세를 다시 불러와 확인창을 다시 띄운다. 「무엇을 보고 결정했는가」를 서버가 확인하는 값이다.

### 전이표

| 지금 (저장 상태) | → `CLOSED` (모집 마감) | → `PUBLISHED` (재모집) | → `CANCELLED` (행사 취소) |
|---|---|---|---|
| `PUBLISHED` | 허용 | 변화 없음 (아래 「같은 상태로 바꾸기」) | 허용 |
| `CLOSED` | 변화 없음 | `now < DEADLINE_AT` 일 때만 허용 | 허용 |
| `CANCELLED` | 409 `EVENT_CANCELLED` | 409 `EVENT_CANCELLED` | 409 `EVENT_CANCELLED` |
| 종료 (`now ≥ effectiveEndsAt`, 저장 상태 무관) | 409 `EVENT_ENDED` | 409 `EVENT_ENDED` | 409 `EVENT_ENDED` |

- 행사 취소는 되돌릴 수 없다 (PRD §1 「취소된 행사는 모집 상태를 변경할 수 없음」, event 「상태」 `CANCELLED` 「읽기 전용, 되돌릴 수 없다」)
- 종료된 행사는 세 전환 모두 불가 (PRD §1 「종료된 행사는 행사 취소·모집 마감·재모집 처리 불가」, `transition` 「종료된 행사는 취소하거나 모집 상태를 변경할 수 없습니다」)
- 모집 마감은 신청 마감·행사 시작 이후에도 종료 전이면 허용한다. 프로토는 `PUBLISHED` 이고 종료 전이면 `모집 마감` 버튼을 보인다 (`EventAdminDetail` 머리 버튼 조건 `!finished && status === 'PUBLISHED'`). 신청 마감 뒤라 `displayStatus` 는 이미 `RECRUITMENT_CLOSED` 지만 저장 상태를 맞춰 두는 것은 막지 않는다
- 재모집은 `CLOSED` 에서만 의미가 있다. 정원이 다 찼어도 `PUBLISHED` 로 저장하며 계산된 `displayStatus` 는 `FULL` 이 된다 ([event 「상태」](../event/spec.md#상태-저장-상태와-표시-상태를-나눈다): `FULL` 은 저장하지 않고 요청마다 계산)

### 처리 순서

인가(401 · 403)와 본문 검증(400)을 통과한 뒤, **한 트랜잭션**에서 아래 순서로 처리한다. 먼저 걸리는 것 하나만 응답하고, 실패하면 아무것도 바꾸지 않는다.

| # | 단계 | 실패 | 근거 |
|---|---|---|---|
| 1 | `CLUB_EVENT` 행을 쓰기 잠금으로 읽는다 (`SELECT … FOR UPDATE`, **트랜잭션의 첫 조회**, `ClubEventRepository.findByIdForUpdate`). 없으면 | 404 `NOT_FOUND` | [event 「같은 행사에 쓰는 요청의 처리 순서」](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서) — 상태 전환은 이 잠금을 잡는 요청으로 이미 등록되어 있다 |
| 2 | 잠금 뒤 읽은 `STATUS = CANCELLED` | 409 `EVENT_CANCELLED` | PRD §1, `transition` 「취소된 행사는 모집 상태를 변경할 수 없습니다」 |
| 3 | 잠금 뒤 읽은 값으로 `now ≥ effectiveEndsAt` | 409 `EVENT_ENDED` | PRD §1, `transition` 「종료된 행사는…」 |
| 4 | 요청 `status` 가 지금 저장 상태와 같다 (`PUBLISHED → PUBLISHED`, `CLOSED → CLOSED`) | 200, 아무것도 바꾸지 않고 `VERSION` 도 그대로 (권장안 — 미확정 S1) | event N3 「이미 그 상태라서 바뀌는 것이 없으면 올리지 않는다」 |
| 5 | 요청 `version` ≠ 저장된 `VERSION` | 409 `EVENT_VERSION_CONFLICT` | event N3 · Q14 |
| 6 | 재모집(`→ PUBLISHED`)인데 `now ≥ STARTS_AT` | 409 `EVENT_ALREADY_STARTED` | `EventAdminDetail` `changeStatus` 「이미 시작한 행사에는 새 신청을 받을 수 없어요」 |
| 7 | 재모집(`→ PUBLISHED`)인데 `now ≥ DEADLINE_AT` | 409 `EVENT_REOPEN_DEADLINE_PASSED` | PRD §1 「신청 마감 시각이 지난 행사는 모집을 다시 열 수 없는 이유를 안내」 · §2 「재모집 시 미래 마감시간 필요」, `transition` 「신청 마감시간을 현재보다 늦게 설정해 주세요」 |
| 8 | 행사 취소(`→ CANCELLED`)면 그 행사의 `PENDING` · `CONFIRMED` 신청을 전부 `CANCELLED` 로 바꾸고 `CANCEL_REASON = EVENT_CANCELLED` 를 적는다. 조건부 갱신(`WHERE CLUB_EVENT_ID = ? AND STATUS IN ('PENDING','CONFIRMED')`)으로 바꾼 행 수를 센다 | — | PRD §1 「확인 대기·참가 확정 신청도 취소. 취소 직전 대상자를 보존」, `transition` STATUS CANCELLED |
| 9 | `STATUS` 를 요청 값으로 바꾸고 `VERSION` 을 1 올린다 | — | event N3 |
| 10 | 커밋한다. **자동 메일은 만들지 않는다** (아래 「취소와 메일」) | — | `transition` STATUS 는 `appendAutomaticEventMail` 을 부르지 않는다 |

- 6 이 7 보다 먼저다. 시작한 행사는 신청 마감도 지났지만(`DEADLINE_AT ≤ STARTS_AT`) 화면이 할 수 있는 일이 다르다: 마감이 지났을 뿐이면 「행사 정보·신청폼에서 신청 마감 시간을 미래로 바꾼 뒤 다시 열어 주세요」, 시작했으면 시작 시각을 미래로 옮길 수 없으므로(event `EVENT_START_LOCKED`) 「새 신청을 받을 수 없어요」로 끝난다 (`EventAdminDetail` `changeStatus` 두 문구)
- 재모집 때 행사 값 전체(`validateEvent`)를 다시 검사하지 않는다. 프로토는 재모집에서 `validateEvent` 를 다시 돌리지만, 서버에 저장된 값은 등록·수정에서 이미 같은 검증을 통과했고 그 뒤 바뀌는 것은 시각뿐이다. 시각이 걸린 조건은 6·7 이 본다
- 재모집은 `PUBLISHED_AT` 을 바꾸지 않는다. 등록할 때 이미 채워진다 (event 「행사 등록」 `PUBLISHED_AT = now`. 프로토 `publishedAt ??=` 도 비어 있을 때만 채운다)
- 8 의 신청 수는 1 의 잠금을 얻은 뒤 센다. 크루 신청 제출 · 운영진의 참가자 처리 · 종료 자동 처리도 같은 잠금을 먼저 잡으므로 취소와 한 줄로 선다 (event Q8). 그래서 취소 트랜잭션이 바꾸는 신청 집합이 곧 「취소 직전의 확인 대기·참가 확정 신청자」다
- 4 를 5 보다 먼저 두는 이유: 두 캡틴이 거의 동시에 `모집 마감` 을 누르거나 응답을 못 받은 요청을 다시 보내면, 먼저 처리된 요청이 버전을 올려 두 번째 요청은 버전이 낡는다. 결과가 이미 원하는 상태인데 409 를 주면 화면이 할 일이 없다. 대신 응답의 `version` 은 최신 값이므로 화면은 그 값으로 상태를 맞춘다

### 같은 상태로 바꾸기 (권장안, 미확정 S1)

| 요청 | 결과 | 이유 |
|---|---|---|
| `PUBLISHED` 인 행사를 `PUBLISHED` 로 | 200, 변화 없음, 버전 그대로 | event N3 은 「바뀌는 것이 없으면 올리지 않는다」고 적어 같은 상태 요청을 실패로 보지 않는다 |
| `CLOSED` 인 행사를 `CLOSED` 로 | 200, 변화 없음, 버전 그대로 | 같은 이유. 별도 코드 `EVENT_ALREADY_CLOSED` 를 두면 화면은 결국 상세를 다시 그릴 뿐이라 행동이 다르지 않다 ([exception-handling-guide 「코드를 늘리기 전에 한 번 묻는다」](../../docs/backend-development-guide/exception-handling-guide.md#errorcode)) |
| `CANCELLED` 인 행사를 `CANCELLED` 로 | 409 `EVENT_CANCELLED` (2 에서 먼저 걸린다) | 취소된 행사는 모든 전환을 막는다는 PRD 규칙을 그대로 쓴다. 응답을 못 받은 취소 재시도도 409 를 받지만, 화면은 409 `EVENT_CANCELLED` 를 받으면 상세를 다시 불러와 `hasCancellationRecipients` 로 취소 안내 작성 창을 열 수 있다 |

### 행사 취소가 신청에 하는 일

| 취소 직전 신청 상태 | 취소 뒤 | `CANCEL_REASON` | 취소 안내 메일 대상 |
|---|---|---|---|
| `PENDING` (확인 대기) | `CANCELLED` | `EVENT_CANCELLED` | 대상 |
| `CONFIRMED` (참가 확정) | `CANCELLED` | `EVENT_CANCELLED` | 대상 |
| `DECLINED` (참가 불가) | 그대로 | 그대로 (NULL) | 제외 |
| `CANCELLED` (본인 취소 · 운영진 개별 취소) | 그대로 | 그대로 (`SELF_CANCELLED` · `ADMIN_CANCELLED`) | 제외 |

- PRD §1 「새로고침 후에도 취소 직전 대상자를 유지하고 이전 개별 취소·참가 불가자는 제외」를 **신청 행의 `CANCEL_REASON` 하나로** 지킨다. 취소 안내 대상 = 그 행사의 `STATUS = CANCELLED ∧ CANCEL_REASON = EVENT_CANCELLED` 인 신청
- 별도 대상 테이블(`EVENT_CANCELLATION_TARGET`)이나 행사 행의 ID 목록(프로토 `cancellationRecipientIds`)을 두지 않는 이유: 취소된 행사는 이후 어떤 요청도 신청 상태를 바꾸지 못한다 (참가자 처리 · 종료 자동 처리 · 크루 신청·취소 모두 `EVENT_CANCELLED` 로 막힌다). 그래서 이 조건으로 다시 세어도 집합이 변하지 않는다. 같은 사실을 두 곳에 두면 어긋날 수 있다
- `CANCEL_REASON` 값 목록과 컬럼 정의는 [event-participant 「데이터 모델 제안」](../event-participant/spec.md#데이터-모델-제안-club_event_registration) 이 정본이다. 크루 본인 취소의 `SELF_CANCELLED` 는 ST-038 신청 스펙이 같은 컬럼에 쓴다
- 바꾸는 쿼리는 행사 애그리거트가 신청 애그리거트에 시키는 일이라 `ClubEventRegistrationPort` 에 메서드를 더한다 (PR #478 에서 추가 중인 포트): `int cancelActiveRegistrationsForEventCancellation(Long eventId)` — 바꾼 행 수를 돌려준다. 취소 안내 대상 수는 `int countCancellationRecipients(Long eventId)`. 둘 다 행사 행 잠금을 잡은 트랜잭션 안에서 부르거나(전자), 읽기 전용으로 부른다(후자)

### 취소와 메일

- **행사 전체 취소는 신청별 자동 메일(`EVENT_REGISTRATION_CANCELLED`)을 만들지 않는다.** 취소 직후 운영 상세가 취소 안내 메일 작성 창을 열고, 캡틴이 `EVENT_CANCELLATION` 취소 안내 메일을 직접 보낸다 (PRD §1 「대상자가 있을 때 취소 안내 메일 작성 창을 바로 표시」 · 「별도 행사 취소 안내 템플릿의 기본 문구를 수정·미리보기한 뒤 운영자가 발송」). 프로토 `transition` STATUS 분기도 자동 메일을 쌓지 않는다
- 개별 취소(운영진 · 본인)는 자동 메일을 보낸다. 그 차이는 [event-participant](../event-participant/spec.md) · [event-mail](../event-mail/spec.md) 「자동 메일」 표에 있다
- 작성 창을 닫아도 행사·신청 취소는 그대로다 (PRD §1 「작성 창을 닫아도 행사와 신청의 취소 상태는 유지」). 메일을 보내지 않으면 크루는 사이트에서만 취소를 알게 된다 — 이 운영 기대가 맞는지는 미확정 S2
- 이 트랜잭션은 `NOTIFICATION` 행을 만들지 않으므로 `BEFORE_COMMIT` 구독자가 없다. 도메인 이벤트도 발행하지 않는다 (구독할 부수효과가 없다. ops 알림 여부는 미확정 S4)

### Response — 200

본문은 [운영 상세](../event/spec.md#운영-행사-상세)와 같다 (바뀐 `status` · `displayStatus` · 올라간 `version` · 아래 판정 필드 포함). 같은 상태 요청(4)도 현재 상세를 준다.

행사 취소 직후 예시 (발췌):

```json
{
  "eventId": 7,
  "version": 4,
  "status": "CANCELLED",
  "displayStatus": "CANCELLED",
  "seats": [
    { "channel": "ONLINE", "capacity": 100, "pending": 0, "confirmed": 0, "remaining": 100 },
    { "channel": "OFFLINE", "capacity": 40, "pending": 0, "confirmed": 0, "remaining": 40 }
  ],
  "canEdit": false,
  "canClose": false,
  "canReopen": false,
  "reopenBlockedReason": null,
  "canCancel": false,
  "hasCancellationRecipients": true,
  "cancellationRecipientCount": 84
}
```

- 취소 직후 `cancellationRecipientCount` 는 처리 순서 8 에서 바꾼 신청 수와 같다. 화면은 `hasCancellationRecipients = true` 면 취소 안내 메일 작성 창을 연다 (`EventAdminDetail` 확인창 「행사 취소」 뒤 `setCompose('CANCELLATION')`)
- 별도의 `cancelledRegistrationCount` 필드는 두지 않는다. 취소 직후에는 `cancellationRecipientCount` 와 값이 같고, 새로고침 뒤에도 같은 값이 나와야 하므로 한 필드로 충분하다

### Error Responses

| 상태 | errorCode | 조건 | 화면 안내 |
|------|-----------|------|------|
| 400 | INVALID_INPUT | `status` 누락·허용 밖 값 · `version` 누락·음수 | |
| 401 | UNAUTHORIZED | 토큰 없음 | |
| 403 | FORBIDDEN | ADMIN 아님 | |
| 404 | NOT_FOUND | `eventId` 없음 | |
| 409 | EVENT_CANCELLED | 취소된 행사 (같은 취소 재시도 포함) | 상세를 다시 불러와 조회 전용으로. `hasCancellationRecipients` 면 빨간 「취소 안내 메일 보내기」 |
| 409 | EVENT_ENDED | 종료된 행사 | 상세를 다시 불러온다. 상태 버튼이 사라진다 |
| 409 | EVENT_VERSION_CONFLICT | 화면이 가진 버전이 낡았다 (다른 캡틴의 저장·상태 전환) | 「다른 캡틴이 먼저 저장했거나 행사 상태가 바뀌었다」 + 최신 상세 다시 불러오기 |
| 409 | EVENT_ALREADY_STARTED | 시작한 행사를 재모집 | 「이미 시작한 행사에는 새 신청을 받을 수 없어요」 |
| 409 | EVENT_REOPEN_DEADLINE_PASSED | 신청 마감이 지난 행사를 재모집 (시작 전) | 「신청 마감 시간이 지났어요. 행사 정보·신청폼에서 신청 마감 시간을 미래로 바꾼 뒤 다시 열어 주세요」 + 행사 정보 탭으로 이동 |

- `EVENT_REOPEN_DEADLINE_PASSED` 는 **새 `ErrorCode`** 다 (409, 기본 문구 「신청 마감 시간이 지나 모집을 다시 열 수 없습니다.」). 화면이 다르게 행동한다: 행사 정보 탭에서 마감을 고치도록 안내한다
- `EVENT_CANCELLED` · `EVENT_ENDED` · `EVENT_VERSION_CONFLICT` · `EVENT_ALREADY_STARTED` 는 PR #478 에서 추가 중인 코드를 그대로 쓴다. 기본 문구가 수정 기준(「취소된 행사는 수정할 수 없습니다.」 · 「행사가 시작된 뒤에는 확정 방식을 바꿀 수 없습니다.」)이라 이 API 는 `BusinessException(code, "취소된 행사는 모집 상태를 변경할 수 없습니다.")` 처럼 상황 문구를 넘긴다. 화면은 `errorCode` 로 분기한다
- 409 는 화면이 판정 필드로 버튼을 미리 숨기므로 다른 캡틴과 겹쳤거나 시각이 지나간 때만 나온다

### 프론트엔드 사용처

- back-office-front 행사 상세 머리 버튼 (아직 없음). `features/events/queries.ts` 에 `useChangeEventStatus()` mutation 신설, 성공·409 모두 상세 쿼리를 다시 읽는다
- 근거 시안: `frontend/apps/playground/src/proto/events/EventAdminDetail.tsx` (`changeStatus` · 행사 취소 확인창 · 취소 뒤 `setCompose('CANCELLATION')`) · `model.ts` `transition` STATUS

---

## 운영 상세에 더하는 판정 필드

[event 「운영 행사 상세」](../event/spec.md#운영-행사-상세) 는 「모집 마감·재모집·행사 취소 가능 여부(`canClose` 등)는 상태 전환 스펙이 이 응답에 추가한다」고 남겨 두었다. 아래 여섯 필드를 `GET /api/admin/events/{eventId}` 응답에 더한다. 같은 본문을 쓰는 `POST /api/admin/events` · `PUT /api/admin/events/{eventId}` · 이 스펙의 `PATCH` 응답에도 똑같이 실린다. 운영 목록(`GET /api/admin/events`)에는 넣지 않는다 (목록에 버튼이 없다, §1-1).

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| canClose | Boolean | N | `모집 마감` 버튼을 보일까 | 계산: `ClubEvent.canClose(now)` = `STATUS = PUBLISHED` ∧ `now < effectiveEndsAt` |
| canReopen | Boolean | N | `모집 다시 열기` 를 바로 실행할 수 있나 | 계산: `ClubEvent.canReopen(now)` = `STATUS = CLOSED` ∧ `now < effectiveEndsAt` ∧ `now < STARTS_AT` ∧ `now < DEADLINE_AT` |
| reopenBlockedReason | String | Y | 모집 마감 상태인데 다시 열 수 없는 이유. `DEADLINE_PASSED` · `STARTED`. 그 밖(다시 열 수 있음 · 모집 마감 아님 · 종료 · 취소)은 null | 계산: `ClubEvent.reopenBlockedReason(now)` — 처리 순서 6·7 과 같은 순서(시작 먼저) |
| canCancel | Boolean | N | `행사 취소` 버튼을 보일까 | 계산: `ClubEvent.canCancel(now)` = `STATUS ≠ CANCELLED` ∧ `now < effectiveEndsAt` |
| hasCancellationRecipients | Boolean | N | 취소된 행사: 취소 안내 대상이 1명 이상인가. 취소 전 행사: 지금 취소하면 대상이 생기는가 | 계산: `cancellationRecipientCount > 0` |
| cancellationRecipientCount | Integer | N | 취소된 행사: 취소 직전 확인 대기·참가 확정이던 신청 수 (`CANCEL_REASON = EVENT_CANCELLED`). 취소 전 행사: 지금의 확인 대기 + 참가 확정 수 (`seats[].pending + confirmed` 합과 같은 쿼리) | 계산: 취소됨 → `ClubEventRegistrationPort.countCancellationRecipients(eventId)`, 아니면 → `EventSeatCounts.occupied` 합 |

- 버튼 표시 규칙 (프로토 `EventAdminDetail` 머리와 같다): `canClose` 면 `모집 마감`, `canReopen` 이거나 `reopenBlockedReason ≠ null` 이면 `모집 다시 열기` (후자는 누르면 이유 안내 창), `canCancel` 이면 `행사 취소`. 화면이 `status` · 시각으로 다시 판정하지 않는다
- `hasCancellationRecipients` 는 프로토 변수와 같은 두 뜻을 그대로 옮겼다. 취소 확인창 문구(「확인 대기와 참가 확정 신청도 모두 취소되며, 취소 사유를 담은 안내 메일 작성창이 열려요」 vs 「새 신청은 받을 수 없어요」)와 취소 뒤 빨간 `취소 안내 메일 보내기` 버튼(`cancelled ∧ hasCancellationRecipients`)이 모두 이 값을 쓴다
- 메일 작성 창의 수신자 수는 [event-mail 미리보기](../event-mail/spec.md#메일-미리보기) 의 `recipientCount` 가 정본이다. 이 필드는 버튼·확인창 분기용이다. 둘은 같은 조건으로 세지만, 메일 쪽은 탈퇴한 계정을 뺀다 (event-mail 「받는 사람」)
- 판정 메서드는 엔티티 하나에 둔다. 사이트용 행사 API(ST-038)가 「행사 취소」 표시를 할 때도 `displayStatus` 를 같은 메서드로 계산한다 ([endpoint-convention 규칙 1](../../docs/backend-development-guide/api/endpoint-convention.md#규칙))
- [event](../event/spec.md) 스펙의 응답 표에 이 여섯 필드를 옮겨 적는 일은 이 스펙이 확정될 때 event 스펙 PR 에서 한다 (지금 event 스펙은 PR #478 이 구현 중이라 건드리지 않는다)

---

## 동시에 들어온 요청

모든 요청이 첫 조회로 `CLUB_EVENT` 행 쓰기 잠금을 잡으므로, 결과는 누가 먼저 잠금을 얻었는지로 갈린다 ([event Q8](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서)).

| 겹친 요청 | 취소가 먼저 | 상대가 먼저 |
|---|---|---|
| 행사 취소 ↔ 크루 신청 제출 (ST-038) | 신청은 잠금 뒤 `STATUS = CANCELLED` 를 읽고 거절된다 | 신청이 `PENDING`·`CONFIRMED` 로 커밋된다. 취소는 잠금 뒤 그 신청까지 `EVENT_CANCELLED` 로 바꾸고 안내 대상에 넣는다 |
| 행사 취소 ↔ 운영진 참가 확정·참가 불가·개별 취소 | 참가자 처리는 409 `EVENT_CANCELLED` | 처리 결과가 먼저 커밋된다. 참가 불가·개별 취소된 신청은 취소 안내 대상에서 빠지고, 참가 확정된 신청은 대상에 들어간다 |
| 행사 취소 ↔ 행사 수정 (`PUT`) | 수정은 409 `EVENT_CANCELLED` (event 처리 순서 2) | 수정이 버전을 올린다. 취소는 409 `EVENT_VERSION_CONFLICT`, 화면은 최신 상세를 다시 읽고 확인창을 다시 띄운다 |
| 모집 마감 ↔ 크루 신청 제출 | 신청은 잠금 뒤 `displayStatus = RECRUITMENT_CLOSED` 를 읽고 거절된다 | 신청이 접수된다. 마감은 그 뒤에 적용된다 |
| 재모집 ↔ 행사 수정의 마감 연장 | 재모집은 기존 마감으로 판정한다 (마감이 지났으면 409 `EVENT_REOPEN_DEADLINE_PASSED`) | 수정이 버전을 올린다. 재모집은 409 `EVENT_VERSION_CONFLICT`. 다시 불러오면 `canReopen` 이 새 마감으로 계산된다 |
| 행사 취소 ↔ 종료 자동 처리 ([event-participant](../event-participant/spec.md#행사-종료-시-확인-대기-자동-전환)) | 종료 처리는 잠금 뒤 `STATUS = CANCELLED` 를 읽고 아무것도 하지 않는다 | 종료 시각이 지났다면 취소는 409 `EVENT_ENDED` 다 (종료 처리가 먼저 돌았다는 것 자체가 종료 뒤라는 뜻) |

- 모집 마감은 크루 본인 취소를 막지 않는다. 본인 취소는 `DEADLINE_AT` 전까지 저장 상태와 관계없이 된다 (PRD §1 「운영진이 모집을 먼저 닫아도 설정된 신청 마감 시각 전까지 크루 본인이 취소할 수 있음」, crew-apply-event §4). 이 규칙은 ST-038 신청 스펙이 지킨다

---

## 데이터 모델 영향

새 테이블은 없다.

| 테이블 | 이 스펙이 쓰는 것 | 비고 |
|---|---|---|
| CLUB_EVENT | `STATUS` · `VERSION` 갱신. `DEADLINE_AT` · `STARTS_AT` · `ENDS_AT` · `TIME_ZONE` 읽기 | event 스펙 데이터 모델 그대로. 컬럼 추가 없음 |
| CLUB_EVENT_REGISTRATION (제안) | 취소 때 `STATUS` · `CANCEL_REASON` · `STATUS_CHANGED_AT` 갱신. 취소 안내 대상 COUNT | [event-participant 「데이터 모델 제안」](../event-participant/spec.md#데이터-모델-제안-club_event_registration). 취소 안내 대상 조회는 `INDEX(CLUB_EVENT_ID, CHANNEL, STATUS)` 로 충분하다 (`CANCEL_REASON` 은 남은 행에서 거른다) |

- 행사 취소 시각·취소한 캡틴을 행사 행에 따로 남기지 않는다. 화면이 쓰지 않고, 바뀐 신청 행의 `STATUS_CHANGED_AT` · `STATUS_CHANGED_BY` 에 남는다. 감사 목적의 기록이 필요한지는 미확정 S4

## 퍼널·계측

해당 없음. 캡틴의 운영 기능이라 퍼널(유입 → 가입 → 활성화 → 결제 → 재방문) 단계를 바꾸지 않고, 추가·변경하는 분석 이벤트가 없다. 크루가 행사 취소로 신청을 잃는 일이 재방문에 주는 영향은 이번에 측정하지 않는다. 실험(A/B) 없음.

## 근거와 PRD·프로토·레포 규약의 차이

| 항목 | PRD · 프로토 | 이 스펙 |
|---|---|---|
| 취소 안내 대상 보존 | 프로토는 행사에 `cancellationRecipientIds` 배열을 둔다 | 신청 행의 `CANCEL_REASON = EVENT_CANCELLED` 로 같은 집합을 얻는다. 취소된 행사는 신청이 더 바뀌지 않아 집합이 고정된다 |
| 재모집 때 다시 검사 | 프로토는 `validateEvent` 전체를 다시 돌린다 | 시각 조건(시작 · 신청 마감)만 본다. 나머지는 저장된 값이 이미 통과했다 |
| 시작 후 재모집 | 프로토는 같은 이유 창에서 문구만 나눈다 | 별도 코드 `EVENT_ALREADY_STARTED` 와 `reopenBlockedReason = STARTED` 로 나눈다 |
| 같은 상태 요청 | 프로토는 같은 상태로 바꿔도 막지 않는다 | 200 · 변화 없음 · 버전 그대로 (event N3, 미확정 S1) |
| 버전 | 프로토는 버전이 없다 | 요청 `version` 필수. `STATUS` 가 바뀔 때만 +1 (event N3) |

## 미확정

- [NEEDS CLARIFICATION] **S1. 같은 상태로 바꾸는 요청.** 선택지: (가) 200 · 변화 없음 · 버전 그대로 (멱등) · (나) 409 `EVENT_ALREADY_CLOSED` 같은 전용 코드 · (다) 409 `CONFLICT`. **권장 (가)** — event N3 이 「바뀌는 것이 없으면 올리지 않는다」고 적었고, 동시 클릭·재시도에서 화면이 할 일이 없다. 위 처리 순서 4 는 (가) 기준이다. `CANCELLED → CANCELLED` 는 어느 쪽이든 409 `EVENT_CANCELLED`
- [NEEDS CLARIFICATION] **S2. 행사 전체 취소 때 신청별 자동 취소 메일(`EVENT_REGISTRATION_CANCELLED`)을 보내지 않는 것이 운영 기대와 맞나.** PRD §1 은 취소 안내를 「운영자가 발송」으로 적었고 프로토 `transition` 도 자동 메일을 만들지 않는다. 그러나 캡틴이 작성 창을 닫고 끝내 보내지 않으면 크루(특히 참가 확정자)는 메일을 받지 못한다. 선택지: (가) 자동 메일 없음, 수동 취소 안내만 (PRD · 프로토 그대로) · (나) 자동 취소 메일을 보내고 수동 안내는 추가 안내로 · (다) 수동 안내를 일정 시간 안 보내면 운영자에게 ops 알림. **권장 (가)** + 화면이 취소 확인창에서 「안내 메일을 보내야 크루가 메일로 알 수 있다」를 알린다
- [NEEDS CLARIFICATION] **S3. 신청 마감 뒤·시작 전의 모집 마감 처리.** 프로토는 허용한다(종료 전이면 버튼 노출). 저장 상태만 바뀌고 크루 화면은 이미 「모집 마감」이라 효과는 없다. 그대로 허용할지, 신청 마감 뒤에는 버튼을 숨길지(`canClose` 에 `now < DEADLINE_AT` 추가). **권장: 허용** (프로토 그대로)
- [NEEDS CLARIFICATION] **S4. 행사 취소를 ops 알림 · 감사 기록으로 남길지.** 운영자 본인이 한 일이라 [ops-alerts](../ops-alerts/spec.md) 기준(가입·신청·승인·실패)에는 없다. 되돌릴 수 없고 여러 크루의 신청을 한꺼번에 바꾸는 일이라 「누가 언제 취소했나」를 남길 필요가 있는지 확인한다. 선택지: (가) 남기지 않음 (신청 행 `STATUS_CHANGED_BY` 로 추적) · (나) `club_event.cancelled` 도메인 이벤트 + ops 알림 · (다) `ADMIN_AUDIT_LOG` 에 새 `ACTION`. **권장 (가)**, 운영에서 필요해지면 (나)
- [NEEDS CLARIFICATION] **S5. 취소 안내 버튼이 쓰는 `cancellationRecipientCount` 의 탈퇴 계정 처리.** 이 필드는 신청 행 수를 센다. 취소 뒤 대상자가 탈퇴하면 메일 미리보기의 `recipientCount`(계정이 있는 사람만)보다 커질 수 있다. 화면 버튼은 0 초과인지만 보므로 영향이 작지만, 둘을 같은 수로 맞출지(이 필드도 계정이 있는 사람만) 정한다. **권장: 그대로 두고** 수신자 수는 메일 미리보기 값을 보여 준다. 탈퇴 계정의 신청 처리는 [event-participant 미확정 P3](../event-participant/spec.md#미확정) 과 함께 정한다
