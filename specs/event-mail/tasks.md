# event-mail Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)
> 날짜: 2026-11-25 · 기준 `beta` @ `5beb94e2`

## 포맷: `[ID] [P?] 설명`

- **[P]**: 병렬 실행 가능 (다른 태스크와 파일이 겹치지 않음)
- Phase 는 의존성 기준. Phase N 이 끝나야 Phase N+1 시작
- 파일 경로를 구체적으로 적는다. `…/domain/event` = `backend/domain/src/main/java/com/studyclub/domain/event`, `…/notification` = `backend/notification/src/main/java/com/studyclub/notification`, `…/api` = `backend/api/src/main/java/com/studyclub/api`

선행: event-status 구현 PR(`Cause.EVENT_CANCELLED` 정리 · V67) → event-participant 구현 PR(`ClubEventRegistrationsDeclinedEvent` · `Cause.ADMIN` 발행). 이 목록은 [event tasks](../event/tasks.md) T020 을 포함한다. back-office-front 메일 화면은 팀원 FE PR #528 이 맡는다.

---

## Phase 1: Infrastructure

- [x] T001 [P] 에러 코드 4개 (409) `EVENT_NOT_CANCELLED` · `EVENT_MAIL_TEMPLATE_MISSING` · `EVENT_MAIL_TEMPLATE_CHANGED` · `EVENT_MAIL_NO_RECIPIENTS` — `backend/common/src/main/java/com/studyclub/common/error/ErrorCode.java`
- [x] T002 [P] 메일 애그리거트 — `…/domain/event/mail/{ClubEventMail,ClubEventMailRecipient,ClubEventMailRepository,ClubEventMailType,ClubEventMailAudience,MailBlockedReason}.java` (`@Table` 에 `uk_event_mail_sender_key` · `idx_event_mail_event_created` 선언, `sendBlock(...)` 정적 판정)
- [x] T003 [P] 도메인 이벤트 `ClubEventMailSentEvent(EventMeta meta, Long mailId, Long clubEventId, ClubEventMailType type, int recipientCount)` · `NAME = "club_event_mail.sent"` · `aggregateType = club_event_mail` — `…/domain/event/mail/ClubEventMailSentEvent.java`
- [x] T004 [P] 렌더링 값 — `…/domain/event/mail/EventMailValues.java`: 일정 문자열(시간대 약어 표 · `ko-KR`) · 방식 이름 · 참여 안내(`ALL` + `HYBRID` 공통 본문은 온라인 먼저 두 줄, 수신자별은 그 사람 방식 하나, 링크 없으면 「온라인 참여 링크는 추후 안내드립니다.」) · 미리보기 / 수신자 / 자동 4종 PAYLOAD
- [x] T005 [P] 받는 사람 쿼리 — `…/domain/event/registration/ClubEventRegistrationRepository.java`: 안내(`CONFIRMED` + 선택 방식) · 취소 안내(`CANCELLED` ∧ `EVENT_CANCELLED`) 신청 목록
- [x] T006 마이그레이션 — `backend/domain/src/main/resources/db/migration/V68__create_event_mail.sql` (`EVENT_MAIL` · `EVENT_MAIL_RECIPIENT`). `beta` 최신은 V67(event-status). 올리기 전에 `bash backend/scripts/check-migration-versions.sh` 로 다시 확인
- [x] T007 단위 테스트 — `backend/domain/src/test/java/com/studyclub/domain/event/mail/{ClubEventMailTest,EventMailValuesTest}.java`: `sendBlock` 순서(취소 · 미취소 → 템플릿 → 수신자 → 안내 내용), 종료 행사는 막지 않음(M4), 일정 문자열 시간대 넷 × 서머타임 전 · 후 · 종료 없음, 참여 안내 세 경우

## Phase 2: 알림 모듈 (조건 · 스냅샷 · 렌더러 · 구독자)

