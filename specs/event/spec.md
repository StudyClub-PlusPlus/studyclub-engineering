# 행사 API Spec: 캡틴이 백오피스에서 등록·수정·조회한다

> ERD: 없음. 행사 테이블이 아직 없다. 아래 「데이터 모델 제안」이 초안이고, 스펙 확정 뒤 `docs/erd/` 에 테이블 문서를 만든다
> 생성일: 2026-11-14
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 행사를 등록하고 신청자의 참가를 확정할 수 있다](../../01-planning/stories/captain-manage-events/PRD.md) (ST-037)
>
> 기준 프로토타입: playground `/proto/console/events` · `/proto/console/events/{id}` (PR #469)
> 판정 로직의 근거: `frontend/apps/playground/src/proto/events/model.ts` (`validateEvent` · `eventStatus` · `seatInfo` · `transition`)
> 실제 경로(연결 전): back-office-front `/events` (「준비 중」 화면)

## 엔드포인트 목록

**백오피스: `/api/admin/events` (`AdminEventController`, 캡틴만)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/events | 운영 행사 목록: 행사명 · 일정 · 표시 상태 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/events | 행사 등록: 작성 중(`DRAFT`)으로 저장 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/events/{eventId} | 운영 상세: 편집 폼 값 + 참여 방식별 모집 현황 | O (ADMIN) | 스펙작성중 |
| PUT | /api/admin/events/{eventId} | 행사 수정: 기본 정보 · 모집 설정 · 신청 질문 전체를 한 번에 저장 | O (ADMIN) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

## 먼저 읽을 것

### 이 스펙이 다루는 것과 안 다루는 것

| 다룬다 | 다루지 않는다 (별도 스펙) | 이 스펙과 닿는 곳 |
|---|---|---|
| 백오피스 등록 · 수정 · 운영 목록 · 운영 상세 | 사용자 사이트 행사 조회 · 신청 · 본인 취소 | 운영 상세의 모집 현황 수치, 수정 시 정원 하한, 신청 당시 질문 보존 |
| | 참가 확정 · 참가 불가 · 운영진 개별 취소 · 참가자 목록 | 확정 방식 전환이 바꾸는 신청 상태 |
| | 공개 · 모집 마감 · 재모집 · 공개 취소 · 행사 취소 (상태 전환) | `status` 값, 취소 행사 수정 금지, 공개 행사의 마감 변경 규칙 |
| | 행사 삭제 | 아래 「삭제」 |
| | 안내 메일 · 자동 메일 발송 · 메일 이력 | 확정 방식 전환이 만드는 확정 메일 (아래 「확정 방식 전환」) |

다른 스펙은 이 스펙이 정한 `status` · 판정 메서드 · 데이터 모델을 그대로 쓴다. 사이트에 무엇을 보여 줄지(공개 범위, 참가 확정자만 보는 온라인 링크)는 사이트 스펙에서 정한다. 이 스펙의 응답은 캡틴에게만 나간다.

### 인가

- `/api/admin/events/**` 는 `@RequireAdmin` 으로 캡틴(`SYSTEM_ROLE = ADMIN`)만 부른다. 토큰이 없으면 401, ADMIN 이 아니면 403 (captain-manage-events §3 「운영 기능은 캡틴 권한 확인」, [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md), 사용자 전달 Notion PRD 「캡틴 운영 권한」)
- 인가는 행사 존재 여부보다 먼저 본다. 없는 ID 로 크루가 불러도 403 ([site-notice](../site-notice/spec.md#인가) 와 같다)
- `/api/admin` 은 보안 설정상 기본 인증 경로다. `permitAll` 을 추가하지 않는다
- 권한·상태 판정은 전부 서버가 요청마다 한다. 화면의 버튼 숨김은 표시용이다

### 상태: 저장 상태와 표시 상태를 나눈다

**저장 상태 `EVENT.STATUS`**: 운영자가 바꾸는 값. 이 스펙의 등록은 `DRAFT` 를 만들고, 수정은 상태를 바꾸지 않는다. 전환은 별도 상태 전환 스펙.

| 값 | 뜻 |
|---|---|
| `DRAFT` | 작성 중 |
| `PUBLISHED` | 공개, 모집을 받는다 (마감 시각 전) |
| `CLOSED` | 공개, 운영자가 모집을 마감했다 |
| `CANCELLED` | 행사 취소. 읽기 전용, 재공개 불가 |

**표시 상태 `displayStatus`**: 저장 상태 + 서버 시각 + 인원으로 서버가 계산한다. 목록·상세의 상태 칩은 이 값만 그린다. 계산: `Event.displayStatus(now, seatCounts)` (제안 이름).

| 값 | 화면 (§1-1) | 조건 (프로토 `eventStatus` 순서) |
|---|---|---|
| `DRAFT` | 작성 중 | `STATUS = DRAFT` |
| `CANCELLED` | 행사 취소 | `STATUS = CANCELLED` |
| `ENDED` | 종료 | `now ≥ effectiveEndsAt` |
| `IN_PROGRESS` | 진행 중 (종료 미입력이면 프로토는 「행사 시작」) | `now ≥ STARTS_AT` |
| `RECRUITMENT_CLOSED` | 모집 마감 | `STATUS = CLOSED` 또는 `now ≥ DEADLINE_AT` |
| `FULL` | 정원 마감 | 모든 참여 방식의 잔여석 0 |
| `RECRUITING` | 모집 중 | 그 밖 |

- 위에서부터 먼저 맞는 값을 쓴다. 순서는 프로토타입 구현에서 가져온 **제안**이다 (미확정 Q3)
- **`effectiveEndsAt` (종료 판정 시각)**: `ENDS_AT` 이 있으면 그 시각. 없으면 **행사 기준 시간대(`TIME_ZONE`)에서 시작일 다음 날 00:00** 의 UTC 시각 (captain-manage-events §1-1·§2 「행사 기준 시간대의 다음 날부터 종료」). 입력된 종료 시각이 언제나 우선한다
- 판정은 서버 시각(`Instant.now()`)으로 한다. 이후 사이트용·신청 API 도 같은 메서드에 같은 쿼리로 센 인원을 넘겨야 한다 ([판정은 서버가 내려준다](../../docs/backend-development-guide/api/endpoint-convention.md#판정은-서버가-내려준다))

### 정원과 잔여석

- 유효 인원 = 그 참여 방식의 `PENDING`(확인 대기) + `CONFIRMED`(참가 확정) 신청 수. `DECLINED` · `CANCELLED` 는 자리를 반환한다 (captain-manage-events §5, §3 데이터 규칙)
- 잔여석 = `max(0, 정원 − 유효 인원)`. 계산: `Event.seatsOf(channel, counts)` (제안)
- 신청 제출의 정원 재확인·중복 신청 제한은 신청 스펙의 책임이다. 다만 이 스펙의 정원 축소(PUT)와 신청이 같은 순간에 오면 정원 하한이 깨질 수 있다. **제안**: 수정 트랜잭션은 행사 행을 쓰기 잠금(`SELECT … FOR UPDATE`)하고 그 안에서 유효 인원을 센다. 신청 쪽도 같은 행을 잠그고 세야 효과가 있다 (미확정 Q8)

### 시각과 시간대

- **요청·응답 시각은 모두 UTC ISO 8601** (`2026-12-05T10:00:00Z`). 레포 규칙([spec-driven-development 「응답 shape 규칙」](../../docs/backend-development-guide/spec-driven-development.md) 「날짜는 UTC ISO 8601」)과 선례([study-meeting](../study-meeting/spec.md) 「화면이 현지 시각 → UTC 로 바꿔 보낸다」)를 따른다
- 편집 폼은 행사 기준 시간대(`timeZone`)의 현지 시각으로 입력받아 UTC 로 바꿔 보낸다. 응답의 UTC 를 현지 시각으로 바꿔 폼을 채우는 것도 화면이 한다 (표시 변환은 화면의 일)
- `timeZone` 은 저장하고, 서버는 `effectiveEndsAt` 계산에 쓴다
- **서머타임 검증의 한계**: PRD §2 는 「서머타임 때문에 존재하지 않거나 중복되는 현지 시각은 저장 제한」이라고 한다. 그런데 서버가 UTC 한 순간만 받으면 **캡틴이 어떤 현지 시각을 입력했는지 알 수 없다.** 존재하지 않는 현지 시각(봄 전환 공백)은 UTC 로 바꿀 수 없고, 두 번 있는 현지 시각(가을 전환)은 UTC 두 순간 중 어느 쪽이든 정상 값처럼 보인다. 그래서 이 판정은 **화면이 변환할 때 막는 것**이 된다. 프로토타입 `wallTimeToIso` 는 두 경우 모두 `null` 을 내 저장을 막는다
- 서버가 이 판정까지 책임지려면 요청을 「현지 시각 + `timeZone`」으로 받아야 하는데, 그건 위 레포 규칙과 다르다. 어느 쪽으로 갈지는 미확정 Q4
- `timeZone` 허용 값 **제안**: [POL-0006](../../01-planning/_registry/policies/POL-0006-timezone.md) · `ACCOUNT.TIME_ZONE` 과 같은 넷, 곧 `Asia/Seoul` · `America/New_York` · `America/Vancouver` · `America/Los_Angeles`. **프로토타입 `ZONES` 는 `America/Toronto` 를 쓰고 `America/Vancouver` 가 없다** (미확정 Q5)

### 확정 방식 전환 (수정의 연관 효과)

| 바꾸기 | 효과 | 근거 |
|---|---|---|
| `REVIEW` → `AUTO` | 그 행사의 `PENDING` 신청을 **같은 트랜잭션에서** 전부 `CONFIRMED` 로 바꾼다. 커밋 뒤 신청마다 확정 안내 메일 1건 생성 | captain-manage-events §3·§3 데이터 규칙, 프로토 `transition` SAVE |
| `AUTO` → `REVIEW` | 이미 `CONFIRMED` · `DECLINED` · `CANCELLED` 인 신청은 그대로. 이후 신청부터 `PENDING` 으로 접수 | 같은 곳 |
| 행사 시작 후 | 확정 방식 변경 거절 (409) | §3 「행사 시작 전까지만 가능」 |

- 메일은 서비스가 직접 보내지 않는다. 확정 처리한 신청 ID 목록을 담은 도메인 이벤트(가칭 `EventRegistrationsConfirmedEvent`)를 발행하고 `AFTER_COMMIT` 구독자가 메일을 만든다 ([domain-events](../domain-events/spec.md)). 템플릿·이력·실패 처리 계약은 메일 스펙에서 정한다
- 이 자동 확정 메일은 운영 콘솔 「메일 이력」 탭에 보이지 않는다 (§7)
- 자동 확정으로 바꿔도 정원은 다시 검사하지 않는다. `PENDING` 도 이미 자리를 차지하고 있다
- 콘솔은 저장 전에 「현재 확인 대기 N건이 참가 확정된다」를 안내한다 (§3). 그 N 은 운영 상세 응답 `seats[].pending` 의 합이다

### 신청 질문의 보존

- `PUT` 은 질문 목록 전체를 교체한다. 기존 신청은 **신청 당시 질문과 답변의 사본**(신청 쪽에 보관)을 읽으므로, 질문을 고치거나 지워도 기존 신청은 바뀌지 않는다 (captain-manage-events §4·§6, §3 데이터 규칙 「질문 변경은 이후 신청부터 적용」)
- 그래서 신청이 질문 행을 외래키로 물지 않는다. 사본의 저장 형태는 신청 스펙에서 정하되, 현재 질문을 조인해 기존 답을 다시 그리는 방식은 금지한다
- `questionId` 는 같은 행사 안에서 유지되는 안정 키다. 수정 요청에 기존 `questionId` 를 보내면 그 질문을 갱신, null 이면 새 질문

### 취소된 행사는 읽기 전용

- `STATUS = CANCELLED` 이면 `PUT` 은 409 `EVENT_CANCELLED`. 기본 정보 · 모집 설정 · 신청 질문 어느 것도 바꾸지 않는다 (§2)
- 운영 상세는 `canEdit = false` 를 내려 화면이 저장 버튼을 그리지 않게 한다

### 개인정보·민감 정보

- 이 스펙의 응답에는 신청자 이메일·닉네임이 없다. 참가자 목록은 별도 스펙이고, 기존 콘솔 규칙대로 마스킹 + 행별 보기다 (§6)
- 온라인 참여 링크(`online.url`)는 캡틴에게는 그대로 보인다. 확정자만 볼 수 있다는 규칙(crew-apply-event §4)은 사이트 스펙이 지킨다. 서버는 링크를 로그에 남기지 않는다

### 삭제

- 사용자 전달 Notion PRD: **공개된 행사 또는 신청 이력이 있는 행사는 물리 삭제하지 않고 취소한다.** 취소는 상태 전환 스펙 범위다
- **신청 이력이 없는 작성 중 행사의 삭제는 미결정이다.** 그래서 이 스펙에 `DELETE` 를 두지 않는다 (미확정 Q1)
- back-office-front `app/events/page.tsx` 의 `TODO(api)` 주석은 `POST/GET/PATCH/DELETE /api/events` 를 적고 있다. 이 스펙이 확정되면 주석을 이 스펙의 경로로 고친다

---

## 운영 행사 목록

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/events`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 모든 행사(작성 중·취소 포함). 행에는 행사명 · 일정 · 표시 상태만 싣는다 (§1-1 「참여 방식, 확정 방식·신청 인원 열은 표시하지 않음」)

### Path Parameters

없음

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| offset | Integer | N | 0 | 0 이상 |
| limit | Integer | N | 20 | 1 ~ 100 |

- 필터·검색·정렬은 PRD 에 없다. **제안**: 정렬 `STARTS_AT DESC, ID DESC` 고정, 필터 없음 (미확정 Q6)

### Request Body

없음

### Response — 200

```json
{
  "items": [
    {
      "eventId": 7,
      "title": "연말 네트워킹 밋업",
      "startsAt": "2026-12-05T10:00:00Z",
      "endsAt": "2026-12-05T13:00:00Z",
      "effectiveEndsAt": "2026-12-05T13:00:00Z",
      "timeZone": "Asia/Seoul",
      "status": "PUBLISHED",
      "displayStatus": "RECRUITING"
    },
    {
      "eventId": 6,
      "title": "AI 논문 리딩 데이",
      "startsAt": "2026-11-28T01:00:00Z",
      "endsAt": null,
      "effectiveEndsAt": "2026-11-28T15:00:00Z",
      "timeZone": "Asia/Seoul",
      "status": "DRAFT",
      "displayStatus": "DRAFT"
    }
  ],
  "total": 2,
  "offset": 0,
  "limit": 20
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items[].eventId | Long | N | | EVENT.ID |
| items[].title | String | N | | EVENT.TITLE |
| items[].startsAt | String | N | UTC ISO 8601 | EVENT.STARTS_AT |
| items[].endsAt | String | Y | 종료 미입력이면 null | EVENT.ENDS_AT |
| items[].effectiveEndsAt | String | N | 종료 판정 시각, UTC | 계산: `Event.effectiveEndsAt()` |
| items[].timeZone | String | N | 행사 기준 IANA 시간대 | EVENT.TIME_ZONE |
| items[].status | String | N | 저장 상태 enum | EVENT.STATUS |
| items[].displayStatus | String | N | 표시 상태 enum | 계산: `Event.displayStatus(now, seatCounts)`. 재료: 신청의 방식·상태별 수 (페이지의 행사 ID 묶음에 GROUP BY 한 번) |
| total | Long | N | 전체 행사 수 | 계산: COUNT |
| offset | Integer | N | 요청 값 | — |
| limit | Integer | N | 요청 값 | — |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | offset · limit 범위 밖 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/events/page.tsx`: 지금은 「준비 중」. 연결 시 `features/events/EventsTable.tsx` 를 복원한다
- 근거 시안: `frontend/apps/playground/src/proto/events/EventAdminList.tsx`

---

## 행사 등록

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/events`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 행사를 `DRAFT`(작성 중)로 만든다 (§1 「행사 등록은 작성 중 상태로 저장」). 공개는 별도 상태 전환 API

### Path Parameters

없음

### Query Parameters

없음

### Request Body

```json
{
  "title": "연말 네트워킹 밋업",
  "summary": "한 해를 마무리하며 크루끼리 만나요",
  "description": "행사 소개, 참가 조건, 추가 절차…",
  "timeZone": "Asia/Seoul",
  "startsAt": "2026-12-05T10:00:00Z",
  "endsAt": "2026-12-05T13:00:00Z",
  "deadlineAt": "2026-12-03T14:59:00Z",
  "format": "HYBRID",
  "offline": { "capacity": 40, "location": "서울 강남구 ○○빌딩 5층" },
  "online": { "capacity": 100, "url": "https://meet.example.com/abc" },
  "confirmation": "AUTO",
  "questions": [
    { "questionId": null, "label": "참여 동기", "type": "TEXTAREA", "required": true, "options": [] },
    { "questionId": null, "label": "관심 주제", "type": "CHECKBOX", "required": false, "options": ["AI", "커리어", "네트워킹"] }
  ]
}
```

| 필드 | 타입 | 필수 | 검증 | 근거 |
|------|------|------|------|------|
| title | String | Y | 앞뒤 공백 제거 후 1~60자 | §2 「행사명 60자 이내」 |
| summary | String | Y | 1자 이상. 최대 길이 미정 (Q7) | 프로토 `validateEvent` (필수) |
| description | String | Y | 1자 이상. 최대 길이 미정. 서식 없는 글로 저장 (HTML 로 해석하지 않음). 최대 길이는 Q7 | 프로토 (필수) |
| timeZone | String | Y | 허용 IANA 값 중 하나 (Q5) | §2 「기준 시간대」 |
| startsAt | String | Y | UTC ISO 8601 | §2 |
| endsAt | String | N | UTC ISO 8601. 있으면 `> startsAt`. 없거나 null 이면 null 저장 | §2 「종료는 선택 입력이며 입력 시 시작 이후」 |
| deadlineAt | String | Y | UTC ISO 8601. `≤ startsAt` | §2 「신청 마감은 시작 이전 또는 같은 시각」 |
| format | String | Y | `ONLINE` · `OFFLINE` · `HYBRID` | §3 |
| offline | Object | format 이 OFFLINE·HYBRID 면 Y | 그 밖의 format 에서 보내면 400 | §3 |
| offline.capacity | Integer | Y | 1 ~ 10,000 | §3 |
| offline.location | String | Y | 1자 이상. 최대 길이 미정 (Q7) | 프로토 (오프라인 장소 필수) |
| online | Object | format 이 ONLINE·HYBRID 면 Y | 그 밖의 format 에서 보내면 400 | §3 |
| online.capacity | Integer | Y | 1 ~ 10,000 | §3 |
| online.url | String | N | 있으면 `http`·`https` 절대 URL. 최대 2,048자 (제안). 없으면 null 이고 화면은 「추후 안내」를 보여 준다 | §3 「참여 링크는 http·https 주소」 |
| confirmation | String | N | `AUTO`(기본) · `REVIEW` | §3 「기본은 자동 확정」 |
| questions | Array | N | 0 ~ 10개. 배열 순서 = 표시 순서. 없으면 빈 배열 | §4 「최대 10개」 |
| questions[].questionId | String | N | 등록에서는 null | — |
| questions[].label | String | Y | 1자 이상. 최대 길이 미정 (Q7) | 프로토 |
| questions[].type | String | Y | `TEXT`(단답) · `TEXTAREA`(장문) · `RADIO`(객관식 하나) · `CHECKBOX`(객관식 여럿). `SELECT` 는 받지 않는다 (400) | §4 「드롭다운 형식은 제공하지 않음」 |
| questions[].required | Boolean | Y | | §4 |
| questions[].options | String[] | Y | RADIO·CHECKBOX: 공백 아닌 서로 다른 선택지 2개 이상, 개수·길이 상한 미정 (Q7). TEXT·TEXTAREA: 빈 배열 | §4 「서로 다른 선택지 2개 이상」 |

- 시각은 **초 단위 이하를 0 으로 맞춘다**(제안). 편집 폼이 분 단위라 비교가 흔들리지 않게 한다
- 처음 등록하면 `STATUS = DRAFT`, `PUBLISHED_AT = null`, `CREATED_BY = 호출한 계정`
- 등록에서는 마감이 미래인지 보지 않는다. 공개·재모집 때 본다 (§2 「공개·재모집 시 미래 마감시간 필요」). 지난 일정으로 작성 중 행사를 만들 수 있다
- 작성 중이면 일부만 저장해도 되는지 PRD 가 말하지 않는다. 프로토타입은 저장마다 전체를 검증하므로 그대로 제안한다 (Q2)
- 질문 타입 이름은 [study-application](../study-application/spec.md) 과 맞췄다. 그쪽의 `allowOther` · `placeholder` 는 행사 PRD 에 없어 두지 않는다

### Response — 201

본문은 운영 상세(`GET /api/admin/events/{eventId}`)와 같다. 헤더 `Location: /api/admin/events/{eventId}`.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 위 검증 실패. 실패한 필드 이름(`title`, `deadlineAt`, `questions[2].options` …)을 `errorMessage` 에 담는다 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/features/events/EventForm.tsx` · `form-schema.ts` · `EventDialog.tsx`: 지금 스키마는 시안 이전 필드다. 연결할 때 이 스펙으로 바꾼다
- 근거 시안: `frontend/apps/playground/src/proto/events/EventEditor.tsx` · `EventQuestionEditor.tsx`

---

## 운영 행사 상세

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/events/{eventId}`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 편집 폼을 채우는 값 전부 + 참여 방식별 모집 현황 + 이 행사에서 지금 할 수 있는 수정

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters

없음

### Request Body

없음

### Response — 200

```json
{
  "eventId": 7,
  "title": "연말 네트워킹 밋업",
  "summary": "한 해를 마무리하며 크루끼리 만나요",
  "description": "행사 소개, 참가 조건, 추가 절차…",
  "timeZone": "Asia/Seoul",
  "startsAt": "2026-12-05T10:00:00Z",
  "endsAt": "2026-12-05T13:00:00Z",
  "effectiveEndsAt": "2026-12-05T13:00:00Z",
  "deadlineAt": "2026-12-03T14:59:00Z",
  "format": "HYBRID",
  "offline": { "capacity": 40, "location": "서울 강남구 ○○빌딩 5층" },
  "online": { "capacity": 100, "url": "https://meet.example.com/abc" },
  "confirmation": "REVIEW",
  "status": "PUBLISHED",
  "displayStatus": "RECRUITING",
  "publishedAt": "2026-11-20T03:00:00Z",
  "questions": [
    { "questionId": "q_7f3a", "label": "참여 동기", "type": "TEXTAREA", "required": true, "options": [] }
  ],
  "seats": [
    { "channel": "ONLINE", "capacity": 100, "pending": 3, "confirmed": 41, "remaining": 56 },
    { "channel": "OFFLINE", "capacity": 40, "pending": 5, "confirmed": 35, "remaining": 0 }
  ],
  "hasRegistrations": true,
  "canEdit": true,
  "canChangeConfirmation": true,
  "removableChannels": ["ONLINE"],
  "createdAt": "2026-11-18T05:00:00Z",
  "updatedAt": "2026-11-21T08:12:00Z"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| eventId | Long | N | | EVENT.ID |
| title | String | N | | EVENT.TITLE |
| summary | String | N | 한 줄 소개 | EVENT.SUMMARY |
| description | String | N | 모집 상세 | EVENT.DESCRIPTION |
| timeZone | String | N | 행사 기준 IANA 시간대 | EVENT.TIME_ZONE |
| startsAt | String | N | UTC | EVENT.STARTS_AT |
| endsAt | String | Y | 미입력이면 null | EVENT.ENDS_AT |
| effectiveEndsAt | String | N | 종료 판정 시각, UTC | 계산: `Event.effectiveEndsAt()` |
| deadlineAt | String | N | UTC | EVENT.DEADLINE_AT |
| format | String | N | `ONLINE` · `OFFLINE` · `HYBRID` | 계산: 저장된 참여 방식 행의 조합 (EVENT_CHANNEL) |
| offline | Object | Y | format 에 OFFLINE 이 없으면 null | EVENT_CHANNEL (CHANNEL = OFFLINE) |
| offline.capacity | Integer | N | | EVENT_CHANNEL.CAPACITY |
| offline.location | String | N | | EVENT_CHANNEL.LOCATION |
| online | Object | Y | format 에 ONLINE 이 없으면 null | EVENT_CHANNEL (CHANNEL = ONLINE) |
| online.capacity | Integer | N | | EVENT_CHANNEL.CAPACITY |
| online.url | String | Y | 미입력이면 null | EVENT_CHANNEL.ONLINE_URL |
| confirmation | String | N | `AUTO` · `REVIEW` | EVENT.CONFIRMATION |
| status | String | N | 저장 상태 | EVENT.STATUS |
| displayStatus | String | N | 표시 상태 | 계산: `Event.displayStatus(now, seatCounts)` |
| publishedAt | String | Y | 최초 공개 시각. 공개 이력 없으면 null | EVENT.PUBLISHED_AT |
| questions | Array | N | 현재 질문. 기존 신청의 질문 사본과 다를 수 있다 | EVENT_QUESTION, SORT_ORDER 순 |
| questions[].questionId | String | N | 행사 안에서 안정적인 키 | EVENT_QUESTION.QUESTION_KEY |
| questions[].label | String | N | | EVENT_QUESTION.LABEL |
| questions[].type | String | N | `TEXT` · `TEXTAREA` · `RADIO` · `CHECKBOX` | EVENT_QUESTION.TYPE |
| questions[].required | Boolean | N | | EVENT_QUESTION.REQUIRED |
| questions[].options | String[] | N | TEXT·TEXTAREA 는 빈 배열 | EVENT_QUESTION.OPTIONS (JSON) |
| seats | Array | N | 참여 방식마다 한 줄. ONLINE, OFFLINE 순 (§5) | — |
| seats[].channel | String | N | `ONLINE` · `OFFLINE` | EVENT_CHANNEL.CHANNEL |
| seats[].capacity | Integer | N | | EVENT_CHANNEL.CAPACITY |
| seats[].pending | Integer | N | 확인 대기 수 | 계산: 신청 방식·상태별 COUNT |
| seats[].confirmed | Integer | N | 참가 확정 수 | 계산: 같은 쿼리 |
| seats[].remaining | Integer | N | 잔여석 | 계산: `Event.seatsOf(channel, counts)` |
| hasRegistrations | Boolean | N | 상태와 관계없이 신청 행이 하나라도 있나. 공개 취소 가능 여부의 재료 (§1) | 계산: 신청 EXISTS |
| canEdit | Boolean | N | 수정 가능 여부 | 계산: `Event.canEdit(now)`. CANCELLED 면 false. 시작 후 규칙은 Q9 |
| canChangeConfirmation | Boolean | N | 확정 방식 변경 가능 | 계산: `Event.canChangeConfirmation(now)`. 취소 아님 ∧ `now < STARTS_AT` |
| removableChannels | String[] | N | 지금 없앨 수 있는 참여 방식. 확인 대기·확정 신청이 남은 방식은 빠진다 | 계산: `Event.removableChannels(counts)` |
| createdAt | String | N | | EVENT.CREATED_AT |
| updatedAt | String | N | | EVENT.UPDATED_AT |

- 공개·마감·재모집·공개 취소·행사 취소 가능 여부(`canPublish` 등)도 화면에 필요하다. 이 판정 필드는 **상태 전환 스펙이 이 응답에 추가**한다. 지금 정하지 않는다
- 신청자 개인정보는 싣지 않는다. 참가자 탭은 별도 API

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | eventId 없음 |

### 프론트엔드 사용처

- back-office-front 행사 상세 (아직 없음. 시안 확정 뒤 만든다)
- 근거 시안: `frontend/apps/playground/src/proto/events/EventAdminDetail.tsx` · `EventWorkspace.tsx`

---

## 행사 수정

### 기본 정보

- **Method**: PUT
- **Path**: `/api/admin/events/{eventId}`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 편집 폼 전체를 한 번에 저장한다. `STATUS` · `PUBLISHED_AT` 은 바꾸지 않는다 (상태 전환 API 의 일)

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters

없음

### Request Body

등록과 같은 모양·같은 필드 검증. 다른 점:

- `questions[].questionId`: 기존 질문이면 그 키, 새 질문이면 null. 요청에 없는 기존 질문은 삭제된다. 그 행사에 없는 키를 보내면 400
- 필드 검증 뒤 **현재 행사·신청 상태에 대한 검증**을 한다. 순서는 위에서부터

| # | 규칙 | 실패 | 근거 |
|---|---|---|---|
| 1 | 행사가 `CANCELLED` 면 아무것도 바꿀 수 없다 | 409 `EVENT_CANCELLED` | §2 「취소된 행사는 조회 전용」 |
| 2 | 시작 후·종료 후 수정 범위는 **미결정** | — | Q9 |
| 3 | 확정 방식을 바꾸려면 `now < 기존 STARTS_AT` 이고 `now < 새 STARTS_AT` | 409 `EVENT_ALREADY_STARTED` | §3, 프로토 `validateEvent` |
| 4 | 확인 대기·참가 확정 신청이 남은 참여 방식은 없앨 수 없다 (예: HYBRID → ONLINE 인데 오프라인 유효 신청 있음) | 409 `CHANNEL_IN_USE` | §3 「신청자가 있는 방식을 제거하는 변경만 제한」 |
| 5 | 방식별 정원 ≥ 그 방식의 확인 대기 + 참가 확정 | 409 `CAPACITY_BELOW_OCCUPIED` | §3 「확인 대기와 참가 확정 합보다 작게 변경 제한」 |
| 6 | 저장 상태가 `PUBLISHED` 이고 마감 시각을 **바꿨다면** 새 마감은 `> now` | 400 `INVALID_INPUT` (`deadlineAt`) | §2 「공개·재모집 시 미래 마감」, 프로토 `validateEvent` |

- 공개 여부·신청 이력과 관계없이 기본 정보·모집 설정·질문을 고칠 수 있다 (사용자 전달 Notion PRD 「시작 전 수정 가능」, §4 「공개 여부와 신청 이력에 관계없이 편집 가능」)
- **신청 마감 후에도 장소·온라인 링크 등 정보 수정을 허용한다** (Notion PRD, §2). 마감이 지났다는 이유로 거절하지 않는다
- 질문을 고쳐도 기존 신청의 질문·답변 사본은 그대로다 (위 「신청 질문의 보존」)
- 확정 방식이 `REVIEW → AUTO` 면 같은 트랜잭션에서 `PENDING` → `CONFIRMED`, 커밋 뒤 메일 (위 「확정 방식 전환」)
- 5번과 신청이 같은 순간에 오는 경우: 행사 행을 쓰기 잠금하고 그 안에서 센다 (위 「정원과 잔여석」, Q8)
- 장소·링크·일정이 바뀌어도 참가자에게 자동 알림은 보내지 않는다. PRD 에 없다. 운영자가 안내 메일로 알린다 (Q10)
- 정원을 늘려 잔여석이 생기면 표시 상태가 `FULL` 에서 `RECRUITING` 으로 돌아갈 수 있다 (`STATUS = PUBLISHED`, 마감 전일 때). Q11 참고

### Response — 200

본문은 운영 상세와 같다 (저장 후 값).

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 등록과 같은 필드 검증 · 없는 `questionId` · 위 6번 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | eventId 없음 |
| 409 | EVENT_CANCELLED | 취소된 행사 |
| 409 | EVENT_ALREADY_STARTED | 시작 후 확정 방식 변경 |
| 409 | CHANNEL_IN_USE | 유효 신청이 남은 참여 방식 제거 |
| 409 | CAPACITY_BELOW_OCCUPIED | 정원 < 확인 대기 + 참가 확정 |

- 409 세부 코드 넷은 새 `ErrorCode` 다. 화면이 문구를 가르려면 필요하다. `CONFLICT` 하나로 묶을지는 Q12

### 프론트엔드 사용처

- back-office-front 행사 상세 「행사 정보」 탭 (아직 없음)
- 근거 시안: `frontend/apps/playground/src/proto/events/EventEditor.tsx` (편집 모드) · `model.ts` `validateEvent` · `transition` SAVE

---

## 데이터 모델 제안

ERD 문서가 없어 소스 칸은 아래 제안 이름을 쓴다. 확정은 ERD PR 에서 한다. 행사는 애그리거트 루트 `Event`, 참여 방식·질문은 그 안의 엔티티, 신청은 별도 애그리거트(ID 참조)를 제안한다.

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| EVENT | ID · TITLE(VARCHAR 60) · SUMMARY · DESCRIPTION(TEXT) · TIME_ZONE(VARCHAR 64) · STARTS_AT · ENDS_AT(NULL) · DEADLINE_AT · CONFIRMATION · STATUS · PUBLISHED_AT(NULL) · CREATED_BY · CREATED_AT · UPDATED_AT | 시각은 UTC |
| EVENT_CHANNEL | ID · EVENT_ID(FK) · CHANNEL(`ONLINE`/`OFFLINE`) · CAPACITY · LOCATION(NULL) · ONLINE_URL(NULL) | `UNIQUE(EVENT_ID, CHANNEL)`. format 은 행 조합으로 정한다 |
| EVENT_QUESTION | ID · EVENT_ID(FK) · QUESTION_KEY · LABEL · TYPE · REQUIRED · OPTIONS(JSON) · SORT_ORDER | `UNIQUE(EVENT_ID, QUESTION_KEY)`. 신청이 FK 로 물지 않는다 |
| (신청 테이블) | 신청 스펙에서 정한다 | 이 스펙은 방식·상태별 COUNT 와 EXISTS 만 읽고, 확정 방식 전환 때 `PENDING → CONFIRMED` 만 쓴다. `INDEX(EVENT_ID, CHANNEL, STATUS)` 필요 |

- 이름: `Event` 는 도메인 이벤트(`*Event` 접미사, `com.studyclub.common.event`)와 헷갈린다 (Q13)

## 퍼널·계측

해당 없음. 캡틴의 운영 기능이라 퍼널 단계를 바꾸지 않고, 추가·변경하는 분석 이벤트가 없다.

## 근거와 PRD·코드의 차이

| 항목 | 레포 PRD·프로토 | 사용자 전달 Notion PRD | 이 스펙 |
|---|---|---|---|
| 시작 후 수정 | 확정 방식만 「시작 전까지」. 그 밖은 말하지 않음. 프로토는 시작 후에도 저장 허용 | 「공개 여부·신청 이력과 관계없이 시작 전 수정 가능」 | 시작 전은 허용. 시작 후 범위는 Q9 |
| 마감 후 장소·링크 수정 | 허용 (§2) | 허용 | 허용 |
| 삭제 | 언급 없음. 공개 취소(신청 이력 없을 때)·행사 취소만 | 공개·신청 이력이 있으면 취소, 이력 없는 작성 중 행사 삭제는 미결정 | DELETE 없음, Q1 |
| 서머타임 시각 저장 제한 | §2 「저장 제한」. 프로토는 화면 변환에서 막음 | — | UTC 요청이라 서버는 판정 못 함. 화면이 막는다 (Q4) |
| 시간대 선택지 | 프로토 `ZONES`: 서울·토론토·뉴욕·LA | — | POL-0006 넷 제안 (Q5) |
| 질문 타입 `SELECT` | 프로토 타입에 남아 있음. PRD 는 「제공 안 함, 단일 선택으로 전환」 | — | API 는 받지 않음 |
| back-office-front 폼 | `features/events/form-schema.ts` 는 시안 이전 필드 | — | 연결할 때 이 스펙으로 바꾼다 |
| back-office-front TODO | `POST/GET/PATCH/DELETE /api/events` | — | 경로는 `/api/admin/events`, 수정은 PUT, DELETE 없음 |

## 미확정

- [NEEDS CLARIFICATION] Q1 신청 이력이 없는 작성 중 행사를 삭제할 수 있나: 물리 삭제 / 소프트 삭제 / 불가 (Notion PRD 미결정)
- [NEEDS CLARIFICATION] Q2 작성 중 저장 때도 필수값을 전부 요구하나 (프로토는 요구). 일부 저장을 허용하면 전체 검증은 공개 전환 때로 옮긴다
- [NEEDS CLARIFICATION] Q3 표시 상태 우선순위: 프로토 순서(취소 > 종료 > 진행 중 > 모집 마감 > 정원 마감 > 모집 중)를 확정할지. 종료 미입력 행사의 「행사 시작」을 `IN_PROGRESS` 와 같은 값으로 둘지 따로 둘지
- [NEEDS CLARIFICATION] Q4 서머타임 판정 위치: (제안) 레포 규칙대로 UTC 로 받고 판정은 화면이 한다 / 이 스펙만 「현지 시각 + 시간대」로 받아 서버가 판정한다. 후자는 레포 날짜 규칙의 예외가 된다
- [NEEDS CLARIFICATION] Q5 행사 기준 시간대 허용 값: POL-0006 넷(서울·뉴욕·밴쿠버·LA) vs 프로토(서울·토론토·뉴욕·LA)
- [NEEDS CLARIFICATION] Q6 운영 목록 필터·검색·정렬 (제안: `STARTS_AT DESC` 고정, 필터 없음)
- [NEEDS CLARIFICATION] Q7 한 줄 소개 · 모집 상세 · 장소 · 질문 제목 · 선택지의 최대 길이와 선택지 개수 상한 (행사명 60자만 정해짐)
- [NEEDS CLARIFICATION] Q8 정원 동시성: 행사 행 쓰기 잠금으로 신청·정원 축소를 직렬화하는 방식에 신청 스펙이 동의하는지
- [NEEDS CLARIFICATION] Q9 행사 시작 후·종료 후 수정 범위: 전부 허용 / 정보만 허용 / 전부 금지. PRD 가 종료 행사에 금지한 것은 상태 전환(취소·마감·재모집·공개 취소)뿐이다
- [NEEDS CLARIFICATION] Q10 장소·링크·일정 수정 시 참가자 자동 알림이 필요한지 (PRD 에 없음. 지금은 보내지 않음)
- [NEEDS CLARIFICATION] Q11 정원을 늘려 정원 마감이 풀리면 자동으로 모집 중이 되는 것이 의도인지
- [NEEDS CLARIFICATION] Q12 409 세부 errorCode 넷(`EVENT_CANCELLED` · `EVENT_ALREADY_STARTED` · `CHANNEL_IN_USE` · `CAPACITY_BELOW_OCCUPIED`)을 새로 둘지, `CONFLICT` 하나로 묶을지
- [NEEDS CLARIFICATION] Q13 Java 클래스·테이블 이름: `Event`/`EVENT` vs `ClubEvent`/`CLUB_EVENT` (도메인 이벤트와 이름 충돌)
- [NEEDS CLARIFICATION] Q14 캡틴 둘이 같은 행사를 동시에 고칠 때 덮어쓰기 방지(`updatedAt` 비교·버전)가 필요한지. PRD 에 없어 제안하지 않았다
