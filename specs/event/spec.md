# 행사 API Spec: 캡틴이 백오피스에서 등록·수정·조회한다

> ERD: 없음. 행사 테이블이 아직 없다. 아래 「데이터 모델 제안」이 초안이고, 스펙 확정 뒤 `docs/erd/` 에 테이블 문서를 만든다
> 생성일: 2026-11-14 · 리뷰 반영: 2026-11-17 (PR #470 리뷰 · PR #471 결정)
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 행사를 등록하고 신청자의 참가를 확정할 수 있다](../../01-planning/stories/captain-manage-events/PRD.md) (ST-037)
>
> 기준 프로토타입: playground `/proto/console/events` · `/proto/console/events/{id}` (PR #469, PR #471)
> 판정 로직의 근거: `frontend/apps/playground/src/proto/events/model.ts` (`EVENT_LIMITS` · `validateEvent` · `eventStatus` · `seatInfo` · `transition`)
> 실제 경로(연결 전): back-office-front `/events` (「준비 중」 화면)

## 엔드포인트 목록

**백오피스: `/api/admin/events` (`AdminClubEventController`, 캡틴만)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/events | 운영 행사 목록: 행사명 · 일정 · 표시 상태. 시작 시각 내림차순 20개씩 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/events | 행사 등록: 저장하면 바로 크루에게 공개(`PUBLISHED`) | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/events/{eventId} | 운영 상세: 편집 폼 값 + 참여 방식별 모집 현황 + 버전 | O (ADMIN) | 스펙작성중 |
| PUT | /api/admin/events/{eventId} | 행사 수정: 기본 정보 · 모집 설정 · 신청 질문 전체를 한 번에 저장 | O (ADMIN) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

## 먼저 읽을 것

### 이 스펙이 다루는 것과 안 다루는 것

| 다룬다 | 다루지 않는다 (별도 스펙) | 이 스펙과 닿는 곳 |
|---|---|---|
| 백오피스 등록 · 수정 · 운영 목록 · 운영 상세 | 사용자 사이트 행사 조회 · 신청 · 본인 취소 | 운영 상세의 모집 현황 수치, 수정 시 정원 하한, 신청 당시 질문 보존, 행사 행 잠금 순서 (아래 「같은 행사에 쓰는 요청의 처리 순서」) |
| | 참가 확정 · 참가 불가 · 운영진 개별 취소 · 참가자 목록 · 종료 시 남은 확인 대기 신청의 참가 불가 전환 | 확정 방식 전환이 바꾸는 신청 상태 |
| | 모집 마감 · 재모집 · 행사 취소 (상태 전환) | `status` 값, 취소·종료 행사 수정 금지, 재모집의 미래 마감 규칙, 버전 증가 |
| | 안내 메일 · 자동 메일 발송 · 메일 이력 | 확정 방식 전환이 만드는 확정 메일 (아래 「확정 방식 전환」) |

다른 스펙은 이 스펙이 정한 `status` · 판정 메서드 · 데이터 모델 · 잠금 순서를 그대로 쓴다. 사이트에 무엇을 보여 줄지(참가 확정자만 보는 온라인 링크 등)는 사이트 스펙에서 정한다. 이 스펙의 응답은 캡틴에게만 나간다.

초안 저장 · 초안 삭제 · 공개 취소는 **이번 범위에서 뺐다** (Q1·Q2 결정, PR #471). 그래서 `DRAFT` 상태와 `DELETE` 가 없다.

### 인가

- `/api/admin/events/**` 는 `@RequireAdmin` 으로 캡틴(`SYSTEM_ROLE = ADMIN`)만 부른다. 토큰이 없으면 401, ADMIN 이 아니면 403 (captain-manage-events §3 「운영 기능은 캡틴 권한 확인」, [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md))
- 인가는 행사 존재 여부보다 먼저 본다. 없는 ID 로 크루가 불러도 403 ([site-notice](../site-notice/spec.md#인가) 와 같다)
- `/api/admin` 은 보안 설정상 기본 인증 경로다. `permitAll` 을 추가하지 않는다
- 권한·상태 판정은 전부 서버가 요청마다 한다. 화면의 버튼 숨김·조회 전용 표시는 표시용이다

### 상태: 저장 상태와 표시 상태를 나눈다

**저장 상태 `CLUB_EVENT.STATUS`**: 운영자가 바꾸는 값. 이 스펙의 등록은 `PUBLISHED` 를 만들고, 수정은 상태를 바꾸지 않는다. 전환은 별도 상태 전환 스펙.

| 값 | 뜻 |
|---|---|
| `PUBLISHED` | 공개, 모집을 받는다. 등록하면 이 값이다 |
| `CLOSED` | 공개, 운영자가 모집을 마감했다 (재모집하면 `PUBLISHED`) |
| `CANCELLED` | 행사 취소. 읽기 전용, 되돌릴 수 없다 |

**표시 상태 `displayStatus`**: 저장 상태 + 서버 시각 + 인원으로 서버가 계산한다. 목록·상세의 상태 칩은 이 값만 그린다. 계산: `ClubEvent.displayStatus(now, seatCounts)` (제안 이름).

| 값 | 화면 (§1-1) | 조건 |
|---|---|---|
| `CANCELLED` | 행사 취소 | `STATUS = CANCELLED` |
| `ENDED` | 종료 | `now ≥ effectiveEndsAt` |
| `RECRUITMENT_CLOSED` | 모집 마감 | `STATUS = CLOSED` 또는 `now ≥ DEADLINE_AT` 또는 `now ≥ STARTS_AT` |
| `FULL` | 정원 마감 | 모든 참여 방식의 잔여석 0 |
| `RECRUITING` | 모집 중 | 그 밖 |

- 위에서부터 먼저 맞는 값을 쓴다: **행사 취소 > 종료 > 모집 마감 > 정원 마감 > 모집 중** (Q3 결정)
- 「진행 중」·「행사 시작」 표시는 없다. 행사가 시작한 뒤에도 종료 전까지는 `RECRUITMENT_CLOSED` 다 (§1-1 「신청 마감 후 행사 종료 전까지 모집 마감으로 표시」)
- **`effectiveEndsAt` (종료 판정 시각)**: `ENDS_AT` 이 있으면 그 시각. 없으면 **행사 기준 시간대(`TIME_ZONE`)에서 시작일 다음 날 00:00** 의 UTC 시각 (§2 「종료 시각을 입력하지 않은 행사는 행사 기준 시간대에서 시작일이 지나면 종료로 표시」). 입력된 종료 시각이 언제나 우선한다
- **빈자리가 생기면 자동으로 모집 중** (Q11 결정): `FULL` 은 저장하지 않고 요청마다 계산한다. 그래서 신청 취소·참가 불가·정원 확대로 잔여석이 생기면 행사 시작 전 · 신청 마감 전 · `STATUS ≠ CLOSED`(캡틴이 수동 마감하지 않음)일 때 `RECRUITING` 으로 돌아간다. 위 표의 순서가 이 세 조건을 이미 담고 있어 따로 전환하는 처리가 없다
- 판정은 서버 시각(`Instant.now()`)으로 한다. 이후 사이트용·신청 API 도 같은 메서드에 같은 쿼리로 센 인원을 넘겨야 한다 ([판정은 서버가 내려준다](../../docs/backend-development-guide/api/endpoint-convention.md#판정은-서버가-내려준다))

### 정원과 잔여석

- 유효 인원 = 그 참여 방식의 `PENDING`(확인 대기) + `CONFIRMED`(참가 확정) 신청 수. `DECLINED` · `CANCELLED` 는 자리를 반환한다 (§5, §3 데이터 규칙)
- 잔여석 = `max(0, 정원 − 유효 인원)`. 계산: `ClubEvent.seatsOf(channel, counts)` (제안)
- 신청 제출의 중복 신청 제한은 신청 스펙의 책임이다. 정원과 확정 방식을 읽는 순서는 아래 규칙을 신청 스펙도 따른다

### 같은 행사에 쓰는 요청의 처리 순서

Q8 결정: 같은 행사의 신청과 정원 변경은 한 번에 하나씩 처리하고, 나중 요청은 먼저 반영된 결과를 기준으로 다시 검증한다. 확정 방식 전환과 신청이 겹치는 경우(PR #470 리뷰)도 같은 방법으로 순서를 정한다.

**규칙**: 같은 행사의 정원·확정 방식·참여 방식을 읽고 판단하거나 바꾸는 트랜잭션은 **첫 조회로 `CLUB_EVENT` 행을 쓰기 잠금**(`SELECT … FOR UPDATE`)하고, 잠금을 얻은 뒤에 행사 값과 신청 수를 읽는다. 잠금 전에 같은 행사나 신청을 일반 `SELECT` 로 먼저 읽지 않는다 (MySQL 기본 격리 수준에서는 첫 일반 조회 때 읽기 시점이 고정된다. 잠금 전에 읽으면 앞 요청이 커밋한 신청을 못 본다).

| 이 잠금을 잡는 요청 | 스펙 |
|---|---|
| 행사 수정 (`PUT`) | 이 스펙 |
| 크루 신청 제출 | 신청 스펙 (같은 순서를 따라야 이 보장이 성립한다) |
| 모집 마감 · 재모집 · 행사 취소 | 상태 전환 스펙 |

결과는 어느 요청이 먼저 잠금을 얻었는지로 갈린다.

| 겹친 요청 | 신청이 먼저 | 수정이 먼저 |
|---|---|---|
| 마지막 자리 신청 ↔ 정원 축소 | 신청이 자리를 차지한다. 수정은 늘어난 유효 인원으로 다시 검사해 409 `CAPACITY_BELOW_OCCUPIED` | 정원이 줄어든다. 신청은 줄어든 정원으로 다시 검사해 거절된다 (정원 마감) |
| 신청 ↔ `REVIEW → AUTO` 저장 | 신청이 `PENDING` 으로 커밋된다. 수정은 잠금 뒤 그 신청까지 포함해 모든 `PENDING` 을 `CONFIRMED` 로 바꾼다 | 확정 방식이 `AUTO` 로 커밋된다. 신청은 잠금 뒤 `AUTO` 를 읽고 바로 `CONFIRMED` 로 접수한다 |
| 신청 ↔ 참여 방식 제거 | 신청이 그 방식의 유효 인원을 만든다. 수정은 409 `CHANNEL_IN_USE` | 방식이 사라진다. 그 방식으로 온 신청은 거절된다 |

- 어느 순서든 정상 접수된 신청이 `AUTO` 행사에서 확인 대기로 남지 않는다
- 신청의 상태만 바꾸는 운영 처리(참가 확정 · 참가 불가 · 개별 취소)는 정원을 늘리지 않으므로 이 잠금이 필수는 아니다. 대신 `WHERE STATUS = 'PENDING'` 같은 조건부 갱신으로 이미 바뀐 신청을 다시 바꾸지 않는다. 일괄 확정과 겹치면 늦은 쪽이 「현재 상태에서는 처리할 수 없다」로 실패한다
- 잠금은 행사 한 행만 잡고 짧게 끝낸다. 메일은 커밋 뒤에 만든다

### 시각과 시간대

- **요청·응답 시각은 모두 UTC ISO 8601** (`2026-12-05T10:00:00Z`). 레포 규칙([spec-driven-development 「응답 shape 규칙」](../../docs/backend-development-guide/spec-driven-development.md))과 선례([study-meeting](../study-meeting/spec.md) 「화면이 현지 시각 → UTC 로 바꿔 보낸다」)를 따른다
- **서머타임은 스터디 일정과 같게 화면이 처리한다** (Q4 결정). 편집 폼은 행사 기준 시간대(`timeZone`)의 현지 시각으로 입력받는다. 전환으로 사라지는 시각이면 그 입력란에서 다른 시각을 고르도록 안내하고, 두 번 나오는 시각이면 시계 전환 전·후 중 하나를 고르게 한다. 화면이 확정한 시각을 UTC 로 보낸다 (§2, 프로토 `resolveEventInput`)
- 서버는 UTC 한 순간만 받으므로 현지 시각의 서머타임 판정을 하지 않는다. 받은 시각끼리의 순서(종료 > 시작 ≥ 마감)와 현재 시각 비교만 검증한다
- 응답의 UTC 를 현지 시각으로 바꿔 폼을 채우는 것도 화면이 한다. **수정하지 않은 일정은 응답에서 받은 UTC 값을 그대로 다시 보낸다** (§2 「수정하지 않은 일정은 이미 저장한 시각을 유지」). 그래야 전환 전·후 선택이 저장마다 바뀌지 않는다
- 시각은 초 단위 이하를 0 으로 맞춰 저장한다 (제안). 편집 폼이 분 단위라 비교가 흔들리지 않게 한다
- `timeZone` 은 저장하고, 서버는 `effectiveEndsAt` 계산에 쓴다
- **`timeZone` 허용 값** (Q5 결정): `Asia/Seoul` · `America/Toronto` · `America/New_York` · `America/Los_Angeles` (프로토 `ZONES` 와 같다). [POL-0006](../../01-planning/_registry/policies/POL-0006-timezone.md) 의 회원 시간대(밴쿠버 포함)와는 지금 다르다. R1 에서 공통 시간대 선택지를 넓힐 때 행사에도 같이 적용한다

### 수정할 수 있는 범위 (Q9 결정)

기준 시각은 요청을 처리하는 서버 시각, 판정 재료는 **저장되어 있던** 행사 값이다.

| 행사 상태 | 기본 정보 · 모집 설정 · 신청 질문 | 확정 방식 | 실패 |
|---|---|---|---|
| 시작 전 | 아래 검증 규칙대로 수정 | 변경 가능 | — |
| 시작 후 · 종료 전 | 아래 검증 규칙대로 수정. 단 시작 시각을 현재 이후로 옮길 수 없다 | 변경 불가 | 409 `EVENT_START_LOCKED` · `EVENT_ALREADY_STARTED` |
| 종료 (`now ≥ effectiveEndsAt`) | 조회만 | 조회만 | 409 `EVENT_ENDED` |
| 취소 (`STATUS = CANCELLED`) | 조회만 | 조회만 | 409 `EVENT_CANCELLED` |

- 공개 여부·신청 이력과 관계없이 고칠 수 있다 (§4 「공개 여부와 신청 이력에 관계없이 편집 가능」)
- **신청 마감 후에도 장소·온라인 링크 등 정보 수정을 허용한다** (§2). 마감이 지났다는 이유로 거절하지 않는다
- 운영 상세는 `canEdit` · `canChangeConfirmation` · `canSetFutureStart` 로 화면에 이 판정을 내려 준다. 종료·취소 행사는 `canEdit = false` 라 화면이 기본 정보·모집 설정·신청 질문을 조회 전용으로 그린다

### 확정 방식 전환 (수정의 연관 효과)

| 바꾸기 | 효과 | 근거 |
|---|---|---|
| `REVIEW` → `AUTO` | 잠금을 얻은 뒤 그 행사의 `PENDING` 신청을 **같은 트랜잭션에서** 전부 `CONFIRMED` 로 바꾼다. 커밋 뒤 바뀐 신청마다 확정 안내 메일 1건 생성 | §3·§3 데이터 규칙, 프로토 `transition` SAVE |
| `AUTO` → `REVIEW` | 이미 `CONFIRMED` · `DECLINED` · `CANCELLED` 인 신청은 그대로. 이후 신청부터 `PENDING` 으로 접수 | 같은 곳 |
| 행사 시작 후 | 확정 방식 변경 거절 (409 `EVENT_ALREADY_STARTED`) | §3 「행사 시작 전까지만 가능」 |

- 신청과 겹칠 때의 순서는 위 「같은 행사에 쓰는 요청의 처리 순서」
- 메일은 서비스가 직접 보내지 않는다. 확정 처리한 신청 ID 목록을 담은 도메인 이벤트(가칭 `ClubEventRegistrationsConfirmedEvent`)를 발행하고 `AFTER_COMMIT` 구독자가 메일을 만든다 ([domain-events](../domain-events/spec.md)). 신청 ID 목록은 잠금 뒤 실제로 바꾼 행으로 만든다. 템플릿·이력·실패 처리 계약은 메일 스펙에서 정한다
- 이 자동 확정 메일은 운영 콘솔 「메일 이력」 탭에 보이지 않는다 (§7)
- 자동 확정으로 바꿔도 정원은 다시 검사하지 않는다. `PENDING` 도 이미 자리를 차지하고 있다
- 콘솔은 저장 전에 「현재 확인 대기 N건이 참가 확정된다」를 안내한다 (§3). 그 N 은 운영 상세 응답 `seats[].pending` 의 합이다. 안내 뒤 저장 전에 신청이 더 들어오면 실제 확정 건수는 N 보다 많을 수 있다

### 신청 질문의 보존

- `PUT` 은 질문 목록 전체를 교체한다. 기존 신청은 **신청 당시 질문과 답변의 사본**(신청 쪽에 보관)을 읽으므로, 질문을 고치거나 지워도 기존 신청은 바뀌지 않는다 (§4·§6, §3 데이터 규칙 「질문 변경은 이후 신청부터 적용」)
- 그래서 신청이 질문 행을 외래키로 물지 않는다. 사본의 저장 형태는 신청 스펙에서 정하되, 현재 질문을 조인해 기존 답을 다시 그리는 방식은 금지한다
- `questionId` 는 같은 행사 안에서 유지되는 안정 키다. 수정 요청에 기존 `questionId` 를 보내면 그 질문을 갱신, null 이면 새 질문
- 신청서를 쓰는 동안 질문이 바뀌었을 때 최신 질문을 보여 주고 바뀌지 않은 질문의 답만 유지하는 규칙(§4)은 신청 스펙이 정한다. 아래 행사 `version` 과는 다른 값이다

### 동시 수정 방지: 버전 (Q14 결정)

- 운영 상세 응답의 `version` 을 화면이 들고 있다가 `PUT` 요청에 그대로 보낸다
- 서버는 행사 행 잠금 뒤 저장된 `CLUB_EVENT.VERSION` 과 비교한다. 다르면 다른 캡틴이 먼저 저장한 것이므로 409 `EVENT_VERSION_CONFLICT` 로 막고 아무것도 바꾸지 않는다
- 저장에 성공하면 내용이 바뀌었는지와 관계없이 `version` 을 1 올리고, 응답에 새 값을 싣는다
- 신청 제출·참가 처리는 신청 쪽 행만 바꾸므로 `version` 을 올리지 않는다. 크루가 신청했다고 캡틴의 저장이 막히지 않는다
- 상태 전환(모집 마감·재모집·행사 취소)은 행사 행을 바꾸므로 `version` 을 올린다 (제안, 남은 확인 사항 N3)
- 화면은 409 `EVENT_VERSION_CONFLICT` 를 받으면 작성하던 내용을 유지한 채 「다른 캡틴이 먼저 저장했다」를 알리고, 최신 정보를 다시 불러올 수 있게 한다 (상세 재조회)

### 정보 변경 안내 (Q10 결정)

- 일정·장소·링크가 바뀌어도 서버는 참가자에게 자동 알림을 보내지 않는다
- 알릴 필요가 있으면 캡틴이 운영 상세의 `안내 메일 보내기`로 직접 보낸다 (메일 스펙)

### 개인정보·민감 정보

- 이 스펙의 응답에는 신청자 이메일·닉네임이 없다. 참가자 목록은 별도 스펙이고, 기존 콘솔 규칙대로 마스킹 + 행별 보기다 (§6)
- 온라인 참여 링크(`online.url`)는 캡틴에게는 그대로 보인다. 확정자만 볼 수 있다는 규칙(crew-apply-event §4)은 사이트 스펙이 지킨다. 서버는 링크를 로그에 남기지 않는다

### 초안·삭제·공개 취소

- Q1·Q2 결정: 초안 기능을 뺐다. 필수 항목을 입력하고 저장하면 바로 크루에게 공개하는 한 단계다. 초안 저장과 초안 삭제는 이번 범위가 아니다
- 그래서 `DELETE` 를 두지 않는다. 공개된 행사를 내리는 방법은 행사 취소(상태 전환 스펙)뿐이다. PR #471 에서 「공개 취소」도 없어졌다
- back-office-front `app/events/page.tsx` 의 `TODO(api)` 주석은 `POST/GET/PATCH/DELETE /api/events` 를 적고 있다. 이 스펙이 확정되면 주석을 이 스펙의 경로로 고친다

---

## 운영 행사 목록

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/events`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 모든 행사(종료·취소 포함). 행에는 행사명 · 일정 · 표시 상태만 싣는다 (§1-1 「참여 방식, 확정 방식·신청 인원 열은 표시하지 않음」)

### Path Parameters

없음

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| offset | Integer | N | 0 | 0 이상 |
| limit | Integer | N | 20 | 1 ~ 100. 화면은 20 고정 |

- 정렬: `STARTS_AT DESC, ID DESC` 고정 (Q6 결정 「행사 시작 시각 내림차순」. 같은 시각이면 나중에 만든 행사가 위)
- 페이지당 20개. 화면은 `?page=N` 을 `offset = (N-1) × 20` 으로 바꿔 부른다 ([site-notice](../site-notice/spec.md) 와 같은 방식)
- 검색·필터는 이번 범위가 아니다 (Q6 결정)

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
      "status": "CLOSED",
      "displayStatus": "RECRUITMENT_CLOSED"
    }
  ],
  "total": 2,
  "offset": 0,
  "limit": 20
}
```

두 번째 행은 종료 시각이 없어 서울 기준 시작일(11월 28일) 다음 날 00:00, 곧 `2026-11-28T15:00:00Z` 가 종료 판정 시각이다.

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items[].eventId | Long | N | | CLUB_EVENT.ID |
| items[].title | String | N | | CLUB_EVENT.TITLE |
| items[].startsAt | String | N | UTC ISO 8601 | CLUB_EVENT.STARTS_AT |
| items[].endsAt | String | Y | 종료 미입력이면 null | CLUB_EVENT.ENDS_AT |
| items[].effectiveEndsAt | String | N | 종료 판정 시각, UTC | 계산: `ClubEvent.effectiveEndsAt()` |
| items[].timeZone | String | N | 행사 기준 IANA 시간대 | CLUB_EVENT.TIME_ZONE |
| items[].status | String | N | 저장 상태 `PUBLISHED` · `CLOSED` · `CANCELLED` | CLUB_EVENT.STATUS |
| items[].displayStatus | String | N | 표시 상태 enum | 계산: `ClubEvent.displayStatus(now, seatCounts)`. 재료: 신청의 방식·상태별 수 (페이지의 행사 ID 묶음에 GROUP BY 한 번) |
| total | Long | N | 전체 행사 수 | 계산: COUNT |
| offset | Integer | N | 요청 값 | — |
| limit | Integer | N | 요청 값 | — |

- `offset` 이 `total` 이상이면 `items = []`, `total` 은 실제 값

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `offset < 0` · `limit` 이 1~100 밖 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/events/page.tsx`: 지금은 「준비 중」. 연결 시 `features/events/EventsTable.tsx` 를 복원한다
- 근거 시안: `frontend/apps/playground/src/proto/events/EventAdminList.tsx` · `model.ts` `eventAdminPage`

---

## 행사 등록

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/events`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 행사를 만들고 **바로 공개**한다 (`STATUS = PUBLISHED`). 저장하는 순간 크루 행사 목록에 보인다 (§1 「신규 행사 등록에서 저장하면 크루 행사 목록에 즉시 공개」, Q1·Q2 결정)

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

글자 수 제한은 화면과 서버가 같은 기준을 쓴다 (Q7 결정, 프로토 `EVENT_LIMITS`). 글자 수는 Java `String.length()` · JS `length` 와 같은 UTF-16 단위로 센다. 문자열은 앞뒤 공백을 제거한 뒤 검사하고 저장한다.

| 필드 | 타입 | 필수 | 검증 | 근거 |
|------|------|------|------|------|
| title | String | Y | 1~60자 | §2 「행사명 60자」 |
| summary | String | Y | 1~120자 | §2 「한 줄 소개 120자」 |
| description | String | Y | 1~5,000자. 서식 없는 글로 저장 (HTML 로 해석하지 않음) | §2 「모집 상세 5,000자」 |
| timeZone | String | Y | `Asia/Seoul` · `America/Toronto` · `America/New_York` · `America/Los_Angeles` 중 하나 | §2 「기준 시간대」, Q5 |
| startsAt | String | Y | UTC ISO 8601 | §2 |
| endsAt | String | N | UTC ISO 8601. 있으면 `> startsAt`. 없거나 null 이면 null 저장 | §2 「종료는 선택 입력이며 입력 시 시작 이후」 |
| deadlineAt | String | Y | UTC ISO 8601. `≤ startsAt` 이고 `> now` | §2 「신청 마감은 시작 이전 또는 같은 시각」 · 「신규 등록 시 미래 마감시간 필요」 |
| format | String | Y | `ONLINE` · `OFFLINE` · `HYBRID` | §3 |
| offline | Object | format 이 OFFLINE·HYBRID 면 Y | 그 밖의 format 에서 보내면 400 | §3 |
| offline.capacity | Integer | Y | 1 ~ 10,000 | §3 |
| offline.location | String | Y | 1~300자 | §3 「오프라인 장소는 300자 이내」 |
| online | Object | format 이 ONLINE·HYBRID 면 Y | 그 밖의 format 에서 보내면 400 | §3 |
| online.capacity | Integer | Y | 1 ~ 10,000 | §3 |
| online.url | String | N | 있으면 `http`·`https` 절대 URL. 최대 2,048자 (제안). 없으면 null 이고 화면은 「추후 안내」를 보여 준다 | §3 「참여 링크는 http·https 주소」 |
| confirmation | String | N | `AUTO`(기본) · `REVIEW`. 생략하면 `AUTO` | §3 「기본은 자동 확정」 |
| questions | Array | N | 0 ~ 20개. 배열 순서 = 표시 순서. 생략하면 빈 배열 | §4 「최대 20개」 |
| questions[].questionId | String | N | 등록에서는 null | — |
| questions[].label | String | Y | 1~200자 | §4 「질문 제목 200자」 |
| questions[].type | String | Y | `TEXT`(단답) · `TEXTAREA`(장문) · `RADIO`(객관식 하나) · `CHECKBOX`(객관식 여럿). `SELECT` 는 받지 않는다 (400) | §4 「드롭다운 형식은 제공하지 않음」 |
| questions[].required | Boolean | Y | | §4 |
| questions[].options | String[] | Y | RADIO·CHECKBOX: 공백 아닌 서로 다른 선택지 2~10개, 하나당 1~100자. TEXT·TEXTAREA: 빈 배열 | §4 「서로 다른 선택지 2~10개, 선택지 하나당 100자」 |

- 생략 기본값(`confirmation = AUTO`, `questions = []`)은 **등록에만** 있다. 수정은 두 필드를 반드시 받는다 (아래 「행사 수정」)
- 만들면 `STATUS = PUBLISHED`, `PUBLISHED_AT = now`, `VERSION = 0`, `CREATED_BY = 호출한 계정`
- `deadlineAt > now` 이고 `deadlineAt ≤ startsAt` 이므로 등록하는 행사는 언제나 시작 전이다
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
- 근거 시안: `frontend/apps/playground/src/proto/events/EventEditor.tsx` · `EventQuestionEditor.tsx` · `model.ts` `transition` CREATE

---

## 운영 행사 상세

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/events/{eventId}`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 편집 폼을 채우는 값 전부 + 참여 방식별 모집 현황 + 이 행사에서 지금 할 수 있는 수정 + 저장할 때 돌려보낼 버전

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
  "version": 3,
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
  "publishedAt": "2026-11-18T05:00:00Z",
  "questions": [
    { "questionId": "q_7f3a", "label": "참여 동기", "type": "TEXTAREA", "required": true, "options": [] }
  ],
  "seats": [
    { "channel": "ONLINE", "capacity": 100, "pending": 3, "confirmed": 41, "remaining": 56 },
    { "channel": "OFFLINE", "capacity": 40, "pending": 5, "confirmed": 35, "remaining": 0 }
  ],
  "canEdit": true,
  "canChangeConfirmation": true,
  "canSetFutureStart": true,
  "removableChannels": [],
  "createdAt": "2026-11-18T05:00:00Z",
  "updatedAt": "2026-11-21T08:12:00Z"
}
```

이 예시는 시작 전이고, 온라인(확인 대기 3 · 참가 확정 41)과 오프라인(확인 대기 5 · 참가 확정 35) 모두 유효 신청이 남아 있다. 그래서 `removableChannels` 는 `[]` 이고 어느 방식도 없앨 수 없다. 오프라인은 잔여석 0 이지만 온라인에 자리가 있어 `displayStatus` 는 `RECRUITING` 이다.

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| eventId | Long | N | | CLUB_EVENT.ID |
| version | Long | N | 행사 버전. 수정 요청에 그대로 보낸다 | CLUB_EVENT.VERSION |
| title | String | N | | CLUB_EVENT.TITLE |
| summary | String | N | 한 줄 소개 | CLUB_EVENT.SUMMARY |
| description | String | N | 모집 상세 | CLUB_EVENT.DESCRIPTION |
| timeZone | String | N | 행사 기준 IANA 시간대 | CLUB_EVENT.TIME_ZONE |
| startsAt | String | N | UTC | CLUB_EVENT.STARTS_AT |
| endsAt | String | Y | 미입력이면 null | CLUB_EVENT.ENDS_AT |
| effectiveEndsAt | String | N | 종료 판정 시각, UTC | 계산: `ClubEvent.effectiveEndsAt()` |
| deadlineAt | String | N | UTC | CLUB_EVENT.DEADLINE_AT |
| format | String | N | `ONLINE` · `OFFLINE` · `HYBRID` | 계산: 저장된 참여 방식 행의 조합 (CLUB_EVENT_CHANNEL) |
| offline | Object | Y | format 에 OFFLINE 이 없으면 null | CLUB_EVENT_CHANNEL (CHANNEL = OFFLINE) |
| offline.capacity | Integer | N | | CLUB_EVENT_CHANNEL.CAPACITY |
| offline.location | String | N | | CLUB_EVENT_CHANNEL.LOCATION |
| online | Object | Y | format 에 ONLINE 이 없으면 null | CLUB_EVENT_CHANNEL (CHANNEL = ONLINE) |
| online.capacity | Integer | N | | CLUB_EVENT_CHANNEL.CAPACITY |
| online.url | String | Y | 미입력이면 null | CLUB_EVENT_CHANNEL.ONLINE_URL |
| confirmation | String | N | `AUTO` · `REVIEW` | CLUB_EVENT.CONFIRMATION |
| status | String | N | 저장 상태 `PUBLISHED` · `CLOSED` · `CANCELLED` | CLUB_EVENT.STATUS |
| displayStatus | String | N | 표시 상태 | 계산: `ClubEvent.displayStatus(now, seatCounts)` |
| publishedAt | String | N | 공개 시각. 등록하면 바로 공개하므로 등록 시각과 같다 | CLUB_EVENT.PUBLISHED_AT |
| questions | Array | N | 현재 질문. 기존 신청의 질문 사본과 다를 수 있다 | CLUB_EVENT_QUESTION, SORT_ORDER 순 |
| questions[].questionId | String | N | 행사 안에서 안정적인 키 | CLUB_EVENT_QUESTION.QUESTION_KEY |
| questions[].label | String | N | | CLUB_EVENT_QUESTION.LABEL |
| questions[].type | String | N | `TEXT` · `TEXTAREA` · `RADIO` · `CHECKBOX` | CLUB_EVENT_QUESTION.TYPE |
| questions[].required | Boolean | N | | CLUB_EVENT_QUESTION.REQUIRED |
| questions[].options | String[] | N | TEXT·TEXTAREA 는 빈 배열 | CLUB_EVENT_QUESTION.OPTIONS (JSON) |
| seats | Array | N | 참여 방식마다 한 줄. ONLINE, OFFLINE 순 (§5) | — |
| seats[].channel | String | N | `ONLINE` · `OFFLINE` | CLUB_EVENT_CHANNEL.CHANNEL |
| seats[].capacity | Integer | N | | CLUB_EVENT_CHANNEL.CAPACITY |
| seats[].pending | Integer | N | 확인 대기 수 | 계산: 신청 방식·상태별 COUNT |
| seats[].confirmed | Integer | N | 참가 확정 수 | 계산: 같은 쿼리 |
| seats[].remaining | Integer | N | 잔여석 | 계산: `ClubEvent.seatsOf(channel, counts)` |
| canEdit | Boolean | N | 기본 정보·모집 설정·신청 질문을 저장할 수 있나 | 계산: `ClubEvent.canEdit(now)`. 취소 아님 ∧ `now < effectiveEndsAt` |
| canChangeConfirmation | Boolean | N | 확정 방식 변경 가능 | 계산: `ClubEvent.canChangeConfirmation(now)`. `canEdit` ∧ `now < STARTS_AT` |
| canSetFutureStart | Boolean | N | 시작 시각을 현재 이후로 정할 수 있나. 이미 시작한 행사면 false | 계산: `ClubEvent.canSetFutureStart(now)`. `canEdit` ∧ `now < STARTS_AT`. 지금은 `canChangeConfirmation` 과 식이 같지만 근거 규칙이 달라(§2·§3) 따로 둔다 |
| removableChannels | String[] | N | 지금 없앨 수 있는 참여 방식. 확인 대기·참가 확정 신청이 남은 방식은 빠진다. 단일 방식 행사는 그 방식을 없애면 방식이 0 개라 빈 배열이다 | 계산: `ClubEvent.removableChannels(counts)` |
| createdAt | String | N | | CLUB_EVENT.CREATED_AT |
| updatedAt | String | N | | CLUB_EVENT.UPDATED_AT |

- 모집 마감·재모집·행사 취소 가능 여부(`canClose` 등)도 화면에 필요하다. 이 판정 필드는 **상태 전환 스펙이 이 응답에 추가**한다. 지금 정하지 않는다
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
- **설명**: 편집 폼 전체를 한 번에 저장한다 (전체 교체). `STATUS` · `PUBLISHED_AT` 은 바꾸지 않는다 (상태 전환 API 의 일)

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters

없음

### Request Body

```json
{
  "version": 3,
  "title": "연말 네트워킹 밋업",
  "summary": "한 해를 마무리하며 크루끼리 만나요",
  "description": "행사 소개, 참가 조건, 추가 절차…",
  "timeZone": "Asia/Seoul",
  "startsAt": "2026-12-05T10:00:00Z",
  "endsAt": "2026-12-05T13:00:00Z",
  "deadlineAt": "2026-12-03T14:59:00Z",
  "format": "HYBRID",
  "offline": { "capacity": 40, "location": "서울 강남구 ○○빌딩 6층" },
  "online": { "capacity": 100, "url": "https://meet.example.com/abc" },
  "confirmation": "REVIEW",
  "questions": [
    { "questionId": "q_7f3a", "label": "참여 동기", "type": "TEXTAREA", "required": true, "options": [] },
    { "questionId": null, "label": "식이 제한", "type": "TEXT", "required": false, "options": [] }
  ]
}
```

필드 검증은 등록과 같다. 다른 점:

| 필드 | 등록 | 수정 |
|---|---|---|
| version | 없음 | **필수**. 운영 상세에서 받은 값. 없으면 400 |
| confirmation | 생략하면 `AUTO` | **필수**. 생략·null 이면 400. 기본값을 채우지 않는다 |
| questions | 생략하면 빈 배열 | **필수**. 생략·null 이면 400. 질문을 모두 지우려면 `[]` 를 보낸다 |
| questions[].questionId | null | 기존 질문이면 그 키, 새 질문이면 null. 요청에 없는 기존 질문은 삭제된다. 그 행사에 없는 키를 보내면 400 |
| deadlineAt | `> now` | `STATUS = PUBLISHED` 이고 마감 시각을 **바꿨을 때만** `> now`. 바꾸지 않았으면 지난 마감도 그대로 둔다 |

- `confirmation` · `questions` 를 필수로 받는 이유 (PR #470 리뷰): 등록 기본값이 수정에도 적용되면, 제목만 고치려던 요청에서 `REVIEW → AUTO` 로 읽혀 확인 대기자가 자동 확정되거나 질문이 모두 지워진다
- 그 밖의 필드도 전체 교체다. `endsAt` · `online.url` 은 null 이 「비움」이라 생략과 null 을 같게 보고 비운다. 화면은 운영 상세 값으로 폼을 채워 **모든 필드를 보낸다**

### 처리 순서

인가(401·403)와 필드 검증(400)을 통과한 뒤, 한 트랜잭션에서 아래 순서로 처리한다. 먼저 걸리는 것 하나만 응답한다.

| # | 단계 | 실패 | 근거 |
|---|---|---|---|
| 1 | `CLUB_EVENT` 행을 쓰기 잠금으로 읽는다 (트랜잭션의 첫 조회). 없으면 | 404 `NOT_FOUND` | 「같은 행사에 쓰는 요청의 처리 순서」 |
| 2 | 저장된 `STATUS = CANCELLED` | 409 `EVENT_CANCELLED` | §2 「취소된 행사는 조회 전용」 |
| 3 | 저장된 값으로 `now ≥ effectiveEndsAt` (종료) | 409 `EVENT_ENDED` | §2 「종료된 행사는 조회 전용」, Q9 |
| 4 | 요청 `version` ≠ 저장된 `VERSION` | 409 `EVENT_VERSION_CONFLICT` | Q14 |
| 5 | `questionId` 가 이 행사에 없는 키 | 400 `INVALID_INPUT` (`questions[i].questionId`) | — |
| 6 | 이미 시작한 행사(`now ≥ 저장된 STARTS_AT`)인데 새 `startsAt > now` | 409 `EVENT_START_LOCKED` | §2 「이미 시작한 행사는 시작 시각을 미래로 옮길 수 없음」, 프로토 `validateEvent` |
| 7 | 확정 방식을 바꾸는데 `now ≥ 저장된 STARTS_AT` 또는 `now ≥ 새 startsAt` | 409 `EVENT_ALREADY_STARTED` | §3 「행사 시작 전까지만」, 프로토 `validateEvent` |
| 8 | 확인 대기·참가 확정 신청이 남은 참여 방식을 없앤다 (예: HYBRID → ONLINE 인데 오프라인 유효 신청 있음) | 409 `CHANNEL_IN_USE` | §3 「신청자가 있는 방식을 제거하는 변경만 제한」 |
| 9 | 방식별 새 정원 < 그 방식의 확인 대기 + 참가 확정 | 409 `CAPACITY_BELOW_OCCUPIED` | §3 「확인 대기와 참가 확정 합보다 작게 변경 제한」, Q8 |
| 10 | 저장 상태가 `PUBLISHED` 이고 마감 시각을 바꿨는데 새 마감 `≤ now` | 400 `INVALID_INPUT` (`deadlineAt`) | §2 「재모집 시 미래 마감」, 프로토 `validateEvent` |
| 11 | 값을 저장한다. 질문은 전체 교체 | — | — |
| 12 | `REVIEW → AUTO` 면 그 행사의 `PENDING` 신청을 `CONFIRMED` 로 바꾸고 바꾼 신청 ID 를 모은다 | — | 「확정 방식 전환」 |
| 13 | `VERSION` 을 1 올린다 | — | Q14 |
| 14 | 커밋. 12 에서 바꾼 신청이 있으면 커밋 뒤 `ClubEventRegistrationsConfirmedEvent` 구독자가 확정 메일을 만든다 | — | [domain-events](../domain-events/spec.md) |

- 8·9 의 신청 수는 1 의 잠금을 얻은 뒤 센다. 신청 스펙도 같은 잠금을 먼저 잡으므로 신청과 정원 축소·확정 방식 전환·방식 제거가 한 줄로 선다 (Q8)
- 시작 후·종료 전 행사도 6·7 을 빼면 같은 규칙으로 고칠 수 있다 (Q9)
- 질문을 고쳐도 기존 신청의 질문·답변 사본은 그대로다 (위 「신청 질문의 보존」)
- 일정·장소·링크가 바뀌어도 자동 알림은 없다 (Q10, 위 「정보 변경 안내」)
- 정원을 늘려 잔여석이 생기면 표시 상태가 `FULL` 에서 `RECRUITING` 으로 돌아간다 (Q11, 위 「상태」)

### Response — 200

본문은 운영 상세와 같다 (저장 후 값, 올라간 `version`).

### Error Responses

| 상태 | errorCode | 조건 | 화면 안내 (Q12) |
|------|-----------|------|------|
| 400 | INVALID_INPUT | 등록과 같은 필드 검증 · `version`·`confirmation`·`questions` 누락 · 없는 `questionId` · 위 10번. 실패한 필드 이름을 `errorMessage` 에 담는다 | 해당 입력란 표시 |
| 401 | UNAUTHORIZED | 토큰 없음 | |
| 403 | FORBIDDEN | ADMIN 아님 | |
| 404 | NOT_FOUND | eventId 없음 | |
| 409 | EVENT_CANCELLED | 취소된 행사 | 조회 전용으로 다시 그린다 |
| 409 | EVENT_ENDED | 종료된 행사 | 조회 전용으로 다시 그린다 |
| 409 | EVENT_VERSION_CONFLICT | 다른 캡틴이 먼저 저장했다 | 입력값 유지, 최신 정보 다시 불러오기 |
| 409 | EVENT_START_LOCKED | 시작한 행사의 시작 시각을 현재 이후로 옮김 | 시작 시각 입력란 |
| 409 | EVENT_ALREADY_STARTED | 시작 후 확정 방식 변경 | 확정 방식 입력란 |
| 409 | CHANNEL_IN_USE | 유효 신청이 남은 참여 방식 제거 | 참여 방식 입력란, 기존 신청을 먼저 정리하라는 안내 |
| 409 | CAPACITY_BELOW_OCCUPIED | 정원 < 확인 대기 + 참가 확정 | 정원 입력란 |

- 409 세부 코드는 모두 새 `ErrorCode` 다 (Q12 결정: 실패 원인별 코드). 레포의 다른 409(`MEETING_ALREADY_STARTED` · `STUDY_ENDED` 등)처럼 원인마다 하나씩 둔다
- 어느 실패든 화면은 **입력값을 그대로 둔 채** 이유와 다음 행동을 안내한다 (Q12). 서버는 실패하면 아무것도 바꾸지 않는다

### 프론트엔드 사용처

- back-office-front 행사 상세 「행사 정보」 탭 (아직 없음)
- 근거 시안: `frontend/apps/playground/src/proto/events/EventEditor.tsx` (편집 모드) · `model.ts` `validateEvent` · `transition` SAVE

---

## 데이터 모델 제안

ERD 문서가 없어 소스 칸은 아래 제안 이름을 쓴다. 확정은 ERD PR 에서 한다. 행사는 애그리거트 루트 `ClubEvent`, 참여 방식·질문은 그 안의 엔티티, 신청은 별도 애그리거트(ID 참조)를 제안한다.

이름 (Q13 결정): Java 클래스는 `ClubEvent`, 테이블은 `CLUB_EVENT`. 도메인 이벤트(`*Event` 접미사, `com.studyclub.common.event`)와 헷갈리지 않게 한다. 하위 테이블은 같은 접두어를 쓴다 (제안). API 경로(`/api/admin/events`)와 응답 필드(`eventId`)는 화면 용어라 그대로 둔다.

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| CLUB_EVENT | ID · TITLE(VARCHAR 60) · SUMMARY(VARCHAR 120) · DESCRIPTION(TEXT, 5,000자 검증) · TIME_ZONE(VARCHAR 64) · STARTS_AT · ENDS_AT(NULL) · DEADLINE_AT · CONFIRMATION · STATUS(`PUBLISHED`/`CLOSED`/`CANCELLED`) · PUBLISHED_AT · VERSION(BIGINT) · CREATED_BY · CREATED_AT · UPDATED_AT | 시각은 UTC. `INDEX(STARTS_AT, ID)` 는 목록 정렬용 |
| CLUB_EVENT_CHANNEL | ID · CLUB_EVENT_ID(FK) · CHANNEL(`ONLINE`/`OFFLINE`) · CAPACITY · LOCATION(VARCHAR 300, NULL) · ONLINE_URL(VARCHAR 2048, NULL) | `UNIQUE(CLUB_EVENT_ID, CHANNEL)`. format 은 행 조합으로 정한다 |
| CLUB_EVENT_QUESTION | ID · CLUB_EVENT_ID(FK) · QUESTION_KEY · LABEL(VARCHAR 200) · TYPE · REQUIRED · OPTIONS(JSON) · SORT_ORDER | `UNIQUE(CLUB_EVENT_ID, QUESTION_KEY)`. 신청이 FK 로 물지 않는다 |
| (신청 테이블) | 신청 스펙에서 정한다 | 이 스펙은 방식·상태별 COUNT 만 읽고, 확정 방식 전환 때 `PENDING → CONFIRMED` 만 쓴다. `INDEX(CLUB_EVENT_ID, CHANNEL, STATUS)` 필요 |

- `VERSION` 은 화면이 보낸 값과 잠금 뒤 비교하고 저장마다 1 올린다. JPA `@Version` 을 쓰더라도 비교는 요청 값과 해야 한다 (엔티티를 새로 읽으면 요청 값이 아니라 방금 읽은 값과 비교된다)
- `DRAFT` 상태 값은 두지 않는다 (Q1·Q2)

## 퍼널·계측

해당 없음. 캡틴의 운영 기능이라 퍼널 단계를 바꾸지 않고, 추가·변경하는 분석 이벤트가 없다. 등록 즉시 공개로 바뀌어도 크루 쪽 행사 화면의 기존 계측(`events_list` · `event_detail` 페이지 이름, `Event Card Clicked`)은 그대로다. 크루의 행사 신청은 확정되는 사건이라 서버 이벤트가 필요한지 신청 스펙에서 정한다.

## 근거와 PRD·코드의 차이

| 항목 | 레포 PRD·프로토 (PR #471 반영) | 이 스펙 |
|---|---|---|
| 서머타임 | §2 「사라진 시각은 다른 시각 선택 안내, 중복 시각은 전·후 선택」. 프로토 `resolveEventInput` | 화면이 정한 UTC 를 받는다. 서버는 순서·현재 시각만 검증 (Q4) |
| 시간대 선택지 | 프로토 `ZONES`: 서울·토론토·뉴욕·LA | 같다 (Q5). POL-0006 회원 시간대(밴쿠버 포함)와는 R1 에서 맞춘다 |
| 질문 타입 `SELECT` | 프로토 타입에 남아 있음. PRD 는 「제공 안 함, 단일 선택으로 전환」 | API 는 받지 않음 |
| 등록 중복 제출 | 프로토 CREATE 는 같은 행사 ID 로 두 번 저장하면 막는다 | 서버 멱등 키 없음. 아래 「남은 확인 사항」 N1 |
| 종료 시 확인 대기 처리 | §6 「행사 종료 시 남은 확인 대기 신청은 참가 불가로 전환」. 프로토 `settleEndedRegistrations` | 참가자 스펙의 일. 이 스펙의 `seats[].pending` 은 그 전환 뒤 값을 센다 |
| back-office-front 폼 | `features/events/form-schema.ts` 는 시안 이전 필드 | 연결할 때 이 스펙으로 바꾼다 |
| back-office-front TODO | `POST/GET/PATCH/DELETE /api/events` | 경로는 `/api/admin/events`, 수정은 PUT, DELETE 없음 |

## 결정 기록 (PR #470 리뷰, 2026-11-16)

| Q | 결정 | 반영한 곳 |
|---|---|---|
| Q1·Q2 | 초안 기능 삭제. 필수 항목을 입력하고 저장하면 바로 공개. 초안 저장·삭제는 범위 밖 | 엔드포인트 목록, 「상태」, 「초안·삭제·공개 취소」, 「행사 등록」, 데이터 모델 |
| Q3 | 행사 취소 > 종료 > 모집 마감 > 정원 마감 > 모집 중. 시작 후 종료 전은 모집 마감. 종료 미입력은 행사 시간대 시작일이 지나면 종료 | 「상태」 표시 상태 표 |
| Q4 | 스터디 일정과 같게 화면이 서머타임을 처리하고 UTC 로 보낸다 | 「시각과 시간대」 |
| Q5 | 서울·토론토·뉴욕·LA. R1 공통 확장 때 행사에도 적용 | 「시각과 시간대」, 등록 `timeZone` |
| Q6 | 시작 시각 내림차순, 페이지당 20개, 검색·필터 제외 | 「운영 행사 목록」 |
| Q7 | 행사명 60 · 한 줄 소개 120 · 모집 상세 5,000 · 장소 300 · 질문 제목 200 · 선택지 100자, 객관식 선택지 2~10개, 질문 최대 20개. 화면·서버 같은 기준 | 등록 필드 표, 데이터 모델 |
| Q8 | 같은 행사의 신청과 정원 변경은 하나씩 처리하고 나중 요청은 먼저 반영된 결과로 다시 검증 | 「같은 행사에 쓰는 요청의 처리 순서」, 수정 처리 순서 1·9 |
| Q9 | 시작 후에도 종료 전까지 수정 가능. 확정 방식은 시작 전까지만. 종료·취소 행사는 조회만 | 「수정할 수 있는 범위」, 수정 처리 순서 2·3·6·7, `canEdit` 등 |
| Q10 | 정보 변경 안내는 캡틴이 `안내 메일 보내기`로 직접 | 「정보 변경 안내」 |
| Q11 | 자리가 생기면 시작 전 · 마감 전 · 수동 마감 아님일 때 자동으로 모집 중 | 「상태」 |
| Q12 | 원인별 오류 코드. 종료 행사와 동시 수정 충돌도 구분. 화면은 입력값 유지 | 수정 Error Responses |
| Q13 | `ClubEvent` / `CLUB_EVENT` | 데이터 모델, 판정 메서드 이름 |
| Q14 | 상세의 버전을 저장 요청에 보내고 서버가 비교. 다르면 막고 화면은 입력 유지 + 최신 정보 다시 불러오기 | 「동시 수정 방지: 버전」, 수정 처리 순서 4·13 |

개별 리뷰 세 건:

| 리뷰 | 반영한 곳 |
|---|---|
| 수정에서 `confirmation` · `questions` 생략 시 처리 | 수정 Request Body 표: 필수, 누락 시 400 |
| 확정 방식 전환과 새 신청이 겹칠 때 순서 | 「같은 행사에 쓰는 요청의 처리 순서」 두 번째 줄, 「확정 방식 전환」 |
| 상세 예시 `removableChannels` | 운영 상세 예시를 `[]` 로 고치고 이유를 예시 아래에 적음 |

## 남은 확인 사항

리뷰 결정에 없고, PR #471 과 대조하다 새로 나온 것이다. 정하기 전까지 이 스펙은 적힌 기본 동작을 따른다.

- [NEEDS CLARIFICATION] N1 등록 중복 제출: 등록하면 바로 공개되므로 저장 버튼을 두 번 누르면 같은 행사가 둘 공개된다. 화면이 저장 중 버튼을 막는 것으로 충분한지, 서버에 멱등 키(`Idempotency-Key` 헤더 등)를 둘지. 지금은 서버에서 막지 않는다
- [NEEDS CLARIFICATION] N2 진행 중 행사에서 종료 시각을 현재보다 이른 시각으로 저장하는 경우: 저장 즉시 종료가 되고, 참가자 스펙의 종료 처리로 남은 확인 대기 신청이 참가 불가가 된다. 프로토는 막지 않는다. 이 스펙도 지금은 막지 않는다
- [NEEDS CLARIFICATION] N3 상태 전환(모집 마감·재모집·행사 취소)이 `version` 을 올리는지. 제안은 올린다. 그러면 다른 캡틴이 모집을 마감한 뒤의 저장도 409 `EVENT_VERSION_CONFLICT` 로 막힌다. 상태 전환 스펙에서 확정