- [x] T008 [P] 알림 조건 6값 — `…/notification/NotificationEventType.java`
- [x] T009 렌더러 옵션 — `…/notification/NotificationTemplateRenderer.java` `render(template, payload, RenderOptions)` (`lineBreaks` 면 HTML 값의 `\n` → `<br>`), 기존 오버로드 동작 유지. 테스트 `backend/notification/src/test/java/com/studyclub/notification/NotificationTemplateRendererTest.java` 에 옵션 켜고 끈 경우 · single-pass 유지
- [x] T010 스냅샷 · 재발송 — `…/notification/{Notification,ResendSkipReason}.java`: `SUBJECT_TEMPLATE` · `BODY_TEMPLATE` 필드, 행사용 팩터리, `resendSkipReason(existingAccountIds, stateChangedIds)` · `canResend(...)`, `ResendSkipReason.STATE_CHANGED` (`RECIPIENT_GONE` 다음)
- [x] T011 마이그레이션 — `backend/notification/src/main/resources/db/migration/V69__notification_template_snapshot.sql` (컬럼 2개 nullable)
- [x] T012 디스패처 — `…/notification/WelcomeEmailDispatcher.java`: 스냅샷이 있으면 스냅샷 + PAYLOAD(행사 조건은 `<br>` 옵션), 없으면 지금처럼 `TEMPLATE_ID`. 스냅샷 행은 템플릿을 지워도 `TEMPLATE_MISSING` 이 아니다
- [x] T013 메일 행 생성 — `…/notification/NotificationCreationService.java`: `createClubEventMailEmails(mailId)` (받는 사람마다 1행, `REFERENCE_ID = EVENT_MAIL.ID`, `SENDER_ACCOUNT_ID` = 캡틴) · `createClubEventRegistrationEmail(eventType, clubEventId, registrationId)` (가장 작은 ID 템플릿 1건, 없으면 `false` 를 돌려 건너뜀, 계정 없으면 건너뜀, 일정은 수신자 시간대 → `APPLICANT_TIME_ZONE` → 행사 시간대)
- [x] T014 [P] 템플릿 저장소 — `…/notification/NotificationTemplateRepository.java` `findFirstByEventTypeAndChannelOrderByIdAsc`
- [x] T015 운영자 안내 구독자 — `…/notification/ClubEventMailEmailListener.java` (`BEFORE_COMMIT`, 예외 전파)
- [x] T016 자동 메일 구독자 — `…/notification/ClubEventRegistrationEmailListener.java` (`BEFORE_COMMIT`): `ClubEventRegistrationSubmittedEvent` · `ClubEventRegistrationsConfirmedEvent`(event T020, 확정 방식 전환 포함) · `ClubEventRegistrationsDeclinedEvent` · `ClubEventRegistrationsCancelledEvent`(`SELF` · `ADMIN`). 템플릿 없으면 누락 경보만, DB 오류는 전파
- [x] T017 [P] 누락 경보 — 도메인 이벤트 `…/domain/event/mail/ClubEventMailTemplateMissing.java` (`club_event_mail.template_missing`, `eventType` 이름 · `clubEventId` · `registrationId`), `backend/api/src/main/java/com/studyclub/api/ops/OpsAlertListener.java` 가 받아 `OpsAlertNotifier.send(WARN, …)` (`(eventType, clubEventId)` 10분 묶음 · 건너뛴 건수). notification 모듈이 api 를 모르므로 이벤트로 넘긴다
- [x] T018 [P] 템플릿 변수 검증 — `…/notification/EventTemplateVariables.java` (조건별 허용 · 필수 변수, 공백 있는 변수 거절). 단위 테스트 `EventTemplateVariablesTest`
- [x] T019 시드 — `backend/notification/src/main/resources/db/migration/V70__event_mail_templates.sql` (6종, 같은 조건 템플릿이 있으면 넣지 않음). 시안은 T029 의 HTML
- [x] T020 알림 모듈 테스트 — `backend/notification/src/test/java/com/studyclub/notification/NotificationCreationServiceTest.java` 보강: 행사 조건은 템플릿 둘이어도 1행 · 스냅샷 저장 · 탈퇴 계정 건너뜀 · 템플릿 없음 건너뜀

