# 행사 참가자 API Spec: 캡틴이 신청자를 보고 참가를 처리한다

> ERD: 신청 테이블이 아직 없다. 아래 「데이터 모델 제안: CLUB_EVENT_REGISTRATION」이 초안이고, ST-038 신청 스펙과 합의한 뒤 `docs/erd/CLUB_EVENT_REGISTRATION.md` 를 만든다. 그 밖: [ACCOUNT](../../docs/erd/ACCOUNT.md), [ADMIN_AUDIT_LOG](../../docs/erd/ADMIN_AUDIT_LOG.md), 행사 테이블은 [event 「데이터 모델 제안」](../event/spec.md#데이터-모델-제안) (PR #478 V59)
> 생성일: 2026-11-18
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 행사를 등록하고 신청자의 참가를 확정할 수 있다](../../01-planning/stories/captain-manage-events/PRD.md) (ST-037) §6 「참가자」 · §3 데이터와 처리 규칙
> - 경계: [크루는 행사에 신청하고 참가 확정 상태를 확인할 수 있다](../../01-planning/stories/crew-apply-event/PRD.md) (ST-038) §3 · §4 · §5 — 신청 테이블을 함께 쓴다
>
> 기준 스펙: [event](../event/spec.md) (잠금 · 정원 · 신청 질문의 보존 · 판정 메서드) · [event-status](../event-status/spec.md) (행사 취소가 바꾸는 신청) · [admin-users](../admin-users/spec.md#이메일-보기) (이메일 보기 규약)
> 기준 프로토타입: playground `/proto/console/events/{id}` 참가자 탭 (`EventAdminDetail.tsx`)
> 판정 로직의 근거: `frontend/apps/playground/src/proto/events/model.ts` (`transition` 의 `DECIDE` · `ADMIN_CANCEL` · `canManageEventRegistrations` · `occupiesSeat`) · `EventWorkspace.tsx` → `settleEndedRegistrations`

## 엔드포인트 목록

**백오피스: `/api/admin/events/{eventId}/registrations` (`AdminClubEventRegistrationController` 제안, 캡틴만)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/events/{eventId}/registrations | 참가자 탭: 전체 신청 이력(재신청 전 취소 이력 포함), 최신 신청순. 이메일은 마스킹, 행별 처리 가능 여부 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/events/{eventId}/registrations/{registrationId} | 신청서: 신청 당시 질문 사본과 답변 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/events/{eventId}/registrations/{registrationId}/email-reveals | 신청자 한 명의 이메일 원본 보기. 볼 때마다 감사 로그 | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/events/{eventId}/registrations/{registrationId} | 참가 확정 · 참가 불가 · 운영진 개별 취소 | O (ADMIN) | 스펙작성중 |

행사 종료 때 남은 확인 대기 신청을 참가 불가로 바꾸는 일은 엔드포인트가 아니라 스케줄러다 (아래 「행사 종료 시 확인 대기 자동 전환」).

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 먼저 읽을 것

### 이 스펙이 다루는 것과 안 다루는 것

| 다룬다 | 다루지 않는다 | 닿는 곳 |
|---|---|---|
| 운영진이 보는 신청 목록 · 신청서 · 이메일 보기 · 참가 확정 · 참가 불가 · 개별 취소 · 종료 시 자동 참가 불가 | 크루 신청 제출 · 본인 취소 · 내 신청 내역 · 사이트 행사 조회 (ST-038) | 신청 테이블 `CLUB_EVENT_REGISTRATION` (아래 제안, ST-038 과 공동) |
| | 모집 마감 · 재모집 · 행사 취소 ([event-status](../event-status/spec.md)) | 행사 취소의 `CANCEL_REASON = EVENT_CANCELLED` |
| | 자동 메일 템플릿 · 발송 ([event-mail](../event-mail/spec.md)) | 이 스펙의 처리가 발행하는 도메인 이벤트 |
| | 확정 방식 전환의 일괄 확정 ([event](../event/spec.md#확정-방식-전환-수정의-연관-효과)) | 같은 `ClubEventRegistrationsConfirmedEvent` 를 쓴다 |

### 인가

- [event 「인가」](../event/spec.md#인가) 와 같다. `@RequireAdmin` 으로 캡틴(`SYSTEM_ROLE = ADMIN`)만. 토큰 없으면 401, ADMIN 아니면 403. 401 · 403 을 404 보다 먼저 본다
- 신청이 그 행사의 것인지(`CLUB_EVENT_REGISTRATION.CLUB_EVENT_ID = eventId`)는 서버가 확인한다. 다른 행사의 `registrationId` 를 붙이면 404 다. 경로의 두 ID 를 따로 믿지 않는다
- 버튼 숨김은 표시용이다. 서버가 요청마다 다시 판정한다

### 시각

- 응답의 모든 절대 시각은 UTC ISO 8601. 화면은 운영자 프로필 시간대로 바꿔 보여 준다 (PRD §7 「운영자 프로필 시간대로 변환」)
- 시각이 걸린 판정(`now ≥ effectiveEndsAt`)은 서버 시각으로 한다

### 신청 상태

PRD §3 「신청 상태: 확인 대기, 참가 확정, 참가 불가, 신청 취소」. 저장 상태 `CLUB_EVENT_REGISTRATION.STATUS` 하나로 둔다.

| 값 | 화면 | 자리 | 뜻 |
|---|---|---|---|
| `PENDING` | 확인 대기 | 차지 | 운영진 확인 방식(`REVIEW`)으로 접수 |
| `CONFIRMED` | 참가 확정 | 차지 | 자동 확정 접수 · 운영진 확정 · 확정 방식 전환 |
| `DECLINED` | 참가 불가 | 반환 | 운영진 참가 불가 · 행사 종료 시 자동 전환 |
| `CANCELLED` | 신청 취소 | 반환 | 본인 취소 · 운영진 개별 취소 · 행사 취소 (`CANCEL_REASON` 으로 구분) |

```mermaid
stateDiagram-v2
    [*] --> PENDING : 신청 제출 (REVIEW) — ST-038
    [*] --> CONFIRMED : 신청 제출 (AUTO) — ST-038
    PENDING --> CONFIRMED : 운영진 참가 확정 · REVIEW→AUTO 전환 (event)
    PENDING --> DECLINED : 운영진 참가 불가 · 행사 종료 자동 전환
    PENDING --> CANCELLED : 본인 취소 (ST-038) · 운영진 개별 취소 · 행사 취소 (event-status)
    CONFIRMED --> CANCELLED : 본인 취소 (ST-038) · 운영진 개별 취소 · 행사 취소 (event-status)
    DECLINED --> [*]
    CANCELLED --> [*]
```

- `DECLINED` · `CANCELLED` 는 끝 상태다. 되살리지 않는다. 취소한 크루가 다시 신청하면 **새 행**이 생긴다 (crew-apply-event §3 「취소 후에는 모집 중이면 재신청 가능」, PRD §6 「취소된 이전 신청과 최신 신청을 각각 표시」)
- 유효 인원(자리 차지) = `PENDING` + `CONFIRMED` ([event 「정원과 잔여석」](../event/spec.md#정원과-잔여석)). 참가 확정은 자리를 유지하고, 참가 불가·취소는 자리를 반환한다 (PRD §6). 잔여석이 생기면 `displayStatus` 는 요청마다 다시 계산되어 조건이 맞으면 `RECRUITING` 으로 돌아간다 (event Q11). 따로 전환하는 처리는 없다

### 처리 가능 여부: `canManageRegistrations`

운영진 처리(확정 · 참가 불가 · 개별 취소)는 **행사가 취소되지 않았고 종료 전**일 때만 된다. 행사 시작 뒤·신청 마감 뒤라도 종료 전이면 된다 (PRD §6 「행사 시작 후에도 종료 전까지 신청 상태에 따라 가능한 처리 버튼 표시」 · 「마감 후 취소 요청도 처리」 · 「종료·취소된 행사의 신청은 조회만 가능」).

계산: `ClubEvent.canManageRegistrations(now)` = `STATUS ≠ CANCELLED` ∧ `now < effectiveEndsAt` (프로토 `canManageEventRegistrations` 와 같은 식. [event](../event/spec.md) 의 `canEdit(now)` 와 식이 같지만 근거 규칙(§2 편집 · §6 참가자 처리)이 달라 따로 둔다).

행별 판정 (프로토 `EventAdminDetail` 처리 열):

| 신청 상태 | `canConfirm` | `canDecline` | `canCancel` | 화면 |
|---|---|---|---|---|
| `PENDING` | `canManageRegistrations` | `canManageRegistrations` | `canManageRegistrations` | 참가 확정 · 참가 불가 · 신청 취소 |
| `CONFIRMED` | false | false | `canManageRegistrations` | 신청 취소만 (PRD §6 「확정자는 신청 취소만 표시」) |
| `DECLINED` · `CANCELLED` | false | false | false | 처리 완료 |

- 세 값이 모두 false 면 화면은 「처리 완료」를 그린다. 화면이 `status` 와 행사 시각으로 다시 판정하지 않는다
- 계산: `ClubEventRegistration.canConfirm(manageable)` 등 (제안). `manageable` 은 같은 응답의 `canManageRegistrations` 한 값을 모든 행에 넘긴다

---

## 참가자 목록

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/events/{eventId}/registrations`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 그 행사의 **모든 신청 행**을 최신 신청순으로. 같은 크루가 취소 후 다시 신청했으면 취소된 이전 행과 최신 행이 각각 나온다 (PRD §6). 종료·취소 행사도 조회한다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| offset | Integer | N | 0 | 0 이상 |
| limit | Integer | N | 100 | 1 ~ 100 |

- 정렬: `CREATED_AT DESC, ID DESC` 고정. 프로토는 새 신청을 `unshift` 로 맨 앞에 넣어 최신 신청이 위다 (`transition` APPLY). 같은 시각이면 나중에 만든 행이 위
- 페이지 크기 100 · 페이지네이션 여부는 미확정 P1. 정원이 방식마다 최대 10,000명이라 한 응답에 전부 싣지 않는다. 프로토는 한 화면에 전부 그리므로, 화면은 `total ≤ limit` 이면 페이지 이동을 그리지 않는다
- 상태 필터·검색은 이번 범위가 아니다 (PRD 에 없다)

### Request Body

없음

### Response — 200

```json
{
  "canManageRegistrations": true,
  "pendingCount": 1,
  "items": [
    {
      "registrationId": 312,
      "accountId": 48,
      "nickname": "수현",
      "accountDeleted": false,
      "maskedEmail": "s***@naver.com",
      "channel": "ONLINE",
      "status": "PENDING",
      "createdAt": "2026-11-20T03:14:00Z",
      "canConfirm": true,
      "canDecline": true,
      "canCancel": true
    },
    {
      "registrationId": 298,
      "accountId": 48,
      "nickname": "수현",
      "accountDeleted": false,
      "maskedEmail": "s***@naver.com",
      "channel": "OFFLINE",
      "status": "CANCELLED",
      "createdAt": "2026-11-19T11:02:00Z",
      "canConfirm": false,
      "canDecline": false,
      "canCancel": false
    },
    {
      "registrationId": 251,
      "accountId": 17,
      "nickname": null,
      "accountDeleted": true,
      "maskedEmail": null,
      "channel": "OFFLINE",
      "status": "CONFIRMED",
      "createdAt": "2026-11-18T09:40:00Z",
      "canConfirm": false,
      "canDecline": false,
      "canCancel": true
    }
  ],
  "total": 3,
  "offset": 0,
  "limit": 100
}
```

같은 크루(`accountId = 48`)가 오프라인으로 신청했다가 취소하고 온라인으로 다시 신청한 경우다. 세 번째 행은 신청 뒤 탈퇴한 크루다 (아래 「탈퇴한 크루의 신청」).

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| canManageRegistrations | Boolean | N | 이 행사에서 지금 참가자를 처리할 수 있나. false 면 화면은 조회 전용 | 계산: `ClubEvent.canManageRegistrations(now)` |
| pendingCount | Integer | N | 확인 대기 신청 수. 참가자 탭 배지 「확인 대기 N」 | 계산: `COUNT(STATUS = PENDING)` — 운영 상세 `seats[].pending` 합과 같은 쿼리(`ClubEventRegistrationPort.countActiveSeats`) |
| items[].registrationId | Long | N | 신청 ID. 신청서·이메일 보기·처리의 경로 값 | CLUB_EVENT_REGISTRATION.ID |
| items[].accountId | Long | N | 신청한 계정 ID. 탈퇴해도 값은 남는다 (ID 참조) | CLUB_EVENT_REGISTRATION.ACCOUNT_ID |
| items[].nickname | String | Y | 닉네임. 탈퇴한 계정이면 null — 화면은 「탈퇴한 회원」 | ACCOUNT.NICKNAME (현재 값) |
| items[].accountDeleted | Boolean | N | 계정이 지워졌나 (탈퇴) | 계산: ACCOUNT 행 없음 |
| items[].maskedEmail | String | Y | 가린 이메일. 앞 1자 + `***` + `@` 이후. 원본은 [이메일 보기](#이메일-보기) 로만. 탈퇴한 계정이면 null | 계산: ACCOUNT.EMAIL 마스킹 ([security-guide](../../docs/backend-development-guide/security-guide.md#마스킹-기준), admin-users 와 같은 함수) |
| items[].channel | String | N | `ONLINE` · `OFFLINE` | CLUB_EVENT_REGISTRATION.CHANNEL |
| items[].status | String | N | `PENDING` · `CONFIRMED` · `DECLINED` · `CANCELLED` | CLUB_EVENT_REGISTRATION.STATUS |
| items[].createdAt | String | N | 신청 시각, UTC | CLUB_EVENT_REGISTRATION.CREATED_AT |
| items[].canConfirm | Boolean | N | 참가 확정 버튼 | 계산: 위 「행별 판정」 |
| items[].canDecline | Boolean | N | 참가 불가 버튼 | 계산: 위 「행별 판정」 |
| items[].canCancel | Boolean | N | 신청 취소 버튼 | 계산: 위 「행별 판정」 |
| total | Long | N | 그 행사의 전체 신청 행 수. 화면 「전체 신청 이력 N건」 | 계산: COUNT |
| offset | Integer | N | 요청 값 | — |
| limit | Integer | N | 요청 값 | — |

- 이메일은 **서버가 가린다.** 원본을 응답에 싣고 화면이 가리는 방식은 쓰지 않는다 (PRD §6 「기존 운영 콘솔 규칙으로 기본 마스킹」, [admin-users](../admin-users/spec.md) · [notification 「수신 주소는 서버가 가린 채로」](../notification/spec.md#get-apiadminnotifications)). 필드 이름을 `maskedEmail` 로 두어 원본으로 착각하지 않게 한다
- 닉네임·이메일은 **현재 계정 값**을 읽는다. 신청 행에 스냅샷하지 않는다 (아래 데이터 모델 「연락처를 신청 행에 두지 않는 이유」)
- 페이지 한 번에 `ACCOUNT` 를 ID 묶음으로 한 번 읽는다 (N+1 금지)
- 판정 필드와 페이지 메타를 한 객체에 둔다. 페이지 envelope 은 `items` · `total` · `offset` · `limit` 을 **포함**해야 한다는 규칙([endpoint-convention 「응답 포맷」](../../docs/backend-development-guide/api/endpoint-convention.md#응답-포맷))이라 판정 필드를 더해도 계약과 어긋나지 않는다
- `offset ≥ total` 이면 `items = []`, `total` 은 실제 값

**신청서 답변을 목록에 싣지 않는 이유**

| | 목록에 싣기 | 단건 GET 으로 떼기 (채택) |
|---|---|---|
| 응답 크기 | 행마다 질문 최대 20개 사본 + 장문 답변. 100행이면 수백 KB | 목록은 짧다 |
| 개인정보 | 답변(자유 서술)이 화면을 열 때마다 통째로 내려간다 | `답변 보기` 를 누른 한 명 것만 |
| 프로토 | `답변 보기` 버튼이 행마다 있고 누르면 창을 연다. 버튼은 질문이 없어도 보인다(창에 「추가 질문이 없는 신청서입니다」) | 버튼을 누를 때 한 번 부른다. 그래서 `hasQuestions` 같은 필드도 필요 없다 |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `offset < 0` · `limit` 이 1~100 밖 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | `eventId` 없음 |

### 프론트엔드 사용처

- back-office-front 행사 상세 「참가자」 탭 (아직 없음). `features/events/queries.ts` → `useEventRegistrations(eventId, page)`
- 근거 시안: `frontend/apps/playground/src/proto/events/EventAdminDetail.tsx` 참가자 표 · 탭 배지 `확인 대기 N` · 「전체 신청 이력 N건」

---

## 신청서 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/events/{eventId}/registrations/{registrationId}`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 신청 당시 저장한 질문 사본과 답변. 이후 행사 질문을 고치거나 지워도 바뀌지 않는다 (PRD §4 「기존 신청은 신청 당시 질문·답변을 유지하며 현재 행사 질문으로 덮어쓰지 않음」, §6 「신청 당시 질문과 답변 조회」, [event 「신청 질문의 보존」](../event/spec.md#신청-질문의-보존))

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |
| registrationId | Long | 신청 ID (`items[].registrationId`) |

### Query Parameters · Request Body

없음

### Response — 200

```json
{
  "registrationId": 312,
  "nickname": "수현",
  "accountDeleted": false,
  "channel": "ONLINE",
  "status": "PENDING",
  "createdAt": "2026-11-20T03:14:00Z",
  "questions": [
    {
      "questionId": "q_7f3a",
      "label": "참여 동기",
      "type": "TEXTAREA",
      "required": true,
      "options": [],
      "answer": ["한 해 동안 함께한 크루를 만나고 싶어요."]
    },
    {
      "questionId": "q_91c2",
      "label": "관심 주제",
      "type": "CHECKBOX",
      "required": false,
      "options": ["AI", "커리어", "네트워킹"],
      "answer": ["AI", "네트워킹"]
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| registrationId | Long | N | | CLUB_EVENT_REGISTRATION.ID |
| nickname | String | Y | 창 제목 「{닉네임} 신청서」. 탈퇴면 null | ACCOUNT.NICKNAME |
| accountDeleted | Boolean | N | | 계산: ACCOUNT 행 없음 |
| channel | String | N | | CLUB_EVENT_REGISTRATION.CHANNEL |
| status | String | N | | CLUB_EVENT_REGISTRATION.STATUS |
| createdAt | String | N | UTC | CLUB_EVENT_REGISTRATION.CREATED_AT |
| questions | Array | N | 신청 당시 질문 순서 그대로. 질문 없는 행사였으면 `[]` — 화면은 「추가 질문이 없는 신청서입니다」 | CLUB_EVENT_REGISTRATION.QUESTIONS_SNAPSHOT (JSON) |
| questions[].questionId | String | N | 신청 당시 질문 키 (`CLUB_EVENT_QUESTION.QUESTION_KEY` 사본) | QUESTIONS_SNAPSHOT |
| questions[].label | String | N | 신청 당시 질문 제목 | QUESTIONS_SNAPSHOT |
| questions[].type | String | N | `TEXT` · `TEXTAREA` · `RADIO` · `CHECKBOX` | QUESTIONS_SNAPSHOT |
| questions[].required | Boolean | N | | QUESTIONS_SNAPSHOT |
| questions[].options | String[] | N | 신청 당시 선택지. TEXT·TEXTAREA 는 `[]` | QUESTIONS_SNAPSHOT |
| questions[].answer | String[] | N | 답. 언제나 배열이다: TEXT·TEXTAREA·RADIO 는 0~1개, CHECKBOX 는 0~N개. 답하지 않은 선택 질문은 `[]` — 화면은 「답변 없음」, CHECKBOX 는 `, ` 로 이어 그린다 | CLUB_EVENT_REGISTRATION.ANSWERS_SNAPSHOT (JSON) 를 questionId 로 맞춘 값 |

- 답을 질문 안에 넣어 내려 준다. 프로토는 `questions` 와 `answers[questionId]` 를 따로 들고 화면이 맞추지만, 서버가 한 번 맞춰 주면 화면이 키를 다시 대조하지 않는다
- 답의 타입을 `String | String[]` 로 섞지 않고 배열 하나로 고정한다. Java·Zod 양쪽에서 타입이 갈리지 않는다
- 현재 행사 질문(`CLUB_EVENT_QUESTION`)을 조인해 다시 그리지 않는다. 그 방식은 event 스펙이 금지했다
- 이메일은 싣지 않는다 (목록에 마스킹 값이 이미 있고, 원본은 이메일 보기로만)
- 종료·취소 행사의 신청서도 조회한다

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | `eventId` 없음 · `registrationId` 없음 · 그 신청이 이 행사 것이 아님 |

### 프론트엔드 사용처

- back-office-front 참가자 탭 `답변 보기` 창 (아직 없음). `useEventRegistration(eventId, registrationId)` — 창을 열 때만 부른다
- 근거 시안: `EventAdminDetail.tsx` 「{name} 신청서」 Modal

---

## 이메일 보기

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/events/{eventId}/registrations/{registrationId}/email-reveals`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 신청자 한 명의 이메일 원본. 돌려줄 때마다 `ADMIN_AUDIT_LOG` 에 `EMAIL_REVEAL` 한 행을 남긴다. 규약은 [admin-users 「이메일 보기」](../admin-users/spec.md#이메일-보기) 와 같다

**왜 POST 인가** (admin-users 와 같다). 이 요청은 「보기」라는 사건을 하나 기록한다. GET 으로 두면 프리페치·재시도·링크 미리보기만으로 감사 기록이 쌓이거나, 반대로 캐시가 응답을 대신해 기록 없이 원본이 보일 수 있다. POST 는 브라우저와 라이브러리가 알아서 부르지 않는다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |
| registrationId | Long | 신청 ID |

### Query Parameters · Request Body

없음

### 처리 규칙

한 트랜잭션 안에서:

1. 신청이 없거나 그 행사의 것이 아니면 `404 NOT_FOUND`. 감사 기록을 남기지 않는다
2. 신청의 `ACCOUNT_ID` 로 계정을 읽는다. 계정이 없으면(탈퇴) `404 NOT_FOUND`. 감사 기록을 남기지 않는다 (미확정 P3)
3. `ADMIN_AUDIT_LOG` 에 `(ACTOR_ACCOUNT_ID = 요청자, ACTION = EMAIL_REVEAL, TARGET_ACCOUNT_ID = 신청자 ACCOUNT_ID, ACTOR_IP = 요청 IP)` 한 행을 쓴다. 보관 규칙(`RETENTION_POLICY` · `EXPIRES_AT`, 조회 1년)은 admin-users 와 같은 경로로 채운다 ([data-retention](../data-retention/spec.md))
4. 이메일 원본을 돌려준다

- **기록이 안 남으면 이메일도 안 나간다.** 3 이 실패하면 트랜잭션이 롤백되고 `500 INTERNAL_ERROR` 다
- 응답 헤더 `Cache-Control: no-store`. 원본이 브라우저·프록시 캐시에 남지 않게 한다
- 횟수 제한은 두지 않는다 (admin-users 와 같다). 누가 몇 번 봤는지는 감사 로그로 남는다
- 행사 행을 잠그지 않는다. 신청 상태를 바꾸지 않는 읽기 + 감사 기록이라 [event 잠금 규칙](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서) 의 대상이 아니다
- 종료·취소 행사의 신청도 볼 수 있다 (PRD §6 「종료·취소된 행사의 신청은 조회만 가능」 — 보기는 조회다)
- `ACTION` 은 회원 목록과 같은 `EMAIL_REVEAL` 을 쓴다. 감사 로그가 답하려는 질문(「누가 언제 이 사람의 이메일을 봤나」)이 같다. [ADMIN_AUDIT_LOG ERD](../../docs/erd/ADMIN_AUDIT_LOG.md) 의 `EMAIL_REVEAL` 설명(「백오피스 회원 목록에서」)은 구현 PR 에서 「회원 목록 · 행사 참가자 탭에서」로 고친다. 어느 화면에서 봤는지 따로 남길지는 미확정 P4

### Response — 200

```json
{ "registrationId": 312, "accountId": 48, "email": "suhyeon@example.com" }
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| registrationId | Long | N | | CLUB_EVENT_REGISTRATION.ID |
| accountId | Long | N | | CLUB_EVENT_REGISTRATION.ACCOUNT_ID |
| email | String | N | 이메일 원본 | ACCOUNT.EMAIL |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음·무효, 또는 토큰의 계정이 없음 |
| 403 | FORBIDDEN | ADMIN 아님. 감사 기록 없음 |
| 404 | NOT_FOUND | `eventId` · `registrationId` 없음, 그 행사 신청이 아님, 신청자 계정이 없음(탈퇴). 감사 기록 없음 |
| 500 | INTERNAL_ERROR | 감사 기록 실패 — 원본을 보내지 않는다 |

### 프론트엔드 사용처

- back-office-front 참가자 탭 이메일 칸 눈 아이콘. 동작은 [admin-users 이메일 보기 「프론트엔드 사용처」](../admin-users/spec.md#이메일-보기) 와 같다: 누르면 버튼을 막고 「확인 중…」, 성공하면 **그 행만** 원본과 가림 아이콘. 가림은 API 를 부르지 않고 화면 메모리에서 지운다. 다시 펼치면 다시 부른다(다시 기록된다). 원본은 쿼리 캐시·URL·localStorage 에 두지 않는다. 화면을 다시 열면 마스킹 (PRD §6)
- `accountDeleted = true` 인 행은 눈 아이콘을 그리지 않는다
- `useRevealRegistrationEmail()` mutation 신설
- 근거 시안: `EventAdminDetail.tsx` `EventEmail` (프로토는 원본을 들고 있다가 가린다. 실제 앱은 위 규약대로 서버가 가린다)

---

## 참가 처리

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/events/{eventId}/registrations/{registrationId}`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 신청 한 건을 참가 확정 · 참가 불가 · 운영진 개별 취소로 바꾼다. 바꾸면 신청자에게 자동 메일 예약(`NOTIFICATION` 행)을 같은 트랜잭션에 만든다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |
| registrationId | Long | 신청 ID |

### Query Parameters

없음

### Request Body

```json
{ "status": "CONFIRMED" }
```

| 필드 | 타입 | 필수 | 검증 | 근거 |
|------|------|------|------|------|
| status | String | Y | `CONFIRMED` · `DECLINED` · `CANCELLED` 중 하나. `PENDING` 은 받지 않는다 (400) | PRD §6 「확인 대기자를 참가 확정 또는 참가 불가로 처리」 · 「확인 대기·참가 확정 신청을 개별 취소」, `transition` `DECIDE` · `ADMIN_CANCEL` |

- 행사 `version` 은 받지 않는다. 참가 처리는 신청 행만 바꾸므로 `CLUB_EVENT.VERSION` 을 올리지 않는다 ([event 「동시 수정 방지: 버전」](../event/spec.md#동시-수정-방지-버전-q14-결정) 「신청 제출·참가 처리는 … `version` 을 올리지 않는다」). 같은 신청을 두 캡틴이 동시에 처리하는 경우는 아래 5·6 의 상태 검사가 막는다
- 참가 불가·개별 취소의 사유 입력은 없다 (PRD 에 없다)

### 처리 순서

인가(401 · 403)와 본문 검증(400)을 통과한 뒤, 한 트랜잭션에서 아래 순서로 처리한다. 먼저 걸리는 것 하나만 응답하고, 실패하면 아무것도 바꾸지 않는다.

| # | 단계 | 실패 | 근거 |
|---|---|---|---|
| 1 | `CLUB_EVENT` 행을 쓰기 잠금으로 읽는다 (`SELECT … FOR UPDATE`, **트랜잭션의 첫 조회**). 없으면 | 404 `NOT_FOUND` | [event 「같은 행사에 쓰는 요청의 처리 순서」](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서) — 「운영진의 참가자 처리」는 이 잠금을 잡는 요청으로 등록되어 있다 |
| 2 | 잠금 뒤 읽은 `STATUS = CANCELLED` | 409 `EVENT_CANCELLED` | PRD §6 「종료·취소된 행사의 신청은 조회만 가능」, `transition` 「종료되거나 취소된 행사의 신청은 처리할 수 없습니다」 |
| 3 | 잠금 뒤 읽은 값으로 `now ≥ effectiveEndsAt`. **시작 후·신청 마감 후라도 종료 전이면 통과** | 409 `EVENT_ENDED` | 같은 곳, `canManageEventRegistrations` |
| 4 | 신청을 읽는다. 없거나 `CLUB_EVENT_ID ≠ eventId` | 404 `NOT_FOUND` | — |
| 5 | `CONFIRMED` · `DECLINED` 요청인데 신청이 `PENDING` 이 아니다 | 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` | `transition` DECIDE 「현재 상태에서는 처리할 수 없습니다」 |
| 6 | `CANCELLED` 요청인데 신청이 `PENDING` · `CONFIRMED` 가 아니다 | 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` | `transition` ADMIN_CANCEL 「취소할 수 없는 신청입니다」(`occupiesSeat`) |
| 7 | 상태를 바꾼다. 조건부 갱신(`UPDATE … SET STATUS = ? WHERE ID = ? AND STATUS = ?(읽은 상태)`)이나 엔티티 전이 메서드(`confirm()` · `decline()` · `cancelByAdmin()`)로. 개별 취소는 `CANCEL_REASON = ADMIN_CANCELLED`. 모두 `STATUS_CHANGED_AT = now` · `STATUS_CHANGED_BY = 요청자` | — | PRD §6 · §1 「이전 개별 취소·참가 불가자는 (취소 안내 대상에서) 제외」 |
| 8 | 바뀐 신청에 대해 도메인 이벤트를 트랜잭션 안에서 발행한다 (아래 표) | — | [domain-events](../domain-events/spec.md) |
| 9 | 커밋 직전 `BEFORE_COMMIT` 구독자가 신청자에게 보낼 `NOTIFICATION` 행을 같은 트랜잭션에 저장한다. 템플릿·변수·실패 처리는 [event-mail 「자동 메일」](../event-mail/spec.md#자동-메일-신청-상태-알림) 이 정한다. 그 다음 커밋, 커밋 뒤 폴러가 실제 발송(SES) | — | event 「확정 방식 전환」 과 같은 방식 |

- 4 는 1 의 잠금 뒤에 읽는다. 크루 본인 취소(ST-038)·확정 방식 전환의 일괄 확정·종료 자동 처리·행사 취소도 같은 행사 잠금을 먼저 잡으므로, 신청 행 상태는 이 트랜잭션 동안 바뀌지 않는다. 7 의 조건부 갱신은 잠금 규칙을 따르지 않는 경로가 생겨도 이미 바뀐 신청을 다시 바꾸지 않게 하는 두 번째 방어선이다 (event 「이미 바뀐 신청을 다시 바꾸지 않도록 … 조건부 갱신도 함께 쓴다」)
- 7 의 조건부 갱신에서 바뀐 행이 0 이면 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` 로 끝내고 아무것도 바꾸지 않는다
- 참가 확정은 정원을 다시 검사하지 않는다. `PENDING` 이 이미 자리를 차지하고 있다 (event 「자동 확정으로 바꿔도 정원은 다시 검사하지 않는다」 와 같은 이유)
- 같은 상태로 다시 보내는 요청(확정된 신청에 다시 확정)은 5 에서 409 다. 프로토와 같다. 화면은 409 를 받으면 목록을 다시 읽는다

| 요청 | 발행하는 이벤트 | 자동 메일 조건 | 비고 |
|---|---|---|---|
| `CONFIRMED` | `ClubEventRegistrationsConfirmedEvent` (`club_event.registrations_confirmed`, PR #478 에서 추가 중) — `registrationIds = [이 신청]` | `EVENT_REGISTRATION_CONFIRMED` | event 의 `REVIEW → AUTO` 일괄 확정과 같은 이벤트다. 「확인 대기 신청을 참가 확정으로 바꿨다」는 같은 사실이라 구독자 하나가 둘 다 받는다 |
| `DECLINED` | `ClubEventRegistrationsDeclinedEvent` (`club_event.registrations_declined`, 신규) — `registrationIds = [이 신청]`, `cause = ADMIN` | `EVENT_REGISTRATION_DECLINED` | 행사 종료 자동 전환도 같은 이벤트(`cause = EVENT_ENDED`) |
| `CANCELLED` | `ClubEventRegistrationsCancelledEvent` (`club_event.registrations_cancelled`, 신규) — `registrationIds = [이 신청]`, `cause = ADMIN` | `EVENT_REGISTRATION_CANCELLED` | 크루 본인 취소(ST-038)도 같은 이벤트(`cause = SELF`)를 쓰도록 제안한다. **행사 취소([event-status](../event-status/spec.md))는 발행하지 않는다** — 수동 취소 안내 메일로 대신한다 |

- 이벤트 모양은 PR #478 의 `ClubEventRegistrationsConfirmedEvent` 와 같게 둔다: `record (EventMeta meta, Long clubEventId, List<Long> registrationIds, Cause cause)`, 패키지 `com.studyclub.domain.event`, `aggregateType = club_event`, `aggregateId = clubEventId`, actor = 처리한 캡틴(종료 자동 전환은 null). 페이로드에 연락처·답변을 싣지 않는다
- [domain-events 「이벤트」](../domain-events/spec.md#이벤트) 표에 두 줄을 더하는 일은 구현 PR 에서 한다. ops 알림은 보내지 않는다 (운영자 본인의 처리다)
- 행 생성이 실패하면 예외를 삼키지 않고 처리 전체를 롤백한다 (`BEFORE_COMMIT` 규칙). 템플릿이 0건일 때도 롤백할지는 [event-mail 미확정 M2](../event-mail/spec.md#미확정)

### Response — 200

본문은 [참가자 목록](#참가자-목록) 의 `items[]` 한 행과 같다 (바뀐 `status` 와 다시 계산한 `can*`).

```json
{
  "registrationId": 312,
  "accountId": 48,
  "nickname": "수현",
  "accountDeleted": false,
  "maskedEmail": "s***@naver.com",
  "channel": "ONLINE",
  "status": "CONFIRMED",
  "createdAt": "2026-11-20T03:14:00Z",
  "canConfirm": false,
  "canDecline": false,
  "canCancel": true
}
```

- 잔여석·배지(`seats[]` · `pendingCount` · `displayStatus`)는 응답에 싣지 않는다. 화면은 성공하면 운영 상세와 참가자 목록을 다시 읽는다 (잔여석이 생겨 `FULL → RECRUITING` 이 될 수 있다, event Q11)

### Error Responses

| 상태 | errorCode | 조건 | 화면 안내 |
|------|-----------|------|------|
| 400 | INVALID_INPUT | `status` 누락 · `PENDING` · 허용 밖 값 | |
| 401 | UNAUTHORIZED | 토큰 없음 | |
| 403 | FORBIDDEN | ADMIN 아님 | |
| 404 | NOT_FOUND | `eventId` · `registrationId` 없음, 그 행사 신청이 아님 | 목록 다시 읽기 |
| 409 | EVENT_CANCELLED | 취소된 행사 | 상세·목록 다시 읽기 → 조회 전용 |
| 409 | EVENT_ENDED | 종료된 행사 | 상세·목록 다시 읽기 → 조회 전용 |
| 409 | EVENT_REGISTRATION_STATUS_NOT_ALLOWED | 지금 신청 상태로는 그 처리를 할 수 없다 (다른 캡틴이 먼저 처리 · 크루가 먼저 취소 · 종료 자동 전환이 먼저 돎) | 「현재 상태에서는 처리할 수 없습니다」 + 목록 다시 읽기 |

- `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` 는 **새 `ErrorCode`** 다 (409, 기본 문구 「현재 신청 상태에서는 처리할 수 없습니다.」). 화면이 목록을 다시 읽는다는 점에서 일반 `CONFLICT` 와 행동이 같지만, 행사 쪽 409(`EVENT_CANCELLED` · `EVENT_ENDED`: 탭 전체를 조회 전용으로)와 신청 한 줄의 409 를 화면이 구분해야 해서 둔다. 크루 본인 취소(ST-038)도 같은 코드를 쓰도록 제안한다
- `EVENT_CANCELLED` · `EVENT_ENDED` 는 PR #478 의 코드를 쓰고 상황 문구(「취소된 행사의 신청은 처리할 수 없습니다.」 등)를 넘긴다

### 프론트엔드 사용처

- back-office-front 참가자 탭 처리 열 (아직 없음). `useDecideRegistration()` mutation. 참가 불가 · 신청 취소는 확인 창 뒤에 부른다 (PRD §6 「참가 불가 처리 전 확인 창」, 프로토 두 확인 창)
- 근거 시안: `EventAdminDetail.tsx` 처리 열 · `model.ts` `transition` DECIDE · ADMIN_CANCEL

---

## 행사 종료 시 확인 대기 자동 전환

PRD §6 「행사 종료 시 남은 확인 대기 신청은 참가 불가로 전환하고 기존 참가 불가 안내 메일 발송」, crew-apply-event §4 「행사 종료 시에도 확인 대기인 신청은 참가 불가로 전환하고 기존 참가 불가 안내 문구와 메일 사용」. 프로토는 화면을 열 때와 15초마다 `settleEndedRegistrations` 를 돌린다. 서버는 **스케줄러**가 한다 (권장안, 미확정 P2).

### 실행 방식

| | 주기 스케줄러 (권장) | 조회 때 지연 정산 |
|---|---|---|
| 동작 | `ClubEventEndSettlementScheduler` (제안) 가 1분마다 대상 행사를 골라 처리 | 운영 상세·참가자 목록·크루 조회가 부를 때 그 행사를 처리 |
| 메일 | 아무도 화면을 열지 않아도 종료 직후 나간다 | 누군가 열 때까지 안 나간다 |
| GET 의 성격 | GET 은 읽기만 한다 | GET 이 잠금을 잡고 쓴다. 프리페치·재시도가 쓰기가 된다 |
| 지연 | 종료 뒤 최대 약 1분(+처리 시간) 동안 `PENDING` 이 보인다. 그동안 `canManageRegistrations = false` 라 처리 버튼은 이미 없다 | 없음 |

- 권장: 스케줄러만 둔다. 지연 동안에도 처리 버튼은 서버 판정으로 이미 사라지고, 종료된 행사의 `PENDING` 은 아무 행동도 할 수 없으므로 잠깐 보이는 것의 비용이 작다

### 처리 순서

1. **대상 고르기** (잠금 없이, 짧은 읽기 트랜잭션): `STATUS ≠ CANCELLED` ∧ `STARTS_AT ≤ now` ∧ `PENDING` 신청이 1건 이상인 행사 ID 를 고른다. `effectiveEndsAt` 은 컬럼이 아니라 계산값이라(`ENDS_AT` 또는 시간대 기준 시작일 다음 날 00:00) SQL 로 바로 거르지 않고, 고른 행사마다 `ClubEvent.effectiveEndsAt()` 으로 `now ≥ effectiveEndsAt` 인 것만 남긴다. `effectiveEndsAt > STARTS_AT` 이 언제나 성립하므로 `STARTS_AT ≤ now` 가 후보를 충분히 좁힌다
2. **행사마다 새 트랜잭션**에서:
   1. `CLUB_EVENT` 행을 쓰기 잠금으로 읽는다 (**트랜잭션의 첫 조회**). 없으면 건너뛴다
   2. 잠금 뒤 읽은 값으로 `STATUS = CANCELLED` 면 건너뛴다
   3. 잠금 뒤 읽은 값으로 `now < effectiveEndsAt` 이면 건너뛴다 — 1 에서 고른 뒤 캡틴이 종료 시각을 늘려 저장했을 수 있다 ([event 「같은 행사에 쓰는 요청의 처리 순서」](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서) 의 예)
   4. 그 행사의 `PENDING` 신청 ID 를 읽고 조건부 갱신(`UPDATE … SET STATUS = 'DECLINED' … WHERE CLUB_EVENT_ID = ? AND STATUS = 'PENDING'`)으로 바꾼다. `STATUS_CHANGED_AT = now`, `STATUS_CHANGED_BY = NULL`(시스템). 바꾼 신청이 0 이면 커밋하고 끝
   5. 바꾼 신청 ID 로 `ClubEventRegistrationsDeclinedEvent(cause = EVENT_ENDED, actor = null)` 를 발행한다
   6. `BEFORE_COMMIT` 구독자가 바뀐 신청마다 `EVENT_REGISTRATION_DECLINED` `NOTIFICATION` 행을 같은 트랜잭션에 저장한다. 그 다음 커밋
3. 한 행사의 트랜잭션이 실패하면 그 행사만 롤백하고 에러 로그(`clubEventId` 만, 연락처 없음)를 남긴 뒤 다음 행사로 간다. 다음 주기에 다시 시도한다

- 2-4 는 행사 애그리거트가 신청 애그리거트에 시키는 일이라 `ClubEventRegistrationPort` 에 `List<Long> declinePendingRegistrationsForEventEnd(Long eventId)` 를 더한다 (바꾼 신청 ID 를 돌려준다, `confirmPendingRegistrations` 와 같은 모양)
- 서버가 여러 대면 스케줄러가 인스턴스마다 돈다. 두 인스턴스가 같은 행사를 고르면 2-1 의 잠금이 줄을 세우고, 늦은 쪽은 2-4 에서 바꿀 `PENDING` 이 없어 아무것도 하지 않는다. 메일이 두 번 생기지 않는다 (분산 락 불필요. [notification 「스케줄러 중복 실행 방지」](../notification/spec.md#한계--후속) 와 같은 판단)
- 잠금은 행사 하나씩 짧게 잡는다. 대상 행사를 한 트랜잭션에 묶지 않는다
- 이미 종료된 행사의 `DECLINED` 전환은 정원·`displayStatus` 에 영향이 없다 (종료가 먼저 판정된다)

### 겹치는 요청

| 겹친 요청 | 종료 처리가 먼저 | 상대가 먼저 |
|---|---|---|
| 종료 처리 ↔ 행사 수정의 종료 시각 연장 | 이미 종료라 수정이 409 `EVENT_ENDED` (event 처리 순서 3) | 연장이 커밋된다. 종료 처리는 2-3 에서 건너뛴다 |
| 종료 처리 ↔ 종료 직전 운영진 참가 확정 | 종료 뒤라 참가 처리가 409 `EVENT_ENDED` | 확정이 커밋된다. 종료 처리는 그 신청을 `PENDING` 이 아니라서 건드리지 않는다 |
| 종료 처리 ↔ 행사 취소 | 종료 뒤라 취소가 409 `EVENT_ENDED` | 취소가 커밋된다. 종료 처리는 2-2 에서 건너뛴다 |

---

## 데이터 모델 제안: CLUB_EVENT_REGISTRATION

**ST-038 신청 스펙과 공동 경계다.** 테이블 이름·컬럼·인덱스를 여기서 제안하고, ST-038 스펙이 같은 정의를 쓰거나 고쳐 합의한 뒤 `docs/erd/CLUB_EVENT_REGISTRATION.md` 와 마이그레이션을 만든다 (누가 만드나는 미확정 P5). 이 스펙은 Flyway SQL·ERD 정본을 고치지 않는다.

신청은 행사와 **다른 애그리거트**다 ([event 「데이터 모델 제안」](../event/spec.md#데이터-모델-제안) 「신청은 별도 애그리거트(ID 참조)」). 크루 한 명의 신청 한 건이 자기 상태 전이를 가진다.

| 컬럼 | 타입 | NULL | 설명 | 근거 |
|---|---|---|---|---|
| ID | BIGINT PK | N | | |
| CLUB_EVENT_ID | BIGINT | N | [CLUB_EVENT](../event/spec.md#데이터-모델-제안) ID 참조. **FK 없음** (애그리거트 사이) | [database-guide 「외래키 정책」](../../docs/backend-development-guide/database-guide.md#외래키-정책) |
| ACCOUNT_ID | BIGINT | N | 신청한 [ACCOUNT](../../docs/erd/ACCOUNT.md) ID 참조. FK 없음. 탈퇴로 계정이 지워져도 값은 남는다 | user-leave 「ID 참조는 되짚을 수 없어 자연히 비식별」 |
| CHANNEL | VARCHAR(20) | N | `ONLINE` · `OFFLINE` | PRD §3 신청 데이터 「참여 방식」 |
| STATUS | VARCHAR(20) | N | `PENDING` · `CONFIRMED` · `DECLINED` · `CANCELLED` | PRD §3 「신청 상태」 |
| CANCEL_REASON | VARCHAR(30) | Y | `STATUS = CANCELLED` 일 때만. `SELF_CANCELLED`(본인, ST-038) · `ADMIN_CANCELLED`(운영진 개별) · `EVENT_CANCELLED`(행사 취소 — 취소 안내 대상). 그 밖의 상태는 NULL | PRD §1 「이전 개별 취소·참가 불가자는 제외」, [event-status](../event-status/spec.md#행사-취소가-신청에-하는-일) |
| STATUS_CHANGED_AT | DATETIME(6) | Y | 마지막 상태 전이 시각. 접수 그대로면 NULL | 제안 — 처리 이력 추적 |
| STATUS_CHANGED_BY | BIGINT | Y | 마지막 상태를 바꾼 계정(캡틴 · 본인). 시스템(종료 자동 전환)이면 NULL. FK 없음 | 제안 — event-status 미확정 S4 의 추적 근거 |
| APPLICANT_TIME_ZONE | VARCHAR(64) | Y | 신청 당시 신청자의 `ACCOUNT.TIME_ZONE` 사본. 계정에 시간대가 없었으면 NULL | crew-apply-event §5 「시간대가 없는 이전 신청은 행사 기준 시간대」, `event-preview.ts` `EventRegistration.timeZone` 「신청 당시 회원 프로필 시간대」 |
| QUESTIONS_SNAPSHOT | JSON | N | 신청 당시 질문 사본 배열 `[{questionId, label, type, required, options}]`. 질문 없는 행사면 `[]` | PRD §4 · §6, event 「신청 질문의 보존」 |
| ANSWERS_SNAPSHOT | JSON | N | 답 `{"<questionId>": ["…"]}`. 값은 언제나 문자열 배열 (신청서 조회 `answer` 와 같은 모양) | 같은 곳 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity`. `CREATED_AT` 이 신청 시각 | PRD §3 「신청 시각」 |

**인덱스·제약**

| 이름 (제안) | 컬럼 | 쓰는 곳 |
|---|---|---|
| `idx_club_event_registration_event_channel_status` | `(CLUB_EVENT_ID, CHANNEL, STATUS)` | 방식·상태별 COUNT — 정원 · 잔여석 · `displayStatus` · `pendingCount` · 행사 취소 · 종료 전환 · 메일 수신자 (event 스펙이 요구) |
| `idx_club_event_registration_event_created` | `(CLUB_EVENT_ID, CREATED_AT, ID)` | 참가자 목록 정렬 · 페이지 |
| `idx_club_event_registration_account_event` | `(ACCOUNT_ID, CLUB_EVENT_ID)` | 크루의 중복 신청 확인 · 내 행사(ST-038) · 탈퇴 처리 |
| `idx_club_event_registration_status_event` | `(STATUS, CLUB_EVENT_ID)` | 종료 자동 전환의 대상 고르기 (`STATUS = 'PENDING'`) |
| **없음** | ~~`UNIQUE(CLUB_EVENT_ID, ACCOUNT_ID)`~~ | 재신청하면 취소된 이전 행을 남기고 새 행을 만든다 (PRD §6, crew-apply-event §3). 유일 제약을 걸면 재신청이 막힌다 |

- **중복 신청 제한**(crew-apply-event §3 「중복 신청 제한」 · 「참가 불가 처리 후 재신청 제한」)은 DB 제약이 아니라 ST-038 신청 제출이 행사 행 잠금을 잡은 뒤 「같은 계정의 `PENDING` · `CONFIRMED` · `DECLINED` 행이 있나」를 읽어 막는다. 같은 행사의 신청은 잠금으로 한 줄로 서므로 확인 후 삽입이 안전하다. 프로토 `transition` APPLY 는 `CANCELLED` 가 아닌 행이 있으면 막는다 — 같은 규칙이다
- 질문·답 사본은 JSON 한 칸씩이다. 신청이 `CLUB_EVENT_QUESTION` 을 FK 로 물지 않는다 (event 스펙). 사본 저장 형태의 최종 결정은 ST-038 이 한다. 이 스펙은 신청서 조회의 응답 모양만 고정한다
- 질문 버전(작성 중 질문이 바뀌었는지 확인하는 값, crew-apply-event §5)은 신청 제출 검사의 일이라 이 표에 넣지 않았다. 필요하면 ST-038 이 컬럼을 더한다

**연락처를 신청 행에 두지 않는 이유**

- crew-apply-event §5 는 「로그인 계정의 닉네임과 이메일을 신청 정보에 자동으로 포함」이라 적었다. 이 스펙은 닉네임·이메일을 **신청 행에 복사하지 않고** 조회 때 `ACCOUNT` 에서 읽기를 제안한다
- 이유: 복사본이 있으면 탈퇴 때 지울 곳이 하나 더 생기고([user-leave](../user-leave/spec.md)), 운영자가 보는 주소가 메일이 실제로 나가는 주소(`NOTIFICATION.RECIPIENT_VALUE` 는 발송 행 만들 때 `ACCOUNT.EMAIL` 을 읽는다)와 갈릴 수 있다. 스터디 신청·반 공지도 같은 방식이다 (study-notice 「메일 주소는 서버가 `ACCOUNT` 에서 읽어 아웃박스 행에 스냅샷」)
- 신청 시 「이메일이 비었거나 형식이 틀리면 신청을 막는다」(crew-apply-event §5)는 제출 검사라 ST-038 이 한다. 복사 여부와 별개다
- 복사가 필요하다는 결정이 나오면 컬럼을 더하고 탈퇴 처리에 비식별 단계를 넣는다 (미확정 P3)

**`ClubEventRegistrationPort` 연결** (PR #478 에서 추가 중인 포트 · 이벤트)

행사 애그리거트는 신청 테이블을 직접 모른다. PR #478 이 둔 포트 `ClubEventRegistrationPort` 를 신청 애그리거트 쪽 어댑터가 구현하고, 지금의 임시 `EmptyClubEventRegistrationAdapter`(0건 · no-op)를 지운다.

| 포트 메서드 | 상태 | 실제 어댑터의 동작 | 부르는 곳 |
|---|---|---|---|
| `countActiveSeatsByEventIds(eventIds)` | PR #478 | `SELECT CLUB_EVENT_ID, CHANNEL, STATUS, COUNT(*) … WHERE CLUB_EVENT_ID IN (…) AND STATUS IN ('PENDING','CONFIRMED') GROUP BY …` 한 번 → `EventSeatCounts` 맵 | 운영 목록 |
| `countActiveSeats(eventId)` | PR #478 | 같은 쿼리를 행사 하나로 | 운영 상세 · 수정 · 이 스펙의 `pendingCount` · event-status `cancellationRecipientCount`(취소 전) |
| `confirmPendingRegistrations(eventId)` | PR #478 | 잠금 트랜잭션 안에서 `PENDING` ID 를 읽고 `UPDATE … WHERE ID IN (…) AND STATUS = 'PENDING'` → 바꾼 ID | 행사 수정 `REVIEW → AUTO` |
| `cancelActiveRegistrationsForEventCancellation(eventId)` | 신규 ([event-status](../event-status/spec.md#행사-취소가-신청에-하는-일)) | `UPDATE … SET STATUS='CANCELLED', CANCEL_REASON='EVENT_CANCELLED' … WHERE CLUB_EVENT_ID = ? AND STATUS IN ('PENDING','CONFIRMED')` → 바꾼 행 수 | 행사 취소 |
| `countCancellationRecipients(eventId)` | 신규 | `COUNT(*) WHERE CLUB_EVENT_ID = ? AND STATUS = 'CANCELLED' AND CANCEL_REASON = 'EVENT_CANCELLED'` | event-status 판정 필드 · event-mail 수신자 |
| `declinePendingRegistrationsForEventEnd(eventId)` | 신규 (이 스펙) | `confirmPendingRegistrations` 와 같은 모양으로 `PENDING → DECLINED` → 바꾼 ID | 종료 자동 전환 |

- 어댑터와 신청 엔티티는 같은 애그리거트 패키지에 둔다 (제안: `com.studyclub.domain.event.registration` — `ClubEventRegistration` · `ClubEventRegistrationRepository` · 어댑터). 운영진 개별 처리(이 스펙의 PATCH)와 크루 제출·본인 취소(ST-038)는 포트가 아니라 신청 저장소·엔티티 메서드를 api 서비스가 직접 부른다. 포트는 「행사가 신청에게 묻고 시키는 것」만 담는다 (PR #478 포트 주석과 같다)
- `ClubEventRegistrationsConfirmedEvent` 의 구독자는 PR #478 에 아직 없다. [event-mail](../event-mail/spec.md#자동-메일-신청-상태-알림) 의 자동 메일 구독자가 이 이벤트와 이 스펙의 `…DeclinedEvent` · `…CancelledEvent` 를 함께 받는다

## 탈퇴한 크루의 신청

- 탈퇴는 `ACCOUNT` 행을 물리 삭제한다 ([user-leave](../user-leave/spec.md)). 신청 행은 `ACCOUNT_ID` 만 가진 ID 참조라 그대로 남고, 조회는 계정이 없으면 `accountDeleted = true` · `nickname = null` · `maskedEmail = null` 로 준다 (user-leave 「조회 계층은 이 ID 로 `ACCOUNT` 조회가 실패하면 "탈퇴한 회원"으로 표시」)
- 이메일 보기는 404 (원본이 없다)
- **탈퇴한 크루의 `PENDING` · `CONFIRMED` 신청이 계속 자리를 차지하는 문제**가 있다. 정할 것은 미확정 P3

## 퍼널·계측

해당 없음. 운영진의 처리 기능이라 퍼널 단계를 바꾸지 않고, 추가·변경하는 분석 이벤트가 없다. 크루 신청 접수(가입 뒤 활성화 후보)는 확정되는 사건이라 서버 이벤트가 필요한지 ST-038 신청 스펙에서 정한다 ([analytics](../analytics/spec.md) 의 활성화 정의는 지금 스터디 첫 신청뿐). 실험(A/B) 없음.

## 근거와 PRD·프로토·레포 규약의 차이

| 항목 | PRD · 프로토 | 이 스펙 |
|---|---|---|
| 이메일 마스킹 | 프로토는 원본을 들고 화면이 가린다 (`maskEmail`) | 서버가 가린 `maskedEmail` 만 준다. 원본은 행별 `POST …/email-reveals` + 감사 로그 (admin-users 규약) |
| 목록 크기 | 프로토는 전체를 한 표에 | `offset`/`limit` 페이지 (기본·최대 100). 미확정 P1 |
| 신청서 답 | 프로토는 목록 행에 질문·답이 함께 있다 | 단건 GET 으로 뗐다. 답은 질문 안에 `String[]` 하나로 |
| 종료 전환 | 프로토는 화면 로드와 15초마다 | 서버 스케줄러 1분 주기. 미확정 P2 |
| 처리 판정 | 프로토는 화면이 `canManageEventRegistrations` · `occupiesSeat` 를 계산 | 서버가 `canManageRegistrations` · 행별 `canConfirm` · `canDecline` · `canCancel` 을 준다 |
| 닉네임·이메일 | crew-apply-event §5 「신청 정보에 자동으로 포함」 | 신청 행에 복사하지 않고 `ACCOUNT` 에서 읽는다. 미확정 P3 |
| 같은 처리 재요청 | 프로토도 막는다 | 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` |

## 미확정

- [NEEDS CLARIFICATION] **P1. 참가자 목록 페이지네이션.** 선택지: (가) `offset`/`limit` 페이지, 기본·최대 100 · (나) 페이지 없이 전체 · (다) 커서. **권장 (가)** — 정원이 방식마다 최대 10,000명이라 전체 반환은 응답이 커질 수 있다. 실제 행사 규모(수십~수백 명)면 한 페이지에 다 들어가 프로토와 같아 보인다. 페이지 크기와 화면의 페이지 이동 모양(행사 목록처럼 `?page=N`)을 디자인과 맞춘다
- [NEEDS CLARIFICATION] **P2. 종료 자동 전환의 실행 방식과 주기.** 선택지: (가) 1분 주기 스케줄러만 · (나) 스케줄러 + 운영 상세·참가자 목록 조회 때 지연 정산 · (다) 5분 주기. **권장 (가)**. 종료 직후 최대 약 1분 동안 목록에 `PENDING` 이 보이지만 처리 버튼은 서버 판정으로 이미 없다. 크루 화면(ST-038)의 「내 신청」도 그 사이 확인 대기로 보이는데 괜찮은지 ST-038 과 같이 확인한다
- [NEEDS CLARIFICATION] **P3. 탈퇴한 크루의 신청.** (1) 탈퇴할 때 `PENDING` · `CONFIRMED` 신청을 취소해 자리를 반환할지: 선택지 (가) 탈퇴 트랜잭션이 행사별로 행사 행을 잠그고 `CANCELLED`(`CANCEL_REASON = ACCOUNT_DELETED` 새 값)로 바꾼다 — 잠금 순서가 계정 → 행사가 되므로 다른 경로가 행사 → 계정을 잠그지 않는지 확인 필요 · (나) 남겨 두고 자리도 그대로 (운영진이 개별 취소) · (다) 탈퇴 뒤 비동기로 정리. **권장 (가)**, [user-leave](../user-leave/spec.md) 처리 순서에 한 단계를 더한다. 자동 메일은 보내지 않는다(받을 주소가 없다). (2) 목록 표시: `nickname = null` + `accountDeleted = true`, 이메일 보기 404 — 이대로 좋은지. (3) 신청 답변(자유 서술)을 탈퇴 뒤에도 남길지: 스터디 신청은 답을 남긴다(user-leave 「`answers` 는 그대로」). **권장: 같게 남긴다.** (4) 닉네임·이메일을 신청 행에 복사할지(crew-apply-event §5 문구): **권장: 복사하지 않는다** (위 「연락처를 신청 행에 두지 않는 이유」)
- [NEEDS CLARIFICATION] **P4. 이메일 보기 감사 로그에 화면 구분을 남길지.** 지금 `ADMIN_AUDIT_LOG` 에는 어느 화면에서 봤는지 칸이 없다. 선택지: (가) `EMAIL_REVEAL` 그대로 (ERD 설명만 고친다) · (나) 새 `ACTION` `EVENT_EMAIL_REVEAL` · (다) 참조 칸(행사 ID·신청 ID)을 더한다. **권장 (가)** — 「누가 언제 이 사람의 이메일을 봤나」라는 질문은 같다
- [NEEDS CLARIFICATION] **P5. 신청 테이블을 누가 만드나.** ST-038(크루 신청, 담당 팀원)과 ST-037(이 스펙) 중 먼저 구현하는 PR 이 `CLUB_EVENT_REGISTRATION` 마이그레이션 · ERD · 실제 어댑터를 넣는다. 선택지: (가) ST-038 신청 제출 PR 이 만들고 이 스펙의 구현은 그 뒤 · (나) 이 스펙의 구현 PR 이 먼저 만들고 ST-038 이 컬럼을 보탠다 · (다) 테이블만 따로 먼저 올리는 작은 PR. **권장 (다)** — 두 스펙이 같은 컬럼 정의에 합의한 뒤 테이블·엔티티·포트 어댑터만 담은 PR 을 먼저 머지하면 두 구현이 서로를 기다리지 않는다. ST-038 스펙의 `CANCEL_REASON = SELF_CANCELLED` · 본인 취소 이벤트(`…CancelledEvent`, `cause = SELF`) · 오류 코드 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` 재사용도 그때 맞춘다
- [NEEDS CLARIFICATION] **P6. 운영진 개별 취소·참가 불가의 사유.** PRD 에는 입력이 없다. 메일에 사유를 넣지 않고 같은 템플릿을 쓴다. 사유 입력이 필요해지면 요청 바디와 메일 변수를 함께 더한다. **권장: 이번 범위 밖**
