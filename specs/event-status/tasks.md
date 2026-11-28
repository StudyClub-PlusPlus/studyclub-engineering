# event-status Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)
> 날짜: 2026-11-25 · 기준 `beta` @ `5beb94e2`

## 포맷: `[ID] [P?] 설명`

- **[P]**: 병렬 실행 가능 (다른 태스크와 파일이 겹치지 않음)
- Phase 는 의존성 기준. Phase N 이 끝나야 Phase N+1 시작
- 파일 경로를 구체적으로 적는다. `…/domain/event` = `backend/domain/src/main/java/com/studyclub/domain/event`, `…/api/event` = `backend/api/src/main/java/com/studyclub/api/event`

이 태스크는 BE PR 하나다. back-office-front 연결은 팀원 FE PR #528 이 맡는다 (이 목록에 FE 태스크를 두지 않는다).

---

## Phase 1: Infrastructure

- [x] T001 [P] 에러 코드 `EVENT_REOPEN_DEADLINE_PASSED(409, "신청 마감 시간이 지나 모집을 다시 열 수 없습니다.")` — `backend/common/src/main/java/com/studyclub/common/error/ErrorCode.java` (기존 `EVENT_*` 묶음 뒤)
- [x] T002 [P] 재모집 막힘 이유 enum `EventReopenBlockedReason { STARTED, DEADLINE_PASSED }` — `…/domain/event/EventReopenBlockedReason.java`
- [x] T003 행사 판정 · 전환 — `…/domain/event/ClubEvent.java`
  - `canClose(now)` = `PUBLISHED` ∧ `now < effectiveEndsAt()`
  - `canReopen(now)` = `CLOSED` ∧ 종료 전 ∧ `now < startsAt` ∧ `now < deadlineAt`
  - `reopenBlockedReason(now)` = `CLOSED` ∧ 종료 전일 때만 `STARTED`(먼저) · `DEADLINE_PASSED`, 그 밖은 null
  - `canCancel(now)` = `STATUS ≠ CANCELLED` ∧ 종료 전
  - `changeStatus(target, expectedVersion, now)` → `boolean` — 처리 순서 2(취소) → 3(종료) → 4(같은 상태면 `false`, 버전 안 봄) → 5(버전) → 6(재모집 · 시작) → 7(재모집 · 마감) → 9(`status` 변경 · `version + 1`). 409 는 상황 문구를 넘긴다
- [x] T004 [P] 포트 메서드 2개 — `…/domain/event/ClubEventRegistrationPort.java`: `List<Long> cancelActiveRegistrationsForEventCancellation(Long eventId, Long actorAccountId)` · `int countCancellationRecipients(Long eventId)` (잠금 뒤에만 부른다는 기존 호출 순서 계약을 주석에 그대로 둔다)
- [x] T005 [P] 저장소 — `…/domain/event/registration/ClubEventRegistrationRepository.java`
  - 조건부 벌크 갱신: `ids` 중 `status in active` 인 것만 `CANCELLED` · `cancelReason = EVENT_CANCELLED` · `statusChangedAt/By` · `updatedAt` (기존 `cancelForAccountDeletion` 과 같은 모양, `default` 편의 메서드 하나)
  - 안내 대상 COUNT: `(status in (PENDING, CONFIRMED) or cancelReason = EVENT_CANCELLED) and exists (select a.id from Account a where a.id = r.accountId)`
- [x] T006 [P] 도메인 이벤트 `ClubEventCancelledEvent(EventMeta meta, Long clubEventId, List<Long> cancelledRegistrationIds)` · `NAME = "club_event.cancelled"` · `aggregateType = club_event` · `of(clubEventId, ids, actorAccountId)` — `…/domain/event/ClubEventCancelledEvent.java`
- [x] T007 [P] `Cause.EVENT_CANCELLED` 삭제 — `…/domain/event/ClubEventRegistrationsCancelledEvent.java` (enum 값과 클래스 주석의 「행사 취소 (event-status)」 줄). 쓰는 곳이 없음을 `git grep 'Cause.EVENT_CANCELLED'` 로 확인
- [x] T008 감사 기록 — `backend/domain/src/main/java/com/studyclub/domain/audit/{AdminAuditAction,AdminAuditLog}.java`, `backend/domain/src/main/java/com/studyclub/domain/retention/RetentionPolicy.java`
  - `AdminAuditAction.EVENT_CANCEL` (주석: BEFORE = 취소 직전 상태, AFTER = 함께 취소된 신청 수)
  - `AdminAuditLog`: `targetAccountId` 의 `nullable = false` 해제 · `clubEventId` 필드(`CLUB_EVENT_ID`) · 팩터리 `eventCancel(actorId, clubEventId, EventStatus before, int cancelledCount)` · `policyFor` 의 `switch` 에 `EVENT_CANCEL -> AUDIT_EVENT_CANCEL_V1`
  - `RetentionPolicy.AUDIT_EVENT_CANCEL_V1(3)`