## Phase 3: 운영자 메일 API (미리보기 · 보내기 · 이력 목록 · 이력 상세)

- [x] T021 [P] DTO — `…/api/event/{AdminClubEventMailPreviewRequest,AdminClubEventMailPreviewResponse,AdminClubEventMailSendRequest,AdminClubEventMailListResponse,AdminClubEventMailDetailResponse}.java` (`type` · `audience` · `displayTimeZone` 은 String 으로 받아 매퍼가 변환, `notice` 5,000자)
- [x] T022 서비스 — `…/api/event/AdminClubEventMailService.java`
  - 미리보기: 잠금 없음, 템플릿 · 받는 사람 수 · 공통 제목/본문(`{{nickname}}` 원문) · `sendBlock`, 막혀도 200
  - 보내기: `IdempotencyKeys` 검사(400) → `findByIdForUpdate` → 같은 키 재응답 → 3~8 → 공통 렌더링 → 저장 → `ClubEventMailSentEvent` → 201 + `Location`. 유일성 위반은 새 읽기 트랜잭션으로 이긴 행
  - 이력 목록 · 상세: 운영자 발송만, 상세 `maskedRecipients` 는 그 발송의 `NOTIFICATION.RECIPIENT_VALUE` 를 계정별 하나로 줄여 `EmailMasking.mask`
- [x] T023 컨트롤러 — `…/api/event/AdminClubEventMailController.java` (`@RequireAdmin`, `/api/admin/events/{eventId}/mails` 네 경로)
- [x] T024 템플릿 API 검증 — `…/api/notification/NotificationTemplateCommandService.java` 등록 · 수정에서 `EventTemplateVariables.validate` (400 `INVALID_INPUT`, 스펙 문구). 테스트는 `backend/api/src/test/java/com/studyclub/api/notification/AdminNotificationTemplateWriteIntegrationTest.java` 에 행사 조건 줄을 더하고, 기존 세 조건은 검사하지 않음을 함께 고정
- [x] T025 재발송 상태 — 새 `…/api/notification/ClubEventNotificationStates.java` (행사 6조건 행만 신청 · 행사 · `EVENT_MAIL_RECIPIENT` 를 묶음 조회해 `stateChangedIds`), `NotificationQueryService` · `NotificationResendService` 가 `NotificationRecipientAccounts.existingIds` 와 함께 넘긴다
- [x] T026 [P] 확정 방식 전환 정리 (event T020) — `…/api/event/AdminClubEventService.java` 의 `TODO(event-mail)` 주석 삭제, `ClubEventRegistrationsConfirmedEvent` 클래스 주석 「구독자: 아직 없다」 갱신
- [x] T027 통합 테스트 — `backend/api/src/test/java/com/studyclub/api/event/AdminClubEventMailIntegrationTest.java`
  - 공통 401 · 403 · 404, 400(`Idempotency-Key` · `type`/`audience` 조합 · 없는 방식 · `notice` 공백 · 5,000자 초과 · `displayTimeZone`)
  - 미리보기: 템플릿 없음 · 수신자 0 · 안내 내용 공백의 `blockedReason`, `ALL` + `HYBRID` 참여 안내 두 줄, 취소 안내에 장소 · 링크 없음, 종료 행사 허용
  - 보내기: `EVENT_MAIL` 1행 · 수신자 스냅샷 · 수신자별 `NOTIFICATION` 1행(스냅샷 · PAYLOAD 는 그 사람 방식 · 시간대), 같은 키 재시도 같은 응답 · 행 증가 없음, 409 네 코드와 `EVENT_CANCELLED`, 탈퇴 계정 제외, 보낸 뒤 템플릿 수정 · 삭제에도 이력 · 예약 내용 그대로
  - 이력: 운영자 발송만 · 최신순 · 상세 마스킹 · 다른 행사 `mailId` 404
