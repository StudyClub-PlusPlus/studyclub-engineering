# event-participant 구현 계획

> Spec: [spec.md](./spec.md) | 날짜: 2026-11-25 | 기준: `beta` @ `5beb94e2` (PR #516 · #517 병합 뒤)
>
> **BE PR 하나**로 낸다. 신청 테이블 · 엔티티 · 저장소 · 포트 어댑터 · 탈퇴 단계는 공통 신청 PR #516 에 이미 있어 이 PR 은 그 위에 운영진 API 네 개와 종료 자동 전환 스케줄러만 얹는다. 순서는 event-status 다음이다(같은 `ClubEventRegistrationPort` · `ClubEventRegistrationAdapter` · `AdminClubEventService` 근처를 만져 충돌을 줄인다). back-office-front 참가자 탭은 팀원 FE PR #528 이 맡는다.

## 대상 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/events/{eventId}/registrations` | 참가자 목록 — `CREATED_AT DESC, ID DESC`, offset · limit(기본 20, 최대 100), `canManageRegistrations` · `pendingCount` · 행별 `can*` |
| GET | `/api/admin/events/{eventId}/registrations/{registrationId}` | 신청서 — 신청 당시 질문 사본 + 답 |
| POST | `/api/admin/events/{eventId}/registrations/{registrationId}/email-reveals` | 이메일 원본 + `EMAIL_REVEAL` 감사 기록, `Cache-Control: no-store` |
| PATCH | `/api/admin/events/{eventId}/registrations/{registrationId}` | 참가 확정 · 참가 불가 · 운영진 개별 취소. 처리 순서 1~9 |
| (스케줄러) | `ClubEventEndSettlementScheduler` | 1분 주기. 종료된 행사의 `PENDING` → `DECLINED`, 행사마다 새 트랜잭션 · `findByIdForUpdate` 잠금 |

## 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 컨트롤러 | 새 `AdminClubEventRegistrationController` (`com.studyclub.api.event`), `@RequireAdmin` · `@RequestMapping("/api/admin/events/{eventId}/registrations")` | 관객별 컨트롤러 · `Admin*` 이름. 인가가 존재 여부보다 먼저 |
| 서비스 | 새 `AdminClubEventRegistrationService` (같은 패키지). 목록 · 신청서는 `@Transactional(readOnly = true)`, 처리는 쓰기 트랜잭션, 이메일 보기는 감사 기록과 한 트랜잭션 | 행사 등록 · 수정 서비스(`AdminClubEventService`)는 행사 애그리거트를 다룬다. 이 서비스는 신청 애그리거트를 다루고 행사는 판정 재료로만 읽는다 |
| 처리 가능 판정 | `ClubEvent.canManageRegistrations(now)` = `STATUS ≠ CANCELLED` ∧ `now < effectiveEndsAt()` | 스펙 「처리 가능 여부」. 식이 `canEdit` 와 같지만 근거가 달라 따로 둔다. `AccountDeletionService.isOpen` 이 같은 식이라 이 메서드로 바꾼다 (같은 판정은 같은 메서드) |
| 행별 판정 | `ClubEventRegistration.canConfirm(manageable)` · `canDecline(manageable)` (`PENDING` ∧ manageable) · `canCancelByAdmin(manageable)` (`isActive()` ∧ manageable) | 스펙 「행별 판정」. 한 응답의 모든 행이 같은 `manageable` 값 하나를 받는다 |
| 상태 전이 | 이미 있는 `confirm` · `decline` · `cancelByAdmin(actor, now)` 를 그대로 쓴다. 엔티티는 잠금 뒤 `findById` 로 읽어 더티 체킹으로 저장 | PR #516 이 만든 메서드가 처리 순서 5·6 의 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` 를 이미 던진다. 행사 잠금이 같은 신청의 동시 변경을 막아 조건부 갱신 없이도 안전하다 (스펙 「7 의 조건부 갱신은 두 번째 방어선」 은 엔티티의 `requireStatus` 가 맡는다) |
| 요청 · 순서 | `AdminClubEventRegistrationDecisionRequest(String status)` → `CONFIRMED` · `DECLINED` · `CANCELLED` 만 (`PENDING` · 그 밖은 400). 서비스 순서: 잠금(1) → 취소 409(2) → 종료 409(3) → 신청 읽기 · 행사 소속 확인 404(4) → 엔티티 전이(5~7) → 이벤트 발행(8) | 처리 순서 표 그대로. 404 가 2·3 보다 뒤라는 스펙 순서를 지킨다 |
| 이벤트 | 확정 → 기존 `ClubEventRegistrationsConfirmedEvent.of(eventId, [id], actor)`. 참가 불가 → 새 `ClubEventRegistrationsDeclinedEvent.of(eventId, [id], Cause.ADMIN, actor)`. 개별 취소 → 기존 `ClubEventRegistrationsCancelledEvent.of(eventId, [id], Cause.ADMIN, actor)` | 스펙 「발행하는 이벤트」 표. 자동 메일 구독자는 event-mail PR 이 붙인다. 이 PR 이 먼저 머지되면 그 사이 운영진 처리에 자동 메일이 없다 (아래 리스크) |
| 분석 | 코드 추가 없음. `AnalyticsEventListener.onEventRegistrationsCancelled` 가 `Cause.ADMIN` 을 `cancel_type = admin` 으로 이미 보낸다 | 스펙 「퍼널·계측」. 트래킹 플랜 줄도 이미 있다(PR #517) |
| 목록 쿼리 | 저장소 조각 `ClubEventRegistrationPageQuery.findPageByClubEventId(eventId, offset, limit)` (JPQL `ORDER BY createdAt DESC, id DESC` + `setFirstResult` · `setMaxResults`, 행사 목록의 `ClubEventPageQuery` 와 같은 방식. offset 이 limit 배수가 아니어도 된다) + `countByClubEventId(eventId)`. 계정은 페이지의 `ACCOUNT_ID` 묶음으로 `AccountRepository.findAllById` 한 번 | V62 `idx_club_event_registration_event_created (CLUB_EVENT_ID, CREATED_AT, ID)` 를 탄다. N+1 금지 |
| `pendingCount` | `ClubEventRegistrationPort.countActiveSeats(eventId)` 의 방식별 `pending` 합 | 스펙 「운영 상세 `seats[].pending` 합과 같은 쿼리」 |
| 이메일 마스킹 | `com.studyclub.common.privacy.EmailMasking.mask` | admin-users 와 같은 함수. 원본은 응답에 싣지 않는다 |
| 이메일 보기 | 신청 · 소속 확인(404) → 계정 확인(탈퇴면 404) → `AdminAuditRecorder.record(AdminAuditLog.emailReveal(actor, accountId))` → 원본. 행사 잠금 없음. 응답 헤더 `CacheControl.noStore()` | 스펙 「이메일 보기」 · P4. `AdminAccountEmailService.reveal` 과 같은 순서 · 같은 팩터리. 보관 규칙은 기존 `EMAIL_REVEAL` 경로(`AUDIT_ACCESS_V1` / 2년 설정) 그대로 |
| 신청서 | `QUESTIONS_SNAPSHOT` 순서대로 `ANSWERS_SNAPSHOT[questionId]` 를 붙여 `answer: String[]` (없으면 `[]`) | 스펙 「신청서 조회」. 현재 `CLUB_EVENT_QUESTION` 을 조인하지 않는다 |
| 종료 자동 전환 | `ClubEventEndSettlementScheduler` (api, `@Component`, `@ConditionalOnProperty("event.end-settlement.enabled", matchIfMissing = true)`, `@Scheduled(fixedDelayString = "${event.end-settlement.fixed-delay-ms:60000}")`). 대상 고르기는 짧은 읽기, 행사마다 `ClubEventEndSettlementService.settle(eventId, now)` 를 `TransactionTemplate`(`REQUIRES_NEW`)로 | 스펙 「처리 순서」 1~3. 한 행사 실패가 다음 행사를 막지 않는다. 테스트 설정에서 끈다(폴러 `notification.polling.enabled` 와 같은 방식) |
| 스케줄링 켜기 | 이미 api 의 `CleanupSchedulingConfig` 가 `@EnableScheduling` 을 켠다. 실행 스레드는 기본 스케줄러를 쓰고, 정리 작업 전용 `dataCleanupScheduler` 는 쓰지 않는다 | 하루 한 번 도는 정리 작업과 1분 주기 작업이 한 스레드를 나눠 쓰지 않게 한다 |
| 종료 전환 포트 | `ClubEventRegistrationPort.declinePendingRegistrationsForEventEnd(eventId)` — 어댑터는 `findIdsByClubEventIdAndStatus(eventId, PENDING)` → `changeStatusWhere(ids, PENDING, DECLINED, null, now)` → 바꾼 ID | 기존 `confirmPendingRegistrations` 와 같은 모양. 행위자는 시스템이라 null |
| 대상 고르기 | 새 `ClubEventRegistrationRepository.findDistinctClubEventIdsByStatus(PENDING)` → `ClubEventRepository.findAllById` → `STATUS ≠ CANCELLED` ∧ `startsAt ≤ now` ∧ `now ≥ effectiveEndsAt()` | V62 `idx_club_event_registration_status_event (STATUS, CLUB_EVENT_ID)` 를 탄다. `effectiveEndsAt` 은 계산값이라 SQL 로 거르지 않는다 |
| 잠금 | 처리 · 종료 전환 모두 `ClubEventRepository.findByIdForUpdate` 를 트랜잭션 첫 조회로. `ACCOUNT` 는 잠그지 않는다 | event 「같은 행사에 쓰는 요청의 처리 순서」. 탈퇴(`ACCOUNT` → `CLUB_EVENT`)와 교착이 없다 |

## 마이그레이션 · 인덱스 검증

**추가 마이그레이션 없음.** `V62__create_club_event_registration.sql` 의 실제 DDL 을 확인했다.

| 이 PR 의 쿼리 | V62 인덱스 | 충분한가 |
|---|---|---|
| 참가자 목록 `WHERE CLUB_EVENT_ID = ? ORDER BY CREATED_AT DESC, ID DESC LIMIT ? OFFSET ?` · `COUNT(*)` | `idx_club_event_registration_event_created (CLUB_EVENT_ID, CREATED_AT, ID)` | 예 — 정렬까지 인덱스 순서로 읽는다 |
| `pendingCount` · 종료 전환의 `PENDING` ID | `idx_club_event_registration_event_channel_status (CLUB_EVENT_ID, CHANNEL, STATUS)` | 예 — 행사 하나로 좁힌 뒤 상태를 본다 |
| 종료 전환 대상 `SELECT DISTINCT CLUB_EVENT_ID WHERE STATUS = 'PENDING'` | `idx_club_event_registration_status_event (STATUS, CLUB_EVENT_ID)` | 예 — 커버링 인덱스 |
| 신청 단건 · 이메일 보기 | PK | 예 |

event-status 의 `V64` 다음에 이 PR 이 마이그레이션을 만들지 않으므로, event-mail 은 event-status 다음 번호를 그대로 쓴다.

## 애그리거트 매핑

[ddd-guide.md](../../docs/backend-development-guide/ddd-guide.md) 기준.

- **ClubEventRegistration** (루트) → `ClubEventRegistrationRepository` — 목록 행 · 신청서 · 상태 전이 · 행별 판정
- **ClubEvent** → `ClubEventRepository` — 잠금 · `canManageRegistrations` · `effectiveEndsAt`. 신청 일괄 변경은 포트(`declinePendingRegistrationsForEventEnd`)
- **Account** → ID 참조. 닉네임 · 마스킹 이메일 · 탈퇴 여부를 묶음 조회로 (잠그지 않음)
- **AdminAuditLog** → `AdminAuditRecorder` — `EMAIL_REVEAL`

## 구현 순서

1. domain — `ClubEvent.canManageRegistrations`, `ClubEventRegistration` 행별 판정, `ClubEventRegistrationsDeclinedEvent`, 포트 `declinePendingRegistrationsForEventEnd`, 저장소 쿼리 3개, 단위 테스트
2. api — 어댑터, DTO, `AdminClubEventRegistrationService`, 컨트롤러, `AccountDeletionService.isOpen` → `canManageRegistrations`
3. api — `ClubEventEndSettlementService` · `ClubEventEndSettlementScheduler`, 설정 키(`application.yml` 기본값 · 테스트에서 끔)
4. 테스트 — 통합 `AdminClubEventRegistrationIntegrationTest` · `ClubEventEndSettlementIntegrationTest`, 어댑터 통합 보강
5. 문서 — domain-events · ADMIN_AUDIT_LOG ERD 확인 · 스펙 · PRD 상태

## 의존성

- **ERD 변경**: 없음 — `CLUB_EVENT_REGISTRATION` 은 V62 그대로. [ADMIN_AUDIT_LOG](../../docs/erd/ADMIN_AUDIT_LOG.md) 의 `EMAIL_REVEAL` 설명에는 행사 참가자 조회가 이미 들어 있다(P4)
- **SecurityConfig**: 변경 없음
- **다른 스펙**: event-status(먼저 머지 — 같은 포트 · 어댑터 파일), event-mail(이 PR 이 낸 `…DeclinedEvent` · `…CancelledEvent(ADMIN)` · `…ConfirmedEvent` 에 자동 메일 구독자를 붙인다), event-registration(같은 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` · 같은 신청 테이블, 이미 구현)
- **FE**: 팀원 PR #528 의 참가자 탭(`ParticipantsTab.tsx`)이 이 응답을 그린다

## 리스크

- **자동 메일 공백** — 이 PR 이 event-mail 보다 먼저 나가면 운영진 확정 · 참가 불가 · 개별 취소 · 종료 전환에 자동 메일이 없다. 운영 반영(prod)은 event-mail 머지 뒤로 미루거나, stage 에서만 확인한다. 종료 전환은 이미 `DECLINED` 가 된 신청을 다시 처리하지 않으므로 나중에 메일을 소급하지 않는다(M2 「소급 발송 없음」 과 같다)
- **스케줄러 중복 실행** — 인스턴스가 여럿이면 각자 돈다. 행사 잠금이 줄을 세우고 늦은 쪽은 바꿀 `PENDING` 이 없다. 통합 테스트로 두 번 연속 실행해 이벤트가 한 번만 나는지 본다
- **종료 판정 시간대** — `effectiveEndsAt` 이 시간대 기준 다음 날 00:00 이라 서머타임 전환일이 섞인다. 판정은 `ClubEvent` 기존 메서드를 그대로 쓰고 새로 계산하지 않는다
- **이메일 보기 기록 누락** — 감사 기록이 실패하면 원본도 나가지 않아야 한다. `@MockitoSpyBean` 으로 저장 실패를 만들어 500 · 원본 미노출을 확인한다 (`AdminAccountEmailRevealIntegrationTest` 와 같은 방법)
- **큰 행사의 목록** — 정원 합 최대 20,000 행. offset 이 커지면 느려지지만 화면은 20건씩이고 운영자 한 명이 넘겨 보는 양이라 지금은 offset 페이지로 둔다
