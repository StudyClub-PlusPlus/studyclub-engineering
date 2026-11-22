# event 구현 계획

> Spec: [spec.md](./spec.md) | 날짜: 2026-11-17 | 기준: `beta` @ `23b4615e`
>
> **BE PR 하나 → FE PR 하나**로 나눈다. 이 계획의 BE PR 은 등록·수정·조회 API 가 신청 스펙(crew-apply-event)과 **독립적으로** 돌게 만든다. 신청 수와 `REVIEW → AUTO` 일괄 확정은 포트(`ClubEventRegistrationPort`) 뒤로 빼고, 지금은 임시 어댑터(0건 · no-op)가 답한다.

## 대상 엔드포인트

spec.md 의 엔드포인트 전부다.

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/events` | 운영 목록 — `STARTS_AT DESC, ID DESC`, offset·limit |
| POST | `/api/admin/events` | 등록 = 바로 공개. `Idempotency-Key` 필수 |
| GET | `/api/admin/events/{eventId}` | 운영 상세 — 폼 값 + 방식별 모집 현황 + `can*` + 버전 |
| PUT | `/api/admin/events/{eventId}` | 수정 — 전체 교체, 처리 순서 1~15 |

## 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 컨트롤러 | 새 `AdminClubEventController` (`com.studyclub.api.event`), 클래스에 `@RequireAdmin` · `@SecurityRequirement(bearerAuth)` · `@RequestMapping("/api/admin/events")` | endpoint-convention — 관객별 컨트롤러 · `Admin*` 이름. 인가가 존재 여부보다 먼저(인터셉터가 본문 해석 전에 403) |
| 애그리거트 | `ClubEvent`(루트) + `ClubEventChannel` · `ClubEventQuestion`(`@OneToMany` cascade · orphanRemoval). 저장소는 루트 하나 | 스펙 데이터 모델. 참여 방식·질문은 행사와 한 트랜잭션에서 함께 바뀐다 |
| 판정 위치 | `effectiveEndsAt` · `displayStatus` · `seatsOf`/`seats` · `canEdit` · `canChangeConfirmation` · `canSetFutureStart` · `removableChannels` · `format` 을 전부 `ClubEvent` 메서드로 | 판정은 엔티티 하나 (AGENT.md). 이후 사이트용·신청 API 가 같은 메서드에 같은 쿼리로 센 재료를 넘긴다 |
| 수정 규칙 | `ClubEvent.edit(draft, expectedVersion, now, counts)` 가 처리 순서 2~12 · 14 를 순서대로 보고 먼저 걸린 하나만 던진다. 13 은 서비스가 포트로 | 순서가 한 메서드에 있어 단위 테스트가 순서를 못 박는다. 13 은 신청 애그리거트의 일 |
| 입력값 | 도메인 `EventDraft`(+ `ChannelDraft` · `QuestionDraft`) 값 객체가 만들어질 때 trim · 글자 수(UTF-16) · 시간대 4종 · 정원 · 선택지 · 시각 순서를 본다. api `ClubEventRequestMapper` 는 모양(필수 값 · enum 이름 · 시각 형식 · `format` ↔ `online`/`offline` 객체 · 등록/수정 기본값 차이)만 | 값의 규칙은 값 객체에(ddd-guide). 실패 메시지는 언제나 `필드: 이유` 모양 |
| 요청 DTO | enum · 시각을 `String` 으로 받는다 (`AdminClubEventRequest`, 등록·수정 공용, 수정에만 `version`) | Jackson 변환 실패는 필드 이름 없는 400 이 된다. 스펙은 실패 필드 이름(`questions[0].type` 등)을 요구한다 |
| 시각 | `EventDraft` 가 분 단위로 자른다 | 스펙 「초 단위 이하를 0」 제안. 「마감을 바꿨나」 비교가 흔들리지 않게 |
| 버전 | `VERSION` 은 평범한 `Long` 컬럼. `edit` 가 `Objects.equals(version, expectedVersion)` 로 비교하고 성공 시 `+1` | 스펙 Q14 — 비교 대상이 요청 값이다. `@Version` 은 방금 읽은 값과 비교한다 |
| 잠금 | `ClubEventRepository.findByIdForUpdate` (`@Lock(PESSIMISTIC_WRITE)`, 하위 행 조인 없음)를 `PUT` 트랜잭션의 첫 조회로. 신청 수는 그 뒤에 포트로 센다 | 「같은 행사에 쓰는 요청의 처리 순서」. 필드 검증(400)은 트랜잭션 첫 조회 전에 끝낸다 |
| 멱등 등록 | `Idempotency-Key` UUID v4 를 엄격 정규식으로 보고 소문자로 저장. `TransactionTemplate` 안에서 같은 키를 먼저 찾고, 없으면 `saveAndFlush`. 유일성 위반(`DataIntegrityViolationException`)은 롤백된 트랜잭션 밖에서 새 읽기 트랜잭션으로 이긴 행을 읽어 같은 201 응답 | 스펙 N1. 헤더·본문 검증 400 은 트랜잭션 전이라 키가 남지 않는다 |
| 목록 쿼리 | 저장소 조각 `ClubEventPageQuery.findPageIds(offset, limit)` (JPQL `ORDER BY startsAt DESC, id DESC`) → `findAllWithChannelsByIdIn` 조인 페치 → 포트 `countActiveSeatsByEventIds` 한 번 | 오프셋이 limit 배수가 아니어도 된다. 컬렉션 페치 + 페이징을 한 쿼리로 하면 Hibernate 가 메모리에서 자른다 |
| `OPTIONS` 컬럼 | `List<String>` + `@JdbcTypeCode(SqlTypes.JSON)`, 마이그레이션은 `JSON NOT NULL` | `Notification.PAYLOAD` 와 같은 방식 — Hibernate 7 이 Jackson 3 으로 직렬화하고 MySQL `validate` 를 통과한다 |
| 제약 선언 | 마이그레이션의 유일 제약·인덱스를 엔티티 `@Table` 에도 같은 이름으로 선언 | 테스트(H2, `create-drop`)와 stage(Hibernate `update`)는 엔티티로 스키마를 만든다. 선언이 없으면 멱등 등록의 유일성 보장이 그 환경에서 사라진다 |
| 에러 코드 | `EVENT_CANCELLED` · `EVENT_ENDED` · `EVENT_VERSION_CONFLICT` · `EVENT_START_LOCKED` · `EVENT_ALREADY_STARTED` · `CHANNEL_IN_USE` · `CAPACITY_BELOW_OCCUPIED` (모두 409, `CONFLICT` 뒤) | 스펙 Q12 — 원인별 코드. `fromStatus(409)` 는 첫 409 인 `CONFLICT` 를 그대로 쓴다 |
| 도메인 이벤트 | `ClubEventRegistrationsConfirmedEvent` (`club_event.registrations_confirmed`) — `REVIEW → AUTO` 이고 포트가 바꾼 신청 ID 가 하나 이상일 때만 트랜잭션 안에서 발행 | 스펙 「확정 방식 전환」, domain-events 형식. 구독자는 아직 없다(아래 연동 지점) |

## 포트와 임시 어댑터 — 팀원 PR 연동 지점

```
domain  ClubEventRegistrationPort          ← 이 PR
          countActiveSeatsByEventIds(ids)    목록: 페이지 행사 ID 묶음에 GROUP BY 한 번
          countActiveSeats(eventId)          상세 · PUT(잠금 뒤)
          confirmPendingRegistrations(id)    PUT 13: PENDING → CONFIRMED, 바꾼 신청 ID
