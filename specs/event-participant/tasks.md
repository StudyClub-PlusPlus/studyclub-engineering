# event-participant Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)
> 날짜: 2026-11-25 · 기준 `beta` @ `5beb94e2`

## 포맷: `[ID] [P?] 설명`

- **[P]**: 병렬 실행 가능 (다른 태스크와 파일이 겹치지 않음)
- Phase 는 의존성 기준. Phase N 이 끝나야 Phase N+1 시작
- 파일 경로를 구체적으로 적는다. `…/domain/event` = `backend/domain/src/main/java/com/studyclub/domain/event`, `…/api/event` = `backend/api/src/main/java/com/studyclub/api/event`

선행: event-status 구현 PR 머지 (같은 포트 · 어댑터 파일). 신청 테이블 · 엔티티 전이 메서드 · 탈퇴 단계는 PR #516 에 이미 있다. back-office-front 참가자 탭은 팀원 FE PR #528 이 맡는다.

---

## Phase 1: Infrastructure

- [x] T001 [P] 처리 가능 판정 `canManageRegistrations(now)` — `…/domain/event/ClubEvent.java`
- [x] T002 [P] 행별 판정 `canConfirm(manageable)` · `canDecline(manageable)` · `canCancelByAdmin(manageable)` — `…/domain/event/registration/ClubEventRegistration.java` (기존 `confirm` · `decline` · `cancelByAdmin` 은 그대로 재사용)
- [x] T003 [P] 도메인 이벤트 `ClubEventRegistrationsDeclinedEvent(EventMeta meta, Long clubEventId, List<Long> registrationIds, Cause cause)` · `Cause { ADMIN, EVENT_ENDED }` · `NAME = "club_event.registrations_declined"` · `of(...)` — `…/domain/event/ClubEventRegistrationsDeclinedEvent.java` (모양은 기존 `ClubEventRegistrationsCancelledEvent` 와 같게)
- [x] T004 포트 메서드 `List<Long> declinePendingRegistrationsForEventEnd(Long eventId)` — `…/domain/event/ClubEventRegistrationPort.java`
- [x] T005 저장소 — `…/domain/event/registration/`
  - `ClubEventRegistrationPageQuery` · `ClubEventRegistrationPageQueryImpl` (`findPageByClubEventId(eventId, offset, limit)`, `ORDER BY createdAt DESC, id DESC`) — `ClubEventRegistrationRepository` 가 조각으로 상속
  - `ClubEventRegistrationRepository`: `long countByClubEventId(Long)` · `List<Long> findDistinctClubEventIdsByStatus(status)` (JPQL `select distinct r.clubEventId … where r.status = :status`)
- [x] T006 단위 테스트 — `backend/domain/src/test/java/com/studyclub/domain/event/ClubEventTest.java` (`canManageRegistrations`: 시작 뒤 · 신청 마감 뒤에도 종료 전이면 true, 종료 시각 · 취소면 false), `…/registration/ClubEventRegistrationTest.java` (행별 판정 4상태 × manageable, 기존 전이의 409)

## Phase 2: 참가자 API (GET 목록 · GET 신청서 · POST 이메일 보기 · PATCH 참가 처리)

