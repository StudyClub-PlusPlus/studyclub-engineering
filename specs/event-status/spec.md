# 행사 상태 전환 API Spec: 모집 마감 · 재모집 · 행사 취소

> ERD: [CLUB_EVENT](../../docs/erd/CLUB_EVENT.md) (V59, PR #478) · [ADMIN_AUDIT_LOG](../../docs/erd/ADMIN_AUDIT_LOG.md) (행사 취소 감사 기록 `EVENT_CANCEL`, 아래 「행사 취소 감사 기록」). 신청 테이블은 [CLUB_EVENT_REGISTRATION](../../docs/erd/CLUB_EVENT_REGISTRATION.md) (`V62__create_club_event_registration.sql`, 공통 신청 PR #516)
> 생성일: 2026-11-18 · 리뷰 반영: 2026-11-19 (PR #479 리뷰 S1~S5 · PR #509 행사 취소 행동 분석) · 확정: 2026-11-25 (PR #516 · #517 병합 뒤 `beta` 코드와 대조)
> 상태: 구현중 — BE 구현 PR(`feat/event-status-be`, 마이그레이션 `V66__admin_audit_log_event_cancel.sql`). back-office-front 연결은 FE PR #528. 구현 계획 [plan](./plan.md) · [tasks](./tasks.md)
>
> Story PRD:
> - [캡틴은 행사를 등록하고 신청자의 참가를 확정할 수 있다](../../01-planning/stories/captain-manage-events/PRD.md) (ST-037) §1 「행사 관리」 S1~S5 · §3 「행사 취소 행동 분석」
>
> 기준 스펙: [event](../event/spec.md) — 「상태」 · 「같은 행사에 쓰는 요청의 처리 순서」 · 「동시 수정 방지: 버전」(N3) · 「수정할 수 있는 범위」를 그대로 따른다
> 기준 프로토타입: playground `/proto/console/events/{id}` (`EventAdminDetail.tsx` 머리의 `모집 마감` · `모집 다시 열기` · `행사 취소`)
> 판정 로직의 근거: `frontend/apps/playground/src/proto/events/model.ts` `transition` 의 `STATUS` 분기 · `eventStatus` · `canManageEventRegistrations`
> 함께 읽을 스펙: [event-participant](../event-participant/spec.md) (취소가 바꾸는 신청 상태 · 탈퇴 처리) · [event-mail](../event-mail/spec.md) (취소 뒤 보내는 취소 안내 메일) · [event-registration](../event-registration/spec.md) (ST-038 크루 신청·본인 취소, PR #517 에서 구현)

## 엔드포인트 목록

**백오피스: `/api/admin/events/{eventId}/status` (`AdminClubEventStatusController`, 캡틴만)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| PATCH | /api/admin/events/{eventId}/status | 모집 마감(`CLOSED`) · 재모집(`PUBLISHED`) · 행사 취소(`CANCELLED`) 중 하나로 저장 상태를 바꾼다. 취소는 유효 신청을 같은 트랜잭션에서 취소하고 취소 안내 대상을 보존하며 감사 기록을 남긴다 | O (ADMIN) | 구현중 |

이 스펙은 [event](../event/spec.md) 의 `GET /api/admin/events/{eventId}` 응답에 판정 필드 여섯 개를 **추가**한다 (아래 「운영 상세에 더하는 판정 필드」). 경로가 새로 생기지 않아 위 표에는 넣지 않았다.

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 먼저 읽을 것

### 이 스펙이 다루는 것과 안 다루는 것

| 다룬다 | 다루지 않는다 | 닿는 곳 |
|---|---|---|
| 저장 상태 `CLUB_EVENT.STATUS` 의 세 전환 · 버전 증가 · 취소 때 신청 일괄 취소와 취소 안내 대상 보존 · 취소 감사 기록 · 취소 분석 이벤트 · 운영 상세의 전환 가능 여부 판정 | 행사 등록·수정 ([event](../event/spec.md)) | `version` 비교, 잠금 순서, `displayStatus` 계산 |
| | 참가자 개별 처리 · 종료 자동 전환 · 탈퇴 처리 ([event-participant](../event-participant/spec.md)) | 취소가 쓰는 `CANCEL_REASON = EVENT_CANCELLED` |
| | 취소 안내 메일 작성·발송 ([event-mail](../event-mail/spec.md)) | 취소 안내 대상(`hasCancellationRecipients`)의 정의 |
| | 크루 신청·본인 취소·사이트 표시 ([event-registration](../event-registration/spec.md), ST-038) | 모집 마감 뒤에도 신청 마감 전까지 본인 취소 허용 (S3) |

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
| `POST /api/admin/events/{eventId}/cancellations` | 취소만 따로 떼면 같은 잠금·버전 규칙을 두 곳에 적어야 한다. 세 전환은 처리 순서 1~5 가 같다 |

---

## 상태 전환

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/events/{eventId}/status`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 저장 상태를 요청한 값으로 바꾼다. `STATUS` 가 실제로 바뀌면 `VERSION` 을 1 올린다 (event N3). 이미 요청한 상태면 아무것도 바꾸지 않고 성공한다 (S1)

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

**`version` 을 받는 이유 (event N3).** 상태 전환은 행사 행을 바꾸므로 `STATUS` 가 실제로 바뀔 때 `VERSION` 을 올린다. 그래서 다른 캡틴이 모집을 마감·취소한 뒤 이전 버전으로 편집하던 캡틴의 `PUT` 은 409 `EVENT_VERSION_CONFLICT` 로 막힌다. 반대 방향도 같다: 상태를 바꾸려는 캡틴이 보고 있던 화면이 낡았으면(그사이 다른 캡틴이 행사 정보를 저장했거나 상태를 바꿨으면) **실제 상태 변경이 필요한 요청**은 409 로 막고, 화면은 최신 상세를 다시 불러와 확인창을 다시 띄운다. 이미 원하는 상태인 요청은 버전을 보지 않는다 (S1).

### 전이표

| 지금 (저장 상태) | → `CLOSED` (모집 마감) | → `PUBLISHED` (재모집) | → `CANCELLED` (행사 취소) |
|---|---|---|---|
| `PUBLISHED` | 허용 (신청 마감 뒤에도, S3) | 변화 없음, 200 (S1) | 허용 |
| `CLOSED` | 변화 없음, 200 (S1) | `now < DEADLINE_AT` 일 때만 허용 | 허용 |
| `CANCELLED` | 409 `EVENT_CANCELLED` | 409 `EVENT_CANCELLED` | 409 `EVENT_CANCELLED` |
| 종료 (`now ≥ effectiveEndsAt`, 저장 상태 무관) | 409 `EVENT_ENDED` | 409 `EVENT_ENDED` | 409 `EVENT_ENDED` |

- 행사 취소는 되돌릴 수 없다 (PRD §1 「취소된 행사는 모집 상태를 변경할 수 없음」, event 「상태」 `CANCELLED` 「읽기 전용, 되돌릴 수 없다」)
- 종료된 행사는 세 전환 모두 불가 (PRD §1 「종료된 행사는 행사 취소·모집 마감·재모집 처리 불가」, `transition` 「종료된 행사는 취소하거나 모집 상태를 변경할 수 없습니다」)
- 재모집은 `CLOSED` 에서만 의미가 있다. 정원이 다 찼어도 `PUBLISHED` 로 저장하며 계산된 `displayStatus` 는 `FULL` 이 된다 ([event 「상태」](../event/spec.md#상태-저장-상태와-표시-상태를-나눈다): `FULL` 은 저장하지 않고 요청마다 계산)

### 신청 마감 뒤의 수동 모집 마감 (S3)

- 신청 마감 시각(`DEADLINE_AT`)이 지났어도 **취소되지 않았고 종료 전이면** 수동 모집 마감(`→ CLOSED`)을 허용한다. `canClose` 는 신청 마감과 관계없다 (PRD §1 S3, 프로토 `모집 마감` 버튼 조건 `!finished && status === 'PUBLISHED'`)
- 수동 마감 뒤 행사 수정(`PUT`)으로 `deadlineAt` 을 미래로 늘려도 **자동으로 다시 열리지 않는다.** `STATUS = CLOSED` 가 남아 있어 `displayStatus` 는 계속 `RECRUITMENT_CLOSED` 다 ([event 「상태」](../event/spec.md#상태-저장-상태와-표시-상태를-나눈다)). 캡틴이 `모집 다시 열기`(`→ PUBLISHED`)를 해야 신청을 받는다
- 이미 `CLOSED` 면 S1 대로 200, 종료·취소 행사는 409
- **크루 본인 취소는 수동 모집 마감과 별개다.** 크루는 저장 상태와 관계없이 설정된 `DEADLINE_AT` 전까지 본인 취소할 수 있다. `DEADLINE_AT` 부터 크루 화면은 운영진 문의를 안내하고, 운영진은 `effectiveEndsAt` 전까지 개별 취소를 처리한다 ([event-participant 「참가 처리」](../event-participant/spec.md#참가-처리)). 본인 취소 규칙은 [event-registration 「본인 취소할 수 있나」](../event-registration/spec.md#본인-취소할-수-있나-cancancel--cancelblockedreason) 가 지킨다 (`ClubEventRegistration.selfCancelBlockedReason` 은 저장 상태를 보지 않고 `DEADLINE_AT` 만 본다) (PRD §1 「운영진이 모집을 먼저 닫아도 설정된 신청 마감 시각 전까지 크루 본인이 취소할 수 있음」, crew-apply-event §4)

### 처리 순서

인가(401 · 403)와 본문 검증(400)을 통과한 뒤, **한 트랜잭션**에서 아래 순서로 처리한다. 먼저 걸리는 것 하나만 응답하고, 실패하면 아무것도 바꾸지 않는다.

| # | 단계 | 실패 | 근거 |
|---|---|---|---|
| 1 | `CLUB_EVENT` 행을 쓰기 잠금으로 읽는다 (`SELECT … FOR UPDATE`, **트랜잭션의 첫 조회**, `ClubEventRepository.findByIdForUpdate`). 없으면 | 404 `NOT_FOUND` | [event 「같은 행사에 쓰는 요청의 처리 순서」](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서). `ACCOUNT` 는 잠그지 않는다 (아래 「탈퇴와의 잠금 순서」) |
| 2 | 잠금 뒤 읽은 `STATUS = CANCELLED` | 409 `EVENT_CANCELLED` | PRD §1, `transition` 「취소된 행사는 모집 상태를 변경할 수 없습니다」 |
| 3 | 잠금 뒤 읽은 값으로 `now ≥ effectiveEndsAt` | 409 `EVENT_ENDED` | PRD §1, `transition` 「종료된 행사는…」 |
| 4 | 요청 `status` 가 지금 저장 상태와 같다 (`PUBLISHED → PUBLISHED`, `CLOSED → CLOSED`) | 200, **버전이 낡았어도 성공.** 아무것도 바꾸지 않고 `VERSION` 증가 · 감사 기록 · 도메인 이벤트도 없다 | S1, event N3 「이미 그 상태라서 바뀌는 것이 없으면 올리지 않는다」 |
| 5 | 요청 `version` ≠ 저장된 `VERSION` | 409 `EVENT_VERSION_CONFLICT` | event N3 · Q14 |
| 6 | 재모집(`→ PUBLISHED`)인데 `now ≥ STARTS_AT` | 409 `EVENT_ALREADY_STARTED` | `EventAdminDetail` `changeStatus` 「이미 시작한 행사에는 새 신청을 받을 수 없어요」 |
| 7 | 재모집(`→ PUBLISHED`)인데 `now ≥ DEADLINE_AT` | 409 `EVENT_REOPEN_DEADLINE_PASSED` | PRD §1 「신청 마감 시각이 지난 행사는 모집을 다시 열 수 없는 이유를 안내」 · §2 「재모집 시 미래 마감시간 필요」, `transition` 「신청 마감시간을 현재보다 늦게 설정해 주세요」 |
| 8 | 행사 취소(`→ CANCELLED`)면 그 행사의 `PENDING` · `CONFIRMED` 신청 ID 를 읽고 전부 `CANCELLED` 로 바꾸며 `CANCEL_REASON = EVENT_CANCELLED`, `STATUS_CHANGED_AT = now`, `STATUS_CHANGED_BY = 요청자` 를 적는다. 조건부 갱신(`WHERE CLUB_EVENT_ID = ? AND STATUS IN ('PENDING','CONFIRMED')`). 바꾼 신청 ID 를 모은다 (0건일 수 있다) | — | PRD §1 「확인 대기·참가 확정 신청도 취소. 취소 직전 대상자를 보존」, `transition` STATUS CANCELLED |
| 9 | `STATUS` 를 요청 값으로 바꾸고 `VERSION` 을 1 올린다 | — | event N3 |
| 10 | 행사 취소면 `ADMIN_AUDIT_LOG` 에 `EVENT_CANCEL` 한 행을 같은 트랜잭션에서 쓴다 (아래 「행사 취소 감사 기록」). **저장에 실패하면 행사 취소 전체를 롤백**하고 500 `INTERNAL_ERROR` | 500 | S4 |
| 11 | 행사 취소면 `ClubEventCancelledEvent` (`club_event.cancelled`) 를 트랜잭션 안에서 발행한다. 페이로드는 행사 ID · 8 에서 바꾼 신청 ID | — | 아래 「퍼널·계측」 |
| 12 | 커밋한다. **자동 메일은 만들지 않는다** (아래 「취소와 메일」). 커밋 뒤 `AFTER_COMMIT` 분석 구독자가 취소된 신청마다 분석 이벤트를 보낸다 | — | S2, PRD §3 「행사 취소 행동 분석」 |

- 4 가 5 보다 먼저다 (S1). 두 캡틴이 거의 동시에 `모집 마감` 을 누르거나 응답을 못 받은 요청을 다시 보내면, 먼저 처리된 요청이 버전을 올려 두 번째 요청은 버전이 낡는다. 결과가 이미 원하는 상태인데 409 를 주면 화면이 할 일이 없다. 대신 응답의 `version` 은 최신 값이므로 화면은 그 값으로 상태를 맞춘다. 실제로 상태를 바꿔야 하는 요청(5 이후)은 버전 검사를 그대로 받는다
- 6 이 7 보다 먼저다. 시작한 행사는 신청 마감도 지났지만(`DEADLINE_AT ≤ STARTS_AT`) 화면이 할 수 있는 일이 다르다: 마감이 지났을 뿐이면 「행사 정보·신청폼에서 신청 마감 시간을 미래로 바꾼 뒤 다시 열어 주세요」, 시작했으면 시작 시각을 미래로 옮길 수 없으므로(event `EVENT_START_LOCKED`) 「새 신청을 받을 수 없어요」로 끝난다 (`EventAdminDetail` `changeStatus` 두 문구)
- 재모집 때 행사 값 전체(`validateEvent`)를 다시 검사하지 않는다. 서버에 저장된 값은 등록·수정에서 이미 같은 검증을 통과했고 그 뒤 바뀌는 것은 시각뿐이다. 시각이 걸린 조건은 6·7 이 본다
- 재모집은 `PUBLISHED_AT` 을 바꾸지 않는다. 등록할 때 이미 채워진다 (event 「행사 등록」 `PUBLISHED_AT = now`)
- 8 의 신청은 1 의 잠금을 얻은 뒤 읽는다. 크루 신청 제출 · 본인 취소 · 운영진의 참가자 처리 · 종료 자동 처리 · 탈퇴도 같은 행사 잠금을 잡으므로 취소와 한 줄로 선다 (event Q8). 그래서 취소 트랜잭션이 바꾸는 신청 집합이 곧 「취소 직전의 확인 대기·참가 확정 신청자」다
- 409 실패와 S1 무변화 요청은 감사 기록 · 분석 이벤트를 남기지 않는다

### 행사 취소가 신청에 하는 일

| 취소 직전 신청 상태 | 취소 뒤 | `CANCEL_REASON` | 취소 안내 메일 대상 |
|---|---|---|---|
| `PENDING` (확인 대기) | `CANCELLED` | `EVENT_CANCELLED` | 대상 (계정이 남아 있으면, S5) |
| `CONFIRMED` (참가 확정) | `CANCELLED` | `EVENT_CANCELLED` | 대상 (계정이 남아 있으면, S5) |
| `DECLINED` (참가 불가) | 그대로 | 그대로 (NULL) | 제외 |
| `CANCELLED` (본인 · 운영진 개별 · 탈퇴) | 그대로 | 그대로 (`SELF_CANCELLED` · `ADMIN_CANCELLED` · `ACCOUNT_DELETED`) | 제외 |

- PRD §1 「새로고침 후에도 취소 직전 대상자를 유지하고 이전 개별 취소·참가 불가자는 제외」를 **신청 행의 `CANCEL_REASON` 하나로** 지킨다. 취소 안내 대상 신청 = 그 행사의 `STATUS = CANCELLED ∧ CANCEL_REASON = EVENT_CANCELLED` 인 신청. 이 이력은 탈퇴 뒤에도 지우지 않는다 (S5)
- 별도 대상 테이블(`EVENT_CANCELLATION_TARGET`)이나 행사 행의 ID 목록(프로토 `cancellationRecipientIds`)을 두지 않는 이유: 취소된 행사는 이후 어떤 요청도 신청 상태를 바꾸지 못한다 (참가자 처리 · 종료 자동 처리 · 크루 신청·취소 · 탈퇴 모두 취소된 행사의 신청은 건드리지 않는다). 그래서 이 조건으로 다시 세어도 집합이 변하지 않는다. 같은 사실을 두 곳에 두면 어긋날 수 있다
- `CANCEL_REASON` 값 목록과 컬럼 정의는 [CLUB_EVENT_REGISTRATION ERD](../../docs/erd/CLUB_EVENT_REGISTRATION.md) 와 `ClubEventRegistrationCancelReason`(`SELF_CANCELLED` · `ADMIN_CANCELLED` · `ACCOUNT_DELETED` · `EVENT_CANCELLED`, PR #516) 이 정본이다. 이 스펙이 쓰는 `EVENT_CANCELLED` 값은 이미 있다
- 바꾸는 쿼리는 행사 애그리거트가 신청 애그리거트에 시키는 일이라 기존 `ClubEventRegistrationPort`(domain, 실제 어댑터는 api 의 `ClubEventRegistrationAdapter`)에 메서드 두 개를 더한다. 지금 포트에는 `countActiveSeatsByEventIds` · `countActiveSeats` · `confirmPendingRegistrations` 셋뿐이다
  - `List<Long> cancelActiveRegistrationsForEventCancellation(Long eventId, Long actorAccountId)` — 유효 신청을 `CANCELLED` · `EVENT_CANCELLED` 로 바꾸고 바꾼 신청 ID 를 돌려준다. 바꾼 사람(`STATUS_CHANGED_BY`)은 취소한 캡틴이다. 기존 `confirmPendingRegistrations(eventId, actorAccountId)` 와 같은 모양이다
  - `int countCancellationRecipients(Long eventId)` — 계정이 남은 취소 안내 대상 수 (S5). 아래 「운영 상세에 더하는 판정 필드」 의 두 뜻을 한 쿼리로 센다

### 취소와 메일 (S2)

- **행사 전체 취소는 신청별 자동 메일(`EVENT_REGISTRATION_CANCELLED`)을 만들지 않는다.** 캡틴이 별도 행사 취소 안내 템플릿(`EVENT_CANCELLATION`)으로 내용을 작성·미리보기한 뒤 직접 보낸다 (PRD §1 S2, 프로토 `transition` STATUS 분기도 자동 메일을 쌓지 않는다)
- 취소 직후 화면은 `hasCancellationRecipients = true`(취소 직전 확인 대기·참가 확정 신청자 중 계정이 남은 사람이 1명 이상)일 때만 취소 안내 메일 작성 창을 바로 연다. 0명이면 열지 않는다
- 작성 창을 닫아도 행사·신청 취소는 그대로다. 이후 빨간 `취소 안내 메일 보내기` 버튼으로 다시 열 수 있고, 추가 안내도 보낼 수 있다 ([event-mail M6](../event-mail/spec.md#결정-기록-pr-479-리뷰))
- 운영진 개별 취소 · 크루 본인 취소의 자동 메일은 그대로 보낸다 ([event-mail 「자동 메일」](../event-mail/spec.md#자동-메일-신청-상태-알림))
- 취소 안내를 보내지 않았을 때의 독촉 알림(ops 알림)은 두지 않는다
- 이 트랜잭션은 `NOTIFICATION` 행을 만들지 않으므로 `BEFORE_COMMIT` 메일 구독자가 없다

### 행사 취소 감사 기록 (S4)

신청자 유무와 관계없이(함께 취소된 신청 0건 포함) **실제로 `CANCELLED` 로 바뀐 행사 전체 취소마다** `ADMIN_AUDIT_LOG` 한 행을 취소와 같은 트랜잭션에서 쓴다. 저장이 실패하면 취소도 롤백한다 ([data-retention](../data-retention/spec.md) 「행위와 로그 저장은 같은 트랜잭션」 과 같은 원칙).

| `ADMIN_AUDIT_LOG` 컬럼 | 값 |
|---|---|
| ACTOR_ACCOUNT_ID | 취소한 캡틴 |
| ACTION | `EVENT_CANCEL` (새 값) |
| TARGET_ACCOUNT_ID | NULL — 대상이 회원이 아니라 행사다 (컬럼을 nullable 로 바꾸는 스키마 변경 필요) |
| CLUB_EVENT_ID | 취소한 행사 ID (새 nullable 컬럼, FK 없음 — 기존 `PARTICIPANT_ID` 와 같은 방식) |
| BEFORE_VALUE | 취소 직전 저장 상태 `PUBLISHED` · `CLOSED` |
| AFTER_VALUE | 함께 취소된 신청 수 (처리 순서 8 에서 바꾼 행 수, `0` 포함, 10진 문자열) |
| ACTOR_IP | 검증된 접속 주소 (기존 규칙) |
| RETENTION_POLICY · EXPIRES_AT | `AUDIT_EVENT_CANCEL_V1` · 발생일 + 3년 (아래) |
| CREATED_AT | 취소 시각 |

- 이메일 · 닉네임 · 신청서 답변 · 취소 안내 본문 · 신청 ID 목록은 넣지 않는다
- **보관 기준**: 새 규칙 코드 `AUDIT_EVENT_CANCEL_V1` = 발생일 + 3년을 둔다. 행사 취소는 여러 크루의 신청을 한꺼번에 되돌릴 수 없게 바꾸는 운영 행위라, 권한 변경·말소 기록(`AUDIT_AUTHORITY_V1`, 3년, 「개인정보의 안전성 확보조치 기준」 제5조 제3항)과 같은 기간을 운영 기준으로 준용한다. 법이 이 행위에 기간을 직접 정한 것은 아니다. 권한 기록과 섞이지 않게 코드를 따로 둔다. 일일 정리 작업은 저장된 `EXPIRES_AT` 으로 지우므로 규칙만 더하면 된다
- 스키마: `V66__admin_audit_log_event_cancel.sql` 이 `TARGET_ACCOUNT_ID` 를 nullable 로 바꾸고 `CLUB_EVENT_ID` 를 더한다 ([ADMIN_AUDIT_LOG ERD](../../docs/erd/ADMIN_AUDIT_LOG.md)). 규칙 코드 `AUDIT_EVENT_CANCEL_V1` 은 [data-retention](../data-retention/spec.md) 표에 있다. `ACTION` 은 `VARCHAR(20)` 이라 `EVENT_CANCEL`(12자)이 그대로 들어간다
- 디스코드 등 운영자 알림과 감사 기록 조회 화면은 이번 범위가 아니다

### 탈퇴와의 잠금 순서

- 이 API 는 `CLUB_EVENT` 만 잠근다. `ACCOUNT` 는 잠그지 않고, 계정 존재 여부(S5)는 잠금 뒤 일반 조회로 읽는다
- 회원 탈퇴는 `ACCOUNT` → 그 계정 신청이 걸린 `CLUB_EVENT`(ID 오름차순, 취소된 행사 포함) 순서로 잠근다 ([event-participant 「탈퇴한 크루의 신청」](../event-participant/spec.md#탈퇴한-크루의-신청), PR #508 R1). 행사 쪽 작업이 `CLUB_EVENT → ACCOUNT` 순서로 쓰기 잠금을 잡지 않으므로 교착이 생기지 않는다
- 탈퇴가 먼저 행사 잠금을 얻으면 탈퇴한 크루의 유효 신청은 이미 `ACCOUNT_DELETED` 로 취소되어 있어, 행사 취소의 처리 순서 8 대상에서 빠진다. 행사 취소가 먼저면 그 크루의 신청은 `EVENT_CANCELLED` 로 남고, 탈퇴는 취소된 행사의 신청을 바꾸지 않는다. 그 사람은 계정이 없어 취소 안내 수(S5)에서 빠진다

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

- 화면은 `hasCancellationRecipients = true` 면 취소 안내 메일 작성 창을 연다 (`EventAdminDetail` 확인창 「행사 취소」 뒤 `setCompose('CANCELLATION')`)
- 별도의 `cancelledRegistrationCount` 필드는 두지 않는다. 함께 취소된 신청 수는 감사 기록에 남고, 화면이 쓰는 값은 계정이 남은 안내 대상 수(`cancellationRecipientCount`)다

### Error Responses

| 상태 | errorCode | 조건 | 화면 안내 |
|------|-----------|------|------|
| 400 | INVALID_INPUT | `status` 누락·허용 밖 값 · `version` 누락·음수 | |
| 401 | UNAUTHORIZED | 토큰 없음 | |
| 403 | FORBIDDEN | ADMIN 아님 | |
| 404 | NOT_FOUND | `eventId` 없음 | |
| 409 | EVENT_CANCELLED | 취소된 행사 (같은 취소 재시도 포함) | 상세를 다시 불러와 조회 전용으로. `hasCancellationRecipients` 면 빨간 「취소 안내 메일 보내기」 |
| 409 | EVENT_ENDED | 종료된 행사 | 상세를 다시 불러온다. 상태 버튼이 사라진다 |
| 409 | EVENT_VERSION_CONFLICT | 실제 상태 변경이 필요한데 화면이 가진 버전이 낡았다 (다른 캡틴의 저장·상태 전환) | 「다른 캡틴이 먼저 저장했거나 행사 상태가 바뀌었다」 + 최신 상세 다시 불러오기 |
| 409 | EVENT_ALREADY_STARTED | 시작한 행사를 재모집 | 「이미 시작한 행사에는 새 신청을 받을 수 없어요」 |
| 409 | EVENT_REOPEN_DEADLINE_PASSED | 신청 마감이 지난 행사를 재모집 (시작 전) | 「신청 마감 시간이 지났어요. 행사 정보·신청폼에서 신청 마감 시간을 미래로 바꾼 뒤 다시 열어 주세요」 + 행사 정보 탭으로 이동 |
| 500 | INTERNAL_ERROR | 행사 취소 감사 기록 저장 실패 — 취소도 롤백 | 「처리하지 못했습니다. 다시 시도해 주세요」 |

- `EVENT_REOPEN_DEADLINE_PASSED` 는 **새 `ErrorCode`** 다 (409, 기본 문구 「신청 마감 시간이 지나 모집을 다시 열 수 없습니다.」). 화면이 다르게 행동한다: 행사 정보 탭에서 마감을 고치도록 안내한다
- `EVENT_CANCELLED` · `EVENT_ENDED` · `EVENT_VERSION_CONFLICT` · `EVENT_ALREADY_STARTED` 는 PR #478 에서 만든 코드를 그대로 쓴다. 기본 문구가 수정 기준(「취소된 행사는 수정할 수 없습니다.」 · 「행사가 시작된 뒤에는 확정 방식을 바꿀 수 없습니다.」)이라 이 API 는 `BusinessException(code, "취소된 행사는 모집 상태를 변경할 수 없습니다.")` 처럼 상황 문구를 넘긴다. 화면은 `errorCode` 로 분기한다
- 409 는 화면이 판정 필드로 버튼을 미리 숨기므로 다른 캡틴과 겹쳤거나 시각이 지나간 때만 나온다

### 프론트엔드 사용처

- back-office-front 행사 상세 머리 버튼 (아직 없음). `features/events/queries.ts` 에 `useChangeEventStatus()` mutation 신설, 성공·409 모두 상세 쿼리를 다시 읽는다
- 근거 시안: `frontend/apps/playground/src/proto/events/EventAdminDetail.tsx` (`changeStatus` · 행사 취소 확인창 · 취소 뒤 `setCompose('CANCELLATION')`) · `model.ts` `transition` STATUS

---

## 운영 상세에 더하는 판정 필드

[event 「운영 행사 상세」](../event/spec.md#운영-행사-상세) 는 「모집 마감·재모집·행사 취소 가능 여부(`canClose` 등)는 상태 전환 스펙이 이 응답에 추가한다」고 남겨 두었다. 아래 여섯 필드를 `GET /api/admin/events/{eventId}` 응답에 더한다. 같은 본문을 쓰는 `POST /api/admin/events` · `PUT /api/admin/events/{eventId}` · 이 스펙의 `PATCH` 응답에도 똑같이 실린다. 운영 목록(`GET /api/admin/events`)에는 넣지 않는다 (목록에 버튼이 없다, §1-1).

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| canClose | Boolean | N | `모집 마감` 버튼을 보일까 | 계산: `ClubEvent.canClose(now)` = `STATUS = PUBLISHED` ∧ `now < effectiveEndsAt` (신청 마감과 무관, S3) |
| canReopen | Boolean | N | `모집 다시 열기` 를 바로 실행할 수 있나 | 계산: `ClubEvent.canReopen(now)` = `STATUS = CLOSED` ∧ `now < effectiveEndsAt` ∧ `now < STARTS_AT` ∧ `now < DEADLINE_AT` |
| reopenBlockedReason | String | Y | 모집 마감 상태인데 다시 열 수 없는 이유. `DEADLINE_PASSED` · `STARTED`. 그 밖(다시 열 수 있음 · 모집 마감 아님 · 종료 · 취소)은 null | 계산: `ClubEvent.reopenBlockedReason(now)` — 처리 순서 6·7 과 같은 순서(시작 먼저) |
| canCancel | Boolean | N | `행사 취소` 버튼을 보일까 | 계산: `ClubEvent.canCancel(now)` = `STATUS ≠ CANCELLED` ∧ `now < effectiveEndsAt` |
| hasCancellationRecipients | Boolean | N | 취소된 행사: 취소 안내를 받을 사람이 1명 이상인가. 취소 전 행사: 지금 취소하면 안내 대상이 생기는가 | 계산: `cancellationRecipientCount > 0` |
| cancellationRecipientCount | Integer | N | 취소된 행사: `CANCEL_REASON = EVENT_CANCELLED` 신청 중 **계정이 남아 있는** 사람 수. 취소 전 행사: 지금의 확인 대기 + 참가 확정 신청 중 계정이 남아 있는 사람 수 | 계산: `ClubEventRegistrationPort.countCancellationRecipients(eventId)` — `STATUS IN ('PENDING','CONFIRMED') OR CANCEL_REASON = 'EVENT_CANCELLED'` 인 신청 중 `ACCOUNT` 가 남은 수 (S5). 취소된 행사에는 유효 신청이 남지 않고(처리 순서 8) 취소 전 행사에는 `EVENT_CANCELLED` 행이 없으므로 한 조건이 두 뜻을 그대로 나눈다 |

- 버튼 표시 규칙 (프로토 `EventAdminDetail` 머리와 같다): `canClose` 면 `모집 마감`, `canReopen` 이거나 `reopenBlockedReason ≠ null` 이면 `모집 다시 열기` (후자는 누르면 이유 안내 창), `canCancel` 이면 `행사 취소`. 화면이 `status` · 시각으로 다시 판정하지 않는다
- `hasCancellationRecipients` 는 프로토 변수와 같은 두 뜻을 그대로 옮겼다. 취소 확인창 문구(「확인 대기와 참가 확정 신청도 모두 취소되며, 취소 사유를 담은 안내 메일 작성창이 열려요」 vs 「새 신청은 받을 수 없어요」)와 취소 뒤 빨간 `취소 안내 메일 보내기` 버튼(`status = CANCELLED ∧ hasCancellationRecipients`)이 모두 이 값을 쓴다. 0명이면 버튼을 숨긴다 (S5)

**탈퇴 계정 세기 (S5)**

- 두 수 모두 **현재 `ACCOUNT` 가 있는 사람만** 센다. 취소 당시 대상이었다가 그 뒤 탈퇴한 사람은 빠진다. 신청 이력과 `CANCEL_REASON` 은 그대로 남는다
- 취소 전 행사의 수는 탈퇴 처리(P3)가 종료 전 행사의 유효 신청을 이미 `ACCOUNT_DELETED` 로 취소하므로 보통 `seats[]` 의 확인 대기 + 참가 확정 합과 같다. 그래도 같은 기준(계정 대조)으로 세어 확인창 · 버튼 · 작성 창의 대상이 어긋나지 않게 한다
- 메일 미리보기 · 실제 발송은 수신자를 다시 확인한다 ([event-mail 「받는 사람」](../event-mail/spec.md#받는-사람)). 이미 만든 메일 이력의 발송 당시 인원(`EVENT_MAIL.RECIPIENT_COUNT`)은 이후 탈퇴와 관계없이 유지한다
- 계정 대조는 신청의 `ACCOUNT_ID` 묶음으로 `ACCOUNT` 를 한 번 읽는다. 잠그지 않는다
- 판정 메서드는 엔티티 하나에 둔다. 사이트용 행사 API(ST-038)가 「행사 취소」 표시를 할 때도 `displayStatus` 를 같은 메서드로 계산한다 ([endpoint-convention 규칙 1](../../docs/backend-development-guide/api/endpoint-convention.md#규칙))
- [event 「운영 행사 상세」](../event/spec.md#운영-행사-상세) 의 응답 표 · 예시에 이 여섯 필드를 옮겨 적었다 (이 스펙을 확정한 PR). 정의는 이 절이 정본이다

---

## 동시에 들어온 요청

모든 요청이 `CLUB_EVENT` 행 쓰기 잠금을 잡으므로, 결과는 누가 먼저 잠금을 얻었는지로 갈린다 ([event Q8](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서)).

| 겹친 요청 | 취소가 먼저 | 상대가 먼저 |
|---|---|---|
| 행사 취소 ↔ 크루 신청 제출 (ST-038) | 신청은 잠금 뒤 `STATUS = CANCELLED` 를 읽고 거절된다 | 신청이 `PENDING`·`CONFIRMED` 로 커밋된다. 취소는 잠금 뒤 그 신청까지 `EVENT_CANCELLED` 로 바꾸고 안내 대상에 넣는다 |
| 행사 취소 ↔ 운영진 참가 확정·참가 불가·개별 취소 | 참가자 처리는 409 `EVENT_CANCELLED` | 처리 결과가 먼저 커밋된다. 참가 불가·개별 취소된 신청은 취소 안내 대상에서 빠지고, 참가 확정된 신청은 대상에 들어간다 |
| 행사 취소 ↔ 행사 수정 (`PUT`) | 수정은 409 `EVENT_CANCELLED` (event 처리 순서 2) | 수정이 버전을 올린다. 취소는 409 `EVENT_VERSION_CONFLICT`, 화면은 최신 상세를 다시 읽고 확인창을 다시 띄운다 |
| 모집 마감 ↔ 다른 캡틴의 모집 마감 | 먼저 처리한 쪽이 마감한다 | 늦은 쪽은 S1 로 200 (버전이 낡았어도) |
| 모집 마감 ↔ 크루 신청 제출 | 신청은 잠금 뒤 `displayStatus = RECRUITMENT_CLOSED` 를 읽고 거절된다 | 신청이 접수된다. 마감은 그 뒤에 적용된다 |
| 재모집 ↔ 행사 수정의 마감 연장 | 재모집은 기존 마감으로 판정한다 (마감이 지났으면 409 `EVENT_REOPEN_DEADLINE_PASSED`) | 수정이 버전을 올린다. 재모집은 409 `EVENT_VERSION_CONFLICT`. 다시 불러오면 `canReopen` 이 새 마감으로 계산된다 |
| 행사 취소 ↔ 종료 자동 처리 ([event-participant](../event-participant/spec.md#행사-종료-시-확인-대기-자동-전환)) | 종료 처리는 잠금 뒤 `STATUS = CANCELLED` 를 읽고 아무것도 하지 않는다 | 종료 시각이 지났다면 취소는 409 `EVENT_ENDED` 다 |
| 행사 취소 ↔ 회원 탈퇴 | 위 「탈퇴와의 잠금 순서」 | 같음 |

---

## 데이터 모델 영향

새 테이블은 없다.

| 테이블 | 이 스펙이 쓰는 것 | 비고 |
|---|---|---|
| CLUB_EVENT | `STATUS` · `VERSION` 갱신. `DEADLINE_AT` · `STARTS_AT` · `ENDS_AT` · `TIME_ZONE` 읽기 | 컬럼 추가 없음 |
| CLUB_EVENT_REGISTRATION (V62) | 취소 때 `STATUS` · `CANCEL_REASON` · `STATUS_CHANGED_AT` · `STATUS_CHANGED_BY` · `UPDATED_AT` 갱신. 취소 안내 대상 COUNT | [ERD](../../docs/erd/CLUB_EVENT_REGISTRATION.md). V62 의 `idx_club_event_registration_event_channel_status (CLUB_EVENT_ID, CHANNEL, STATUS)` 가 행사 하나의 신청으로 좁히므로 새 인덱스는 필요 없다. 컬럼 추가 없음 |
| ADMIN_AUDIT_LOG | 행사 취소 때 `EVENT_CANCEL` 한 행 | 스키마 변경: `TARGET_ACCOUNT_ID` nullable · `CLUB_EVENT_ID` 추가 ([ERD 「구현 반영 메모」](../../docs/erd/ADMIN_AUDIT_LOG.md#구현-반영-메모)) |

### 도메인 이벤트

| name | 클래스 | 언제 | aggregate · actor | 페이로드 | 구독자 |
|---|---|---|---|---|---|
| `club_event.cancelled` | `ClubEventCancelledEvent` (`com.studyclub.domain.event`, 신규) | 행사가 실제로 `CANCELLED` 로 바뀜 — 취소 1건마다 1개. S1 무변화·409 는 발행하지 않는다 | `club_event` · clubEventId · 취소한 캡틴 | `clubEventId` · `cancelledRegistrationIds`(처리 순서 8 에서 바꾼 신청, 빈 배열 가능). 연락처·답변·안내 본문은 싣지 않는다 | `AnalyticsEventListener` (`AFTER_COMMIT`, `@Async`) — 취소된 신청마다 취소 완료 분석 이벤트. 메일·ops 알림 구독자 없음 |

- 신청별 취소 이벤트(`ClubEventRegistrationsCancelledEvent`)는 **발행하지 않는다.** 그 이벤트에는 자동 취소 메일 구독자([event-mail](../event-mail/spec.md#자동-메일-신청-상태-알림))가 붙어 S2 를 어긴다. 분석은 이 행사 단위 이벤트로 받는다
- PR #517 이 미리 넣어 둔 `ClubEventRegistrationsCancelledEvent.Cause.EVENT_CANCELLED` 는 구현 PR 에서 지웠다. 분석 속성 `cancel_type = event_cancelled` 는 `AnalyticsEventListener.onClubEventCancelled` 가 보낸다. [domain-events 「이벤트」](../domain-events/spec.md#이벤트) 표에 `club_event.cancelled` 줄이 있다

## 퍼널·계측

PRD §3 「행사 취소 행동 분석」(PR #509) 을 따른다.

- **퍼널 단계**: 활성화 뒤 행동 (신청 철회). 최초 활성화는 ST-038 의 첫 신청이 정하고, 행사 전체 취소는 활성화를 새로 만들거나 되돌리지 않는다
- **이벤트**: 행사 전체 취소로 실제로 `PENDING`·`CONFIRMED` → `CANCELLED` 로 바뀐 신청마다 Amplitude **신청 취소 완료** 이벤트 1건. 이미 취소·참가 불가였던 신청은 새로 세지 않고, 바뀐 신청이 0건이면 보내지 않는다
- **이름·속성 ([analytics](../analytics/spec.md) 트래킹 플랜에 있음)**: Amplitude `Event Registration Cancelled` (Title Case 과거형), 속성 `event_id` · `registration_id` · `channel`(`online`·`offline`) · `cancel_type` = `event_cancelled` (본인 취소 `self` · 운영진 개별 취소 `admin` 과 같은 이벤트·같은 속성으로 구분, ST-038 · [event-participant](../event-participant/spec.md#퍼널계측) 와 맞춘다). GA4 는 보내지 않는다 (PRD 「Amplitude에 기록」)
- **보내는 곳**: server. 사용자는 **신청자**(취소한 캡틴이 아니다), 분석 ID 는 [analytics](../analytics/spec.md) 의 기존 식별자
- **시점·전달**: 커밋 뒤 `AFTER_COMMIT` · 비동기. 전송 실패는 삼키고 행사·신청 취소 · 감사 기록을 되돌리지 않는다
- **중복 방지**: `insert_id` 는 자연키에서 결정적으로 만든다 — `event_registration_cancelled_{registrationId}`. 같은 신청은 한 번만 취소되므로 재전송·재시도에도 중복 집계되지 않는다
- **개인정보**: 이메일 · 이름 · 닉네임 · 신청 답변 · 취소 안내 본문을 보내지 않는다. 수집 중단(분석 거부)·탈퇴한 계정은 analytics 스펙의 기존 규칙대로 보내지 않는다
- **취소 안내 메일과 무관**: 작성 창을 닫거나 메일을 보내지 않아도 취소가 저장됐다면 기록한다
- **OMTM 기대 변화**: 없음 (취소 사유별 철회 규모를 보는 관찰용). 실험(A/B) 없음
- 트래킹 플랜 [analytics 스펙](../analytics/spec.md) 의 `Event Registration Cancelled` 줄에 `cancel_type = event_cancelled` 가 있고 (PR #517), 「언제」 칸에 행사 전체 취소는 `club_event.cancelled` 로 보낸다고 적었다. 이름 · 속성은 바꾸지 않았다

## 근거와 PRD·프로토·레포 규약의 차이

| 항목 | PRD · 프로토 | 이 스펙 |
|---|---|---|
| 취소 안내 대상 보존 | 프로토는 행사에 `cancellationRecipientIds` 배열을 둔다 | 신청 행의 `CANCEL_REASON = EVENT_CANCELLED` 로 같은 집합을 얻는다. 수는 계정이 남은 사람만 (S5) |
| 재모집 때 다시 검사 | 프로토는 `validateEvent` 전체를 다시 돌린다 | 시각 조건(시작 · 신청 마감)만 본다 |
| 시작 후 재모집 | 프로토는 같은 이유 창에서 문구만 나눈다 | 별도 코드 `EVENT_ALREADY_STARTED` 와 `reopenBlockedReason = STARTED` 로 나눈다 |
| 같은 상태 요청 | 프로토는 같은 상태로 바꿔도 막지 않는다 | 200 · 변화 없음 · 버전이 낡아도 성공 (S1) |
| 버전 | 프로토는 버전이 없다 | 요청 `version` 필수. 실제 상태 변경에만 검사하고 `STATUS` 가 바뀔 때만 +1 (event N3, S1) |
| 행사 취소 기록 | 프로토 없음 | `ADMIN_AUDIT_LOG` `EVENT_CANCEL` (S4) · 신청별 분석 이벤트 (PR #509) |
| 잠금 첫 조회 | event 「첫 조회로 `CLUB_EVENT`」 | 그대로. 탈퇴 · 크루 신청 제출만 `ACCOUNT → CLUB_EVENT` (PR #508 R1). [event 스펙 잠금 표](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서) 에 두 행을 반영했다 |

## 결정 기록 (PR #479 리뷰)

리뷰: 2026-11-18, PR #479 S1~S5 (PRD §1 반영 PR #484). 행동 분석: PR #509 (PR #508 R4 합의).

| 결정 | 내용 | 반영한 곳 |
|---|---|---|
| S1 | 이미 요청한 상태(공개 중 → 공개 중, 모집 마감 → 모집 마감)면 버전이 낡았어도 200 으로 최신 상세. 버전 증가 · 감사 기록 · 이벤트 없음. 취소·종료 행사는 409 유지. 실제 상태 변경에만 버전 검사 | 전이표, 처리 순서 4·5, 동시 요청 표 |
| S2 | 행사 전체 취소는 자동 메일 없음. 캡틴이 취소 안내 템플릿으로 작성·미리보기 후 발송. 대상이 있을 때만 작성 창을 바로 열고, 닫아도 취소 유지 · 다시 열기 가능. 개별·본인 취소 자동 메일 유지. 미발송 독촉 알림 없음 | 「취소와 메일」, 도메인 이벤트 |
| S3 | 신청 마감 뒤에도 종료 전·취소 아님이면 수동 모집 마감 허용. 마감 연장으로 자동 재개되지 않음. 본인 취소는 신청 마감 전까지, 그 뒤는 운영진 개별 취소 | 「신청 마감 뒤의 수동 모집 마감」, `canClose` |
| S4 | 신청자 유무와 관계없이 행사 취소 감사 기록. 캡틴 · 행사 ID · 시각 · 함께 취소된 신청 수. 개인정보·본문 제외. 같은 트랜잭션, 실패 시 롤백. 운영자 알림·조회 화면 없음 | 「행사 취소 감사 기록」, 처리 순서 10, [ADMIN_AUDIT_LOG ERD](../../docs/erd/ADMIN_AUDIT_LOG.md) |
| S5 | 취소 안내 수와 `hasCancellationRecipients` 는 계정이 남은 사람만. 0명이면 버튼 숨김. 취소 전 확인창도 같은 기준. 이력·사유 보존, 발송 때 재확인, 이력 인원 고정 | 판정 필드 표 「탈퇴 계정 세기」 |
| #509 | 행사 전체 취소로 바뀐 신청마다 커밋 뒤 신청자 기준 취소 완료 분석 이벤트. 0건이면 없음, 중복 집계 없음, 실패해도 취소 유지, 개인정보 제외 | 「퍼널·계측」, 도메인 이벤트 |
