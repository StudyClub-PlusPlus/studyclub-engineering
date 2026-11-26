# event-status 구현 계획

> Spec: [spec.md](./spec.md) | 날짜: 2026-11-25 | 기준: `beta` @ `5beb94e2` (PR #516 · #517 병합 뒤)
>
> **BE PR 하나**로 낸다. back-office-front 의 상태 전환 버튼 · 취소 확인창 · 취소 안내 작성 창 연결은 팀원 FE PR #528 이 따로 진행 중이라 이 계획의 범위가 아니다. 이 PR 은 #528 이 기대하는 응답 모양(판정 필드 여섯 개 · `PATCH …/status`)을 스펙대로 맞추는 데까지다.

## 대상 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| PATCH | `/api/admin/events/{eventId}/status` | 모집 마감 · 재모집 · 행사 취소. 처리 순서 1~12 |
| GET · POST · PUT | `/api/admin/events` · `/api/admin/events/{eventId}` | 기존 응답(`AdminClubEventDetailResponse`)에 판정 필드 여섯 개를 더한다. 경로 · 다른 필드는 그대로 |

운영 목록(`GET /api/admin/events`)에는 판정 필드를 넣지 않는다.

## 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 컨트롤러 | 새 `AdminClubEventStatusController` (`com.studyclub.api.event`), `@RequireAdmin` · `@SecurityRequirement(bearerAuth)` · `@RequestMapping("/api/admin/events")` + `@PatchMapping("/{eventId}/status")` | 스펙 「경로를 이렇게 정한 이유」. 기존 `AdminClubEventController` 와 같은 클래스 수준 인가 |
| 서비스 | `AdminClubEventService` 에 `changeStatus(eventId, request, actorId)` 를 더한다. 트랜잭션 하나 | 상세 응답 조립(`AdminClubEventDetailResponse.of`)과 잠금 · 포트 사용이 이미 이 서비스에 있다. 새 서비스로 떼면 응답 조립이 두 곳이 된다 |
| 요청 DTO | `AdminClubEventStatusRequest(String status, Long version)` — enum 을 `String` 으로 받아 매퍼가 `CLOSED` · `PUBLISHED` · `CANCELLED` 로 바꾼다 | 기존 `AdminClubEventRequest` 와 같은 이유: Jackson 변환 실패는 필드 이름 없는 400 이 된다 |
| 판정 메서드 | `ClubEvent.canClose(now)` · `canReopen(now)` · `reopenBlockedReason(now)` · `canCancel(now)` 를 엔티티에. 새 enum `EventReopenBlockedReason { STARTED, DEADLINE_PASSED }` | AGENT.md 「판정은 엔티티 메서드 하나」. 처리 순서 6·7 과 `reopenBlockedReason` 이 같은 순서(시작 먼저)를 써야 해서 한 곳에 둔다 |
| 전환 규칙 | `ClubEvent.changeStatus(EventStatus target, Long expectedVersion, Instant now)` 가 처리 순서 2~7 · 9 를 순서대로 보고 먼저 걸린 하나만 던진다. 반환값 `boolean`(실제로 바뀌었나) | 기존 `edit(...)` 와 같은 구조. 단위 테스트가 순서(특히 4 가 5 보다 먼저, 6 이 7 보다 먼저)를 못 박는다 |
| 버전 | 상태가 실제로 바뀔 때만 `version + 1`. 같은 상태 요청(처리 순서 4)은 버전 비교 전에 `false` 로 돌아간다 | S1 · event N3 |
| 409 문구 | 기존 `EVENT_CANCELLED` · `EVENT_ENDED` · `EVENT_VERSION_CONFLICT` · `EVENT_ALREADY_STARTED` 를 쓰고 `BusinessException(code, "취소된 행사는 모집 상태를 변경할 수 없습니다.")` 처럼 상황 문구를 넘긴다. 새 코드는 `EVENT_REOPEN_DEADLINE_PASSED` 하나 | 스펙 「Error Responses」. 기본 문구가 수정 기준이라 그대로 쓰면 안내가 틀린다 |
| 잠금 | `ClubEventRepository.findByIdForUpdate` 를 트랜잭션 첫 조회로. `ACCOUNT` 는 잠그지 않는다 | event 「같은 행사에 쓰는 요청의 처리 순서」. 탈퇴(`ACCOUNT` → `CLUB_EVENT`)와 교착이 없다 |
| 신청 일괄 취소 | `ClubEventRegistrationPort.cancelActiveRegistrationsForEventCancellation(eventId, actorAccountId)` 신규. 어댑터는 유효 신청 ID 를 읽고 `ClubEventRegistrationRepository` 의 새 조건부 갱신 `cancelForEvent(ids, active, CANCELLED, EVENT_CANCELLED, actor, now)` 로 바꾼 뒤 그 ID 를 돌려준다 | 기존 `confirmPendingRegistrations` 와 같은 모양. 벌크 갱신은 `@LastModifiedDate` 를 거치지 않아 `UPDATED_AT` 을 직접 채운다(저장소 주석 규칙) |
| 안내 대상 수 | `ClubEventRegistrationPort.countCancellationRecipients(eventId)` 신규. JPQL 한 번: `count(r) where r.clubEventId = :id and (r.status in (PENDING, CONFIRMED) or r.cancelReason = EVENT_CANCELLED) and exists (select a.id from Account a where a.id = r.accountId)` | 스펙 판정 필드 표 — 한 조건이 취소 전 · 후 두 뜻을 나눈다. 계정 대조를 쿼리 안에서 해 ID 묶음을 메모리로 옮기지 않는다 |
| 응답 조립 | `AdminClubEventDetailResponse.of(event, now, counts, cancellationRecipientCount)` 로 인자를 하나 더한다. 상세 · 등록 · 수정 · 상태 전환이 모두 이 팩터리를 지난다 | 같은 판정을 쓰는 응답이 같은 재료를 받는다. 등록 직후는 신청이 없어 0 이지만 같은 경로로 센다 |
| 감사 기록 | `AdminAuditAction.EVENT_CANCEL` · `AdminAuditLog.eventCancel(actorId, clubEventId, EventStatus before, int cancelledCount)` 팩터리 · `RetentionPolicy.AUDIT_EVENT_CANCEL_V1(3)`. `AdminAuditLog.policyFor` 의 `switch` 에 `EVENT_CANCEL -> AUDIT_EVENT_CANCEL_V1` 을 더한다. 저장은 기존 `AdminAuditRecorder.record` (`Propagation.MANDATORY`, 실패를 삼키지 않음) | S4. `switch` 가 모든 값을 다뤄야 컴파일되므로 빠뜨릴 수 없다 |
| 도메인 이벤트 | 새 `ClubEventCancelledEvent(EventMeta meta, Long clubEventId, List<Long> cancelledRegistrationIds)` (`club_event.cancelled`, `com.studyclub.domain.event`). 실제로 취소로 바뀐 요청마다 트랜잭션 안에서 발행 | 스펙 「도메인 이벤트」. `ClubEventRegistrationsCancelledEvent` 는 내지 않는다 — 자동 취소 메일 구독자(event-mail)가 붙는 이벤트라 S2 를 어긴다 |
| `Cause.EVENT_CANCELLED` 정리 | `beta` 의 `ClubEventRegistrationsCancelledEvent.Cause.EVENT_CANCELLED` 를 지운다. 쓰는 곳이 없다(발행 경로가 본인 취소 `SELF` 하나) | 스펙 「`beta` 코드와의 차이」. 남겨 두면 event-mail 구독자가 이 값을 메일로 만들지 말아야 한다는 분기를 따로 들고 있어야 한다 |
| 분석 | `AnalyticsEventListener` 에 `onClubEventCancelled(ClubEventCancelledEvent)` (`@Async` · `AFTER_COMMIT` · `fallbackExecution = true`). 신청마다 `Event Registration Cancelled`, `cancel_type = event_cancelled`, `insert_id = event_registration_cancelled_{registrationId}`. 기존 `onEventRegistrationsCancelled` 와 본문이 같아 `sendRegistrationCancelled(registrationIds, clubEventId, cancelType, meta)` 사설 메서드로 묶는다 | 스펙 「퍼널·계측」. 트래킹 플랜 줄 · 이름 · 속성이 이미 있어(PR #517) 속성은 늘지 않는다 |
| 메일 | 만들지 않는다. 이 트랜잭션에는 `BEFORE_COMMIT` 구독자가 없다 | S2. 취소 안내는 event-mail 의 운영자 발송 |

## 마이그레이션

계획 당시 `beta` 최신은 `V63` 이었으나 구현 PR 을 올릴 때 `V64` · `V65` · `V66` 이 이미 병합되어 있어 **`V67__admin_audit_log_event_cancel.sql`** 하나를 더한다 (event-participant 는 마이그레이션이 없고, event-mail 은 이 PR 뒤 번호를 쓴다).

```sql
ALTER TABLE ADMIN_AUDIT_LOG MODIFY TARGET_ACCOUNT_ID BIGINT NULL;
ALTER TABLE ADMIN_AUDIT_LOG ADD COLUMN CLUB_EVENT_ID BIGINT NULL;
```

- 기존 행은 모두 `TARGET_ACCOUNT_ID` 값이 있어 데이터 변경이 없다. 인덱스 `idx_admin_audit_log_target (TARGET_ACCOUNT_ID, CREATED_AT)` 는 그대로 둔다. `CLUB_EVENT_ID` 는 FK 없음 (기존 `PARTICIPANT_ID` 와 같은 방식). 행사별 조회 화면이 없어 인덱스를 더하지 않는다
- `ACTION` 은 `VARCHAR(20)` 이라 `EVENT_CANCEL`(12자)이 그대로 들어간다
- 엔티티 `AdminAuditLog.targetAccountId` 의 `@Column(nullable = false)` 를 풀고 `clubEventId` 필드를 더한다. 테스트(H2 `create-drop`)와 stage(Hibernate `update`)가 엔티티로 스키마를 만들어서다
- `CLUB_EVENT` · `CLUB_EVENT_REGISTRATION` 은 컬럼 · 인덱스를 바꾸지 않는다. V62 `idx_club_event_registration_event_channel_status (CLUB_EVENT_ID, CHANNEL, STATUS)` 가 일괄 취소 · 안내 대상 수의 행사 범위를 좁힌다

## 애그리거트 매핑

[ddd-guide.md](../../docs/backend-development-guide/ddd-guide.md) 기준.

- **ClubEvent** (루트) → `ClubEventRepository` — `STATUS` · `VERSION`, 판정 메서드 `canClose` · `canReopen` · `reopenBlockedReason` · `canCancel`, 전환 `changeStatus`
- **ClubEventRegistration** (다른 애그리거트) → 포트 `ClubEventRegistrationPort` 뒤. 일괄 취소 · 안내 대상 수. 실제 어댑터 `com.studyclub.api.event.ClubEventRegistrationAdapter`
- **Account** → 안내 대상 수의 계정 대조만 (`exists` 서브쿼리, 잠그지 않음)
- **AdminAuditLog** (감사) → `AdminAuditRecorder` — `EVENT_CANCEL` 한 행

## 구현 순서

1. common — `ErrorCode.EVENT_REOPEN_DEADLINE_PASSED`
2. domain — `EventReopenBlockedReason`, `ClubEvent` 판정 4개 · `changeStatus`, 단위 테스트 `ClubEventTest`
3. domain — 포트 메서드 2개, 저장소 조건부 갱신 · 안내 대상 COUNT, `ClubEventCancelledEvent`, `ClubEventRegistrationsCancelledEvent.Cause.EVENT_CANCELLED` 삭제
4. domain — `AdminAuditAction.EVENT_CANCEL` · `AdminAuditLog.eventCancel` · `clubEventId` · `RetentionPolicy.AUDIT_EVENT_CANCEL_V1` + `V67` 마이그레이션
5. api — 어댑터 구현, `AdminClubEventDetailResponse` 판정 필드, 요청 DTO, `AdminClubEventService.changeStatus`, `AdminClubEventStatusController`
6. api — `AnalyticsEventListener.onClubEventCancelled`
7. 테스트 — 통합 `AdminClubEventStatusIntegrationTest`, 어댑터 통합, 분석 리스너 단위
8. 문서 — ERD · domain-events · analytics · data-retention, 스펙 · PRD 상태 `구현중`

## 의존성

- **ERD 변경**: 있음 — [ADMIN_AUDIT_LOG](../../docs/erd/ADMIN_AUDIT_LOG.md) 「(구현 때 추가)」 표시를 실제 컬럼으로 바꾸고 「구현 반영 메모」 를 정리한다
- **SecurityConfig**: 변경 없음 — `/api/admin` 기본 `authenticated()`, 캡틴 판정은 `@RequireAdmin`
- **다른 스펙**: event(잠금 · 버전 N3 · 상세 응답) · event-registration(본인 취소는 저장 상태와 무관, 이미 구현) · event-participant(이 PR 이 더한 `canManageRegistrations` 와 식이 비슷한 `canCancel`, 순서는 이 PR 이 먼저) · event-mail(취소 안내 수신자 = `CANCEL_REASON = EVENT_CANCELLED`)
- **FE**: 팀원 PR #528 (back-office-front 행사 운영 화면). 이 PR 머지 뒤 stage 에서 판정 필드 · 409 코드별 안내를 #528 쪽이 연결해 확인한다

## 리스크

- **판정 필드가 FE 와 먼저 맞아야 한다** — #528 은 BE 머지 전에 스펙만 보고 만든다. 필드 이름 · null 규칙(`reopenBlockedReason` 만 nullable)을 스펙과 한 글자도 다르게 하지 않는다. 응답 스키마 통합 테스트가 필드 여섯 개를 모두 확인한다
- **`cancellationRecipientCount` 의 한 쿼리 가정** — 「취소된 행사에는 유효 신청이 남지 않는다 · 취소 전 행사에는 `EVENT_CANCELLED` 행이 없다」가 깨지면 수가 틀린다. 일괄 취소가 같은 잠금 아래에서 유효 신청을 모두 바꾸고, 다른 경로가 `EVENT_CANCELLED` 를 쓰지 않는다. 통합 테스트가 취소 전 · 직후 · 탈퇴 뒤의 수를 모두 고정한다
- **감사 기록 실패 시 롤백** — `AdminAuditRecorder` 가 `MANDATORY` 라 트랜잭션 밖에서 부르면 바로 실패한다. 서비스 메서드 하나의 `@Transactional` 안에서만 부른다. 저장 실패를 흉내 내는 통합 테스트로 취소 전체가 롤백되는지 본다
- **분석 리스너가 커밋 전 신청을 읽지 않게** — `AFTER_COMMIT` · `@Async` 라 커밋된 상태를 읽는다. 기존 리스너와 같은 실행기를 쓴다
- **H2 와 MySQL 의 차이** — `MODIFY … NULL` 과 컬럼 추가는 `backend-migration-check` CI(빈 MySQL 8 + `validate`)가 증명한다