- [x] T007 어댑터 — `…/api/event/ClubEventRegistrationAdapter.java`: `declinePendingRegistrationsForEventEnd` (`findIdsByClubEventIdAndStatus(PENDING)` → `changeStatusWhere(ids, PENDING, DECLINED, null, now)` → 바꾼 ID)
- [x] T008 [P] DTO — `…/api/event/{AdminClubEventRegistrationListResponse,AdminClubEventRegistrationItemResponse,AdminClubEventRegistrationDetailResponse,AdminClubEventRegistrationEmailResponse,AdminClubEventRegistrationDecisionRequest}.java` (`maskedEmail` 은 `EmailMasking.mask`, 탈퇴면 `nickname` · `maskedEmail` null · `accountDeleted = true`, 신청서 `answer` 는 언제나 `String[]`)
- [x] T009 서비스 — `…/api/event/AdminClubEventRegistrationService.java`
  - 목록: 행사 존재 404 → 페이지 · 총수 · 계정 묶음 한 번 · `pendingCount`(`countActiveSeats` 의 `pending` 합) · `canManageRegistrations` 한 값을 모든 행에. `offset < 0` · `limit` 1~100 밖은 400
  - 신청서: 신청이 없거나 다른 행사면 404
  - 이메일 보기: 신청 · 소속 404 → 계정 없음 404 → `AdminAuditRecorder.record(AdminAuditLog.emailReveal(actor, accountId))` → 원본 (한 트랜잭션, 행사 잠금 없음)
  - 참가 처리: `findByIdForUpdate`(첫 조회) → 취소 409 → 종료 409 → 신청 · 소속 404 → `confirm` / `decline` / `cancelByAdmin(actor, now)` → 이벤트 발행 (`ConfirmedEvent` · `DeclinedEvent(ADMIN)` · `CancelledEvent(ADMIN)`). 409 는 상황 문구(「취소된 행사의 신청은 처리할 수 없습니다.」 등)