- [x] T028 통합 테스트 — `backend/api/src/test/java/com/studyclub/api/event/ClubEventRegistrationEmailIntegrationTest.java`: 신청 접수(`PENDING` · `CONFIRMED`) · 확정 방식 전환 · 운영진 확정 · 참가 불가 · 개별 취소 · 본인 취소 · 종료 전환이 각각 메일 행 1개, 행사 취소 · 탈퇴는 0개, 템플릿 없으면 처리는 커밋 · 메일 없음 · 경보, 메일 행 저장 실패면 처리 전체 롤백. 재발송: 스펙 표 6조건의 허용 · `STATE_CHANGED` (`backend/api/src/test/java/com/studyclub/api/notification/AdminNotificationIntegrationTest.java` 의 목록 `canResend` · 재발송 `skipped` 에 행사 조건 줄 추가)

## Phase 4: 메일 시안 · 문서

- [x] T029 [P] 메일 시안 — `frontend/apps/playground/src/proto/mail/templates/` 에 취소 안내 · 자동 4종 HTML 다섯 개(가입 메일 시안을 복사해 시작, preheader 채움), `docs/mail-templates/README.md` 시안 표 · 「적용」 절(V70 · stage 수동 적용). `cd frontend && pnpm --filter playground run build`
- [x] T030 [P] ERD — `docs/erd/EVENT_MAIL.md` · `docs/erd/EVENT_MAIL_RECIPIENT.md` 신규, `docs/erd/README.md` 표 · 관계도, `docs/erd/NOTIFICATION.md` (컬럼 2개 · `EVENT_TYPE` 6값), `docs/erd/NOTIFICATION_TEMPLATE.md` (`EVENT_TYPE` 6값 · 「템플릿이 하나도 없으면」 표)
- [x] T031 [P] 지도 — `.prober/map/concepts.json` 「행사」 개념에 `EVENT_MAIL` · `EVENT_MAIL_RECIPIENT`, 이름으로 못 찾는 관계(`SENDER_ACCOUNT_ID` · `ACCOUNT_ID` → ACCOUNT, `REGISTRATION_ID` → CLUB_EVENT_REGISTRATION, `NOTIFICATION.REFERENCE_ID` → EVENT_MAIL)
- [x] T032 [P] 다른 스펙 — `specs/notification/spec.md` (행사 조건은 첫 템플릿 한 건 · 스냅샷 · 「지운 뒤의 동작」 · 「재발송 가능 조건」 · `STATE_CHANGED` · 변수 검증), `specs/domain-events/spec.md` (`club_event_mail.sent` 줄, 기존 행사 이벤트 줄의 구독자 칸에 `ClubEventRegistrationEmailListener`), `specs/ops-alerts/spec.md` (템플릿 누락 경보 줄)
- [x] T033 상태 — `specs/event-mail/spec.md` 헤더 · 엔드포인트 표 `구현중`, `specs/event/tasks.md` T020 체크, `specs/README.md`, `01-planning/stories/captain-manage-events/PRD.md` 개발 범위 BE 줄. `node scripts/check-dev-scope.mjs` · `cd frontend && pnpm --filter playground export-specs --check`

## Phase 5: 스테이지 확인 (M7)

- [ ] T034 stage 에서 수신자 합계 1,000 · 5,000 · 20,000명 행사로 보내기를 잰다: 예약 저장 시간, 그동안 같은 행사 크루 신청 · 취소의 대기 시간 · 오류 · 롤백. 결과를 PR 설명에 남기고, 지나치면 배포 전에 상한 · 저장 분리를 `docs/share/` 로 팀에 묻는다

---

## Checkpoint

- [ ] Phase 1~4 완료 · `cd backend && ./gradlew check` 통과 · playground 빌드 통과
- [ ] `backend-migration-check` CI(빈 MySQL + `validate`) 통과
- [ ] Phase 5 측정 완료, 팀원 FE PR #528 메일 화면 연결 확인 → spec.md 상태 `구현완료`, event tasks T020 체크
- [ ] `/spec review event-mail` 검증 통과
