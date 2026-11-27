# event Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)
> 날짜: 2026-11-17

## 포맷: `[ID] [P?] 설명`

- **[P]**: 병렬 실행 가능 (다른 태스크와 파일이 겹치지 않음)
- Phase 는 의존성 기준. Phase N 이 끝나야 Phase N+1 시작
- 파일 경로를 구체적으로 적는다

---

## Phase 1: Infrastructure (BE PR)

- [x] T001 에러 코드 7개 — `backend/common/src/main/java/com/studyclub/common/error/ErrorCode.java`
- [x] T002 [P] enum · 값 — `backend/domain/src/main/java/com/studyclub/domain/event/{EventFormat,EventChannel,EventConfirmation,EventStatus,EventDisplayStatus,EventQuestionType,EventSeatCounts,ChannelSeats}.java`
- [x] T003 [P] 입력 값 객체 — `…/domain/event/{EventDraft,ChannelDraft,QuestionDraft,EventLimits,EventInputs}.java`
- [x] T004 애그리거트 — `…/domain/event/{ClubEvent,ClubEventChannel,ClubEventQuestion}.java`
- [x] T005 저장소 — `…/domain/event/{ClubEventRepository,ClubEventPageQuery,ClubEventPageQueryImpl}.java` (`findByIdForUpdate` · `findByCreatedByAndCreateIdempotencyKey` · 페이지 ID · 방식 조인 페치)
- [x] T006 [P] 포트 · 도메인 이벤트 — `…/domain/event/{ClubEventRegistrationPort,ClubEventRegistrationsConfirmedEvent}.java`
- [x] T007 마이그레이션 — `backend/domain/src/main/resources/db/migration/V59__create_club_event.sql`
- [x] T008 단위 테스트 — `backend/domain/src/test/java/com/studyclub/domain/event/ClubEventTest.java` (종료 판정 시각 4개 시간대 · 서머타임 전환일, 표시 상태 우선순위 · 정원 마감 복귀, 잔여석, `can*`, `removableChannels`, 입력 검증, 수정 처리 순서)

## Phase 2: 등록·조회·수정 API

- [x] T009 요청·응답 DTO — `backend/api/src/main/java/com/studyclub/api/event/{AdminClubEventRequest,AdminClubEventDetailResponse,AdminClubEventListResponse}.java`
- [x] T010 요청 → 입력값 — `…/api/event/{ClubEventRequestMapper,IdempotencyKeys}.java`
- [x] T011 서비스 — `…/api/event/AdminClubEventService.java` (목록 · 상세 · 멱등 등록 · 잠금 수정 · 일괄 확정 이벤트 발행)
- [x] T012 컨트롤러 — `…/api/event/AdminClubEventController.java` (`GET/POST /api/admin/events`, `GET/PUT /api/admin/events/{eventId}`)
- [x] T013 임시 어댑터 — `…/api/event/EmptyClubEventRegistrationAdapter.java` (0건 · no-op, 신청 PR 이 지운다)
- [x] T014 통합 테스트 — `backend/api/src/test/java/com/studyclub/api/event/AdminClubEventIntegrationTest.java` (401 · 403 · 404, 멱등 키 400 · 재시도 · 다른 계정 · 동시 요청, 필드 검증 400, 목록 정렬·페이지, 상세, 수정 처리 순서 2~11 · 필수 필드 · 일괄 확정 이벤트)

## Phase 3: 문서

- [x] T015 [P] ERD — `docs/erd/{CLUB_EVENT,CLUB_EVENT_CHANNEL,CLUB_EVENT_QUESTION}.md`, `docs/erd/README.md` (관계도 · 전체 ERD · 표)
- [x] T016 [P] 지도 — `.prober/map/concepts.json` 「행사」 개념 · `CLUB_EVENT.CREATED_BY → ACCOUNT`
- [x] T017 [P] 상태 — `specs/event/spec.md` 헤더·엔드포인트 4개 `구현중`, `01-planning/stories/captain-manage-events/PRD.md` 개발 범위 BE 줄, `specs/domain-events/spec.md` 이벤트 표

## Phase 4: 신청 연동 (팀원 PR)

- [x] T018 신청 테이블을 읽는 `ClubEventRegistrationPort` 실제 어댑터, `EmptyClubEventRegistrationAdapter` 삭제 — PR #516 (`com.studyclub.api.event.ClubEventRegistrationAdapter`, `V62__create_club_event_registration.sql`)
- [x] T019 크루 신청 제출이 행사 행 `findByIdForUpdate` 로 잠근 뒤 `displayStatus` / `seatsOf` 로 판정 — PR #517 (`ClubEventSiteService`, 잠금 순서는 `ACCOUNT` → `CLUB_EVENT`)
- [ ] T020 (event-mail 로 이관) `ClubEventRegistrationsConfirmedEvent` `BEFORE_COMMIT` 구독자. [event-mail tasks](../event-mail/tasks.md) 의 자동 메일 구독자 태스크가 이 이벤트와 신청 접수 · 참가 불가 · 개별 취소 이벤트를 함께 받는다. `AdminClubEventService.update` 의 `TODO(event-mail)` 주석도 그 PR 에서 지운다

## Phase 5: FE 연동 (후속 FE PR)

- [ ] T021 back-office-front `src/app/events/page.tsx` 「준비 중」 → 목록 (`features/events/EventsTable.tsx` 복원, `?page=N` → `offset`)
- [ ] T022 `features/events/form-schema.ts` · `EventForm.tsx` · `EventDialog.tsx` 를 스펙 필드로, `TODO(api)` 경로를 `/api/admin/events` 로
- [ ] T023 행사 상세(행사 정보 탭) — 상세 응답으로 폼 채우기, 모든 필드 전송, 409 코드별 입력란 안내 · 입력 유지, `EVENT_VERSION_CONFLICT` 시 다시 불러오기
- [ ] T024 등록 제출 시도마다 `Idempotency-Key`(UUID v4) 생성, 저장 중 버튼 잠금

---

## Checkpoint

- [x] Phase 1~3 완료 · `./gradlew check` 통과
- [ ] `backend-migration-check` CI(빈 MySQL + `validate`) 통과
- [x] Phase 4 의 이 스펙 몫(T018 · T019) 머지 — T020 은 event-mail 체크포인트에서 본다
- [ ] Phase 5 머지 후 spec.md 상태를 `구현완료` 로 변경
- [ ] `/spec review event` 검증 통과