- [x] T010 컨트롤러 — `…/api/event/AdminClubEventRegistrationController.java` (`@RequireAdmin`, 네 경로, 이메일 보기 응답 `CacheControl.noStore()`)
- [x] T011 [P] 탈퇴 판정 통일 — `backend/api/src/main/java/com/studyclub/api/auth/AccountDeletionService.java` 의 사설 `isOpen(event, now)` 을 `event.canManageRegistrations(now)` 로 바꾸고 지운다 (같은 판정은 같은 메서드). 기존 탈퇴 통합 테스트가 그대로 통과하는지 본다
- [x] T012 통합 테스트 — `backend/api/src/test/java/com/studyclub/api/event/AdminClubEventRegistrationIntegrationTest.java`
  - 공통: 401 · 403(없는 ID 도 403) · 404(행사 없음 · 신청 없음 · 다른 행사의 신청)
  - 목록: 최신 신청순 · 취소 뒤 재신청 두 행 · 20건 페이지 · `offset ≥ total` 이면 빈 `items` · 400 · 탈퇴 계정 행(`accountDeleted`) · 마스킹 · 종료 · 취소 행사도 조회되고 모든 `can*` false
  - 신청서: 사본 순서 · 답 없는 선택 질문 `[]` · 행사 질문을 고친 뒤에도 신청 당시 값
  - 이메일 보기: 원본 · `no-store` · `ADMIN_AUDIT_LOG` `EMAIL_REVEAL` 한 행(`TARGET_ACCOUNT_ID` = 신청자), 탈퇴면 404 · 기록 없음, 기록 실패면 500 · 원본 없음
  - 참가 처리: 확정 · 참가 불가 · 개별 취소(`ADMIN_CANCELLED` · `STATUS_CHANGED_BY` = 캡틴) 성공과 응답의 다시 계산한 `can*`, 이벤트 종류 · `cause`, `CLUB_EVENT.VERSION` 그대로, `PENDING` 요청 400, 확정된 신청에 다시 확정 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED`, 취소 행사 409 `EVENT_CANCELLED`, 종료 행사 409 `EVENT_ENDED`, 시작 뒤 · 신청 마감 뒤라도 종료 전이면 성공

## Phase 3: 종료 시 확인 대기 자동 전환 (스케줄러)

- [x] T013 서비스 — `…/api/event/ClubEventEndSettlementService.java`: `findCandidates(now)` (읽기 트랜잭션, `findDistinctClubEventIdsByStatus(PENDING)` → `findAllById` → 취소 아님 ∧ `startsAt ≤ now` ∧ `now ≥ effectiveEndsAt()`), `settle(eventId, now)` (`REQUIRES_NEW`: `findByIdForUpdate` → 없음 · 취소 · 종료 전이면 건너뜀 → 포트 `declinePendingRegistrationsForEventEnd` → 0건이면 끝 → `ClubEventRegistrationsDeclinedEvent(EVENT_ENDED, actor = null)`)
- [x] T014 스케줄러 — `…/api/event/ClubEventEndSettlementScheduler.java` (`@ConditionalOnProperty("event.end-settlement.enabled", matchIfMissing = true)`, `@Scheduled(fixedDelayString = "${event.end-settlement.fixed-delay-ms:60000}")`). 행사마다 `settle` 을 부르고 예외는 그 행사만 `log.error("clubEventId={}")`(연락처 없음) 후 다음 행사로
- [x] T015 [P] 설정 — `backend/api/src/main/resources/application.yml` 기본값, 테스트 `backend/api/src/test/resources/application.yml` 에서 `event.end-settlement.enabled: false`
- [x] T016 통합 테스트 — `backend/api/src/test/java/com/studyclub/api/event/ClubEventEndSettlementIntegrationTest.java` (스케줄러를 끄고 서비스를 직접 부른다): 종료된 행사의 `PENDING` 만 `DECLINED` · `STATUS_CHANGED_BY` null, `CONFIRMED` 그대로, 취소 행사 · 종료 전 행사 건너뜀, 대상을 고른 뒤 종료 시각을 늘리면 건너뜀(잠금 뒤 재확인), 두 번 연속 실행해도 이벤트 1개, 한 행사 실패가 다음 행사를 막지 않음
- [x] T017 [P] 어댑터 통합 테스트 보강 — `backend/api/src/test/java/com/studyclub/api/event/ClubEventRegistrationAdapterIntegrationTest.java`: `declinePendingRegistrationsForEventEnd` 가 바꾼 ID 만 돌려주고 `UPDATED_AT` 을 채운다

## Phase 4: 문서

- [x] T018 [P] 도메인 이벤트 — `specs/domain-events/spec.md`: `club_event.registrations_declined` 줄 추가, `club_event.registrations_cancelled` 줄의 「운영진 개별 취소(`ADMIN`)는 event-participant 가 더한다」를 구현됨으로, `club_event.registrations_confirmed` 줄의 발행처에 운영진 참가 확정 추가
- [x] T019 [P] ERD 확인 — `docs/erd/ADMIN_AUDIT_LOG.md` 의 `EMAIL_REVEAL` 설명(행사 참가자 조회 포함)이 구현과 같은지 본다. `docs/erd/CLUB_EVENT_REGISTRATION.md` 머리의 「event-participant (운영진 쪽, PR #479)」 를 스펙 링크로 바꾼다
- [x] T020 [P] 트래킹 플랜 — `specs/analytics/spec.md` 는 이름 · 속성 변경이 없어 고치지 않는다. `cancel_type = admin` 이 실제로 나가는지만 통합 테스트로 본다
- [x] T021 상태 — `specs/event-participant/spec.md` 헤더 · 엔드포인트 표 `구현중`, `specs/README.md`, `01-planning/stories/captain-manage-events/PRD.md` 개발 범위 BE 줄. `node scripts/check-dev-scope.mjs` · `cd frontend && pnpm --filter playground export-specs --check`

---

## Checkpoint

- [ ] Phase 1~4 완료 · `cd backend && ./gradlew check` 통과
- [ ] 마이그레이션 없음 확인 (`git diff --stat origin/beta -- backend/domain/src/main/resources/db/migration` 이 비어 있다)
- [ ] event-mail 자동 메일 구독자 머지 뒤 stage 에서 참가 처리 · 종료 전환 메일 확인, 팀원 FE PR #528 참가자 탭 연결 확인 → spec.md 상태 `구현완료`
- [ ] `/spec review event-participant` 검증 통과