- [x] T009 마이그레이션 — `backend/domain/src/main/resources/db/migration/V67__admin_audit_log_event_cancel.sql` (`TARGET_ACCOUNT_ID` nullable, `CLUB_EVENT_ID BIGINT NULL` 추가). 올릴 때 `beta` 최신이 `V66` 이라 `V67` 로 정했다
- [x] T010 단위 테스트 — `backend/domain/src/test/java/com/studyclub/domain/event/ClubEventTest.java`: 판정 4개의 경계(신청 마감 직전 · 직후, 시작 직전 · 직후, 종료 시각, 취소), `reopenBlockedReason` 의 시작 우선, `changeStatus` 처리 순서(같은 상태 + 낡은 버전 = 성공 · 버전 그대로, 취소 > 종료 > 같은 상태 > 버전 > 시작 > 마감), 수동 마감 뒤 마감 연장으로 자동 재개되지 않음
- [x] T011 [P] 단위 테스트 — `backend/domain/src/test/java/com/studyclub/domain/audit/AdminAuditLogTest.java`: `eventCancel` 이 `TARGET_ACCOUNT_ID = null` · `CLUB_EVENT_ID` · BEFORE/AFTER 값 · 보관 규칙 `AUDIT_EVENT_CANCEL_V1`(발생일 + 3년)을 채운다. 접속 기록 2년 설정이어도 3년이다

## Phase 2: 상태 전환 API (PATCH /api/admin/events/{eventId}/status)

- [x] T012 어댑터 — `…/api/event/ClubEventRegistrationAdapter.java`: 새 포트 메서드 2개. 일괄 취소는 유효 신청 ID 를 읽고(`findIdsByClubEventIdAndStatus` 두 상태 또는 새 `in` 쿼리) 조건부 갱신 후 그 ID 를 돌려준다
- [x] T013 요청 DTO — `…/api/event/AdminClubEventStatusRequest.java` (`status` String · `version` Long, `@NotNull` · `@PositiveOrZero`). 허용 값 변환은 `ClubEventRequestMapper` 에 `toTargetStatus(String)` 로 (실패는 `status: …` 400)
- [x] T014 응답 — `…/api/event/AdminClubEventDetailResponse.java`: 필드 `canClose` · `canReopen` · `reopenBlockedReason` · `canCancel` · `hasCancellationRecipients` · `cancellationRecipientCount`, `of(event, now, counts, cancellationRecipientCount)`. 기존 호출부(상세 · 등록 · 수정) 모두 새 인자로
- [x] T015 서비스 — `…/api/event/AdminClubEventService.java` `changeStatus(eventId, request, actorId)`: 잠금(첫 조회) → `event.changeStatus` → 바뀐 게 취소면 포트 일괄 취소 · `AdminAuditRecorder.record(AdminAuditLog.eventCancel(...))` · `ClubEventCancelledEvent` 발행 → 안내 대상 수 · 좌석 수를 잠금 뒤 다시 세어 응답. 같은 상태(S1)면 아무것도 쓰지 않고 현재 상세. 상세 · 등록 · 수정도 `countCancellationRecipients` 를 넘긴다
- [x] T016 컨트롤러 — `…/api/event/AdminClubEventStatusController.java` (`@RequireAdmin`, `PATCH /api/admin/events/{eventId}/status`, OpenAPI 설명에 409 코드 다섯 개)
- [x] T017 분석 구독 — `backend/api/src/main/java/com/studyclub/api/analytics/AnalyticsEventListener.java`: `onClubEventCancelled(ClubEventCancelledEvent)` (`@Async` · `AFTER_COMMIT` · `fallbackExecution = true`), 신청마다 `Event Registration Cancelled` · `cancel_type = event_cancelled` · `insert_id = event_registration_cancelled_{id}`. 기존 `onEventRegistrationsCancelled` 와 공통 본문을 사설 메서드로 묶는다. 바뀐 신청 0건이면 보내지 않는다
- [x] T018 통합 테스트 — `backend/api/src/test/java/com/studyclub/api/event/AdminClubEventStatusIntegrationTest.java`
  - 401 · 403(없는 ID 도 403) · 404 · 400(`status` 누락 · `PENDING` · 허용 밖, `version` 누락 · 음수)
  - 모집 마감 → 200 · `version + 1` · `displayStatus = RECRUITMENT_CLOSED`, 신청 마감 뒤에도 마감 가능(S3)
  - 같은 상태 + 낡은 버전 → 200 · 버전 그대로 · 감사 기록 없음(S1)
  - 재모집: 마감 전 성공, 마감 뒤 409 `EVENT_REOPEN_DEADLINE_PASSED`, 시작 뒤 409 `EVENT_ALREADY_STARTED`
  - 행사 취소: `PENDING` · `CONFIRMED` 만 `CANCELLED` · `EVENT_CANCELLED` 로, `DECLINED` · 기존 취소는 그대로. `ADMIN_AUDIT_LOG` 한 행(신청 0건이어도). `ClubEventCancelledEvent` 1개, `ClubEventRegistrationsCancelledEvent` 0개. `NOTIFICATION` 행 0개
  - 취소 뒤 모든 전환 409 `EVENT_CANCELLED`, 종료 뒤 409 `EVENT_ENDED`, 다른 캡틴의 수정 뒤 409 `EVENT_VERSION_CONFLICT`
  - 감사 기록 저장 실패(`@MockitoSpyBean AdminAuditLogRepository`) → 500 · 행사 · 신청 모두 그대로
  - 판정 필드: 취소 전 `cancellationRecipientCount` = 유효 신청 중 계정이 남은 수, 취소 직후 같은 수, 그 뒤 한 명 탈퇴하면 하나 줄고 `hasCancellationRecipients` 는 0명일 때 false (S5). 상세 · 등록 · 수정 · `PATCH` 응답 모두 여섯 필드를 싣는다