api     EmptyClubEventRegistrationAdapter  ← 이 PR, @Component, 0건 · 빈 목록
```

신청 스펙 구현 PR 이 할 일:

1. 신청 테이블을 읽는 실제 어댑터를 만든다 — 방식·상태별 `COUNT … GROUP BY CHANNEL, STATUS`, 일괄 확정은 `WHERE STATUS = 'PENDING'` 조건부 갱신 후 바꾼 ID. 그리고 `EmptyClubEventRegistrationAdapter` 를 지운다 (빈이 둘이면 부팅이 실패해 잊을 수 없다)
2. 크루 신청 제출도 `ClubEventRepository.findByIdForUpdate` 를 첫 조회로 쓰고, `ClubEvent.displayStatus` · `seatsOf` 로 판단한다
3. 메일 스펙이 `ClubEventRegistrationsConfirmedEvent` 의 `BEFORE_COMMIT` 구독자를 붙인다 — 신청마다 확정 안내 `NOTIFICATION` 행, 실패는 삼키지 않고 롤백 (`AdminClubEventService.update` 의 `TODO(event-mail)`)

통합 테스트는 `@MockitoBean ClubEventRegistrationPort` 로 수를 정해 `CHANNEL_IN_USE` · `CAPACITY_BELOW_OCCUPIED` · `removableChannels` · 일괄 확정 이벤트를 검증한다.

## 애그리거트 매핑

[ddd-guide.md](../../docs/backend-development-guide/ddd-guide.md) 기준.

- **ClubEvent** (루트) → `ClubEventRepository` — `CLUB_EVENT` 전 컬럼, 판정 메서드 전부
  - `ClubEventChannel` → `offline` · `online` · `seats[].capacity` · `format`
  - `ClubEventQuestion` → `questions[]` (`questionId` = `QUESTION_KEY`)
- **Account** → `CREATED_BY` ID 참조 (FK 없음). 응답에 작성자를 싣지 않는다
- **신청** (신청 스펙) → `ClubEventRegistrationPort` 뒤. `seats[].pending` · `confirmed` · `remaining`, `displayStatus` 의 `FULL`, `removableChannels`, PUT 8·9·13 의 재료

## 구현 순서

1. common — `ErrorCode` 7개
2. domain — enum 6종, `EventSeatCounts` · `ChannelSeats`, `EventDraft` · `ChannelDraft` · `QuestionDraft` · `EventLimits`, `ClubEvent` · `ClubEventChannel` · `ClubEventQuestion`, `ClubEventRepository`(+ 페이지 조각), `ClubEventRegistrationPort`, `ClubEventRegistrationsConfirmedEvent`
3. domain — 단위 테스트 `ClubEventTest` (서머타임 전환일 자정 경계 포함)
4. 마이그레이션 `V59__create_club_event.sql`
5. api — 요청·응답 DTO, `ClubEventRequestMapper`, `IdempotencyKeys`, `AdminClubEventService`, `AdminClubEventController`, `EmptyClubEventRegistrationAdapter`
6. api — 통합 테스트 `AdminClubEventIntegrationTest`
7. 문서 — ERD 3개 + README, `.prober/map/concepts.json`, 스펙·PRD 상태 `구현중`, domain-events 표

## PR 나누기

| PR | 담는 것 | 머지 순서 |
|---|---|---|
| BE (이 계획) | 엔드포인트 4개, 애그리거트 · V59 · ERD, 포트 + 임시 어댑터, 에러 코드, 도메인 이벤트 | 먼저 |
| FE | back-office-front `/events` 「준비 중」 화면을 실제 목록·등록·상세·수정으로. `features/events/form-schema.ts` 를 스펙 필드로, `TODO(api)` 경로를 `/api/admin/events` 로. 409 코드별 안내와 입력 유지 · `EVENT_VERSION_CONFLICT` 시 다시 불러오기 · `Idempotency-Key` 를 제출 시도마다 생성 | BE 다음 |
| 신청 (팀원) | 신청 테이블 · 실제 어댑터 · 임시 어댑터 삭제 · 확정 메일 구독자 | 독립. 머지되면 스펙 상태를 `구현완료` 로 |

## 의존성

- **ERD 변경**: 있음 — `CLUB_EVENT` · `CLUB_EVENT_CHANNEL` · `CLUB_EVENT_QUESTION` (V59)
- **SecurityConfig**: 변경 없음 — `/api/admin` 은 기본 `authenticated()`, 캡틴 판정은 `@RequireAdmin`
- **다른 스펙**: 신청(crew-apply-event) · 참가자 · 상태 전환 · 메일 스펙이 이 스펙의 잠금 순서·판정 메서드·버전 규칙을 그대로 쓴다. 상태 전환 스펙은 `STATUS` 가 실제로 바뀔 때 `VERSION + 1` (N3) 과 `canClose` 등 판정 필드 추가를 맡는다

## 리스크

- **H2 와 MySQL 의 차이** — 통합 테스트는 엔티티로 만든 H2 스키마에서 돈다. 마이그레이션 SQL 과 `validate` 는 `backend-migration-check` CI(빈 MySQL 8)가 증명한다. 로컬에서는 MySQL 을 띄우지 않았다
- **잠금 범위** — `findByIdForUpdate` 는 하위 행을 조인하지 않아 행사 한 행만 잠근다. 같은 트랜잭션의 lazy 로딩은 잠금 없는 일반 조회라 하위 행은 행사 행 잠금이 지킨다(모든 쓰기 경로가 같은 행사 행을 먼저 잠그는 규칙)
- **멱등 경합** — MySQL 은 커밋 전인 같은 유일 키 삽입을 기다렸다가 상대가 커밋하면 중복 오류를 낸다. 그 뒤 새 읽기 트랜잭션은 이긴 행을 본다. 상대가 롤백하면 이쪽 삽입이 성공한다
- **임시 어댑터가 운영에 나간다** — 신청 기능 전까지 모든 행사의 신청 수가 0 이다. 신청 API 가 없으니 실제 값도 0 이라 화면이 틀리지 않는다
- **시간 의존 테스트** — 서버 시각(`Instant.now()`)으로 판정한다. 통합 테스트는 현재 시각 기준 몇 분~며칠의 여유를 두고 시각을 만든다