- [x] T019 [P] 어댑터 통합 테스트 보강 — `backend/api/src/test/java/com/studyclub/api/event/ClubEventRegistrationAdapterIntegrationTest.java`: 일괄 취소가 바꾼 ID 만 돌려주고 `UPDATED_AT` · `STATUS_CHANGED_BY` 를 채운다, 안내 대상 수의 두 뜻
- [x] T020 [P] 분석 리스너 단위 테스트 — `backend/api/src/test/java/com/studyclub/api/analytics/AnalyticsEventListenerTest.java` (새 파일. 손댄 파일의 빠진 테스트를 채운다 — AGENT.md 개발 규칙 4): `onClubEventCancelled` 의 `cancel_type` · `insert_id` · 빈 목록, 기존 `onEventRegistrationsCancelled` 의 `self` · `admin`

## Phase 3: 문서

- [x] T021 [P] ERD — `docs/erd/ADMIN_AUDIT_LOG.md`: `TARGET_ACCOUNT_ID` NULL 허용 · `CLUB_EVENT_ID` · `EVENT_CANCEL` 의 「(구현 때 추가)」 표시를 지우고 「구현 반영 메모」 에서 반영한 줄을 정리
- [x] T022 [P] 보관 규칙 — `specs/data-retention/spec.md` 규칙 코드 표에 `AUDIT_EVENT_CANCEL_V1` (발생일 + 3년)
- [x] T023 [P] 도메인 이벤트 — `specs/domain-events/spec.md`: `club_event.cancelled` 줄 추가, `club_event.registrations_cancelled` 줄의 「행사 취소(`EVENT_CANCELLED`)는 event-status 가 더한다」 문장 삭제
- [x] T024 [P] 트래킹 플랜 — `specs/analytics/spec.md` `Event Registration Cancelled` 줄의 「언제」 칸에 「행사 전체 취소는 `club_event.cancelled`」 를 더한다 (이름 · 속성 그대로)
- [x] T025 [P] 지도 확인 — `.prober/map/` 는 바꾸지 않는다 (새 테이블 없음, 행사 흐름 파일 없음). `prober-map` CI 경고가 없는지만 본다
- [x] T026 상태 — `specs/event-status/spec.md` 헤더 · 엔드포인트 표 `구현중`, `specs/README.md`, `01-planning/stories/captain-manage-events/PRD.md` 개발 범위 BE 줄. `node scripts/check-dev-scope.mjs` · `cd frontend && pnpm --filter playground export-specs --check`

---

## Checkpoint

- [ ] Phase 1~3 완료 · `cd backend && ./gradlew check` 통과
- [ ] `backend-migration-check` CI(빈 MySQL + `validate`) 통과
- [ ] 팀원 FE PR #528 과 stage 에서 판정 필드 · 409 안내 연결 확인 뒤 spec.md 상태를 `구현완료` 로 변경
- [ ] `/spec review event-status` 검증 통과
