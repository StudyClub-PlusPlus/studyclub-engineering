# event-mail 구현 계획

> Spec: [spec.md](./spec.md) | 날짜: 2026-11-25 | 기준: `beta` @ `5beb94e2` (PR #516 · #517 병합 뒤)
>
> **BE PR 하나**로 낸다. 순서는 event-status → event-participant 다음이다. 운영진 처리 · 종료 전환이 발행하는 `ClubEventRegistrationsDeclinedEvent` 를 event-participant 가 만들기 때문이다. 이 PR 은 [event tasks](../event/tasks.md) 의 T020(확정 방식 전환의 확정 안내 메일 구독자)도 함께 닫는다. back-office-front 메일 작성 창 · 메일 이력 탭은 팀원 FE PR #528 이 맡는다.

## 대상 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/admin/events/{eventId}/mails/preview` | 공통 미리보기 · 받는 사람 수 · `canSend` / `blockedReason`. 저장 · 잠금 없음 |
| POST | `/api/admin/events/{eventId}/mails` | 안내 · 취소 안내 보내기. `Idempotency-Key` 필수, 처리 순서 1~13 |
| GET | `/api/admin/events/{eventId}/mails` | 메일 이력 목록 (운영자 발송만), offset · limit(1~50) |
| GET | `/api/admin/events/{eventId}/mails/{mailId}` | 메일 이력 상세 · 가린 받는 주소 |
| (구독자) | `ClubEventRegistrationEmailListener` | 자동 메일 4종 — `ClubEventRegistrationSubmittedEvent` · `…ConfirmedEvent` · `…DeclinedEvent` · `…CancelledEvent` 의 `BEFORE_COMMIT` |
| (기존 API 확장) | `/api/admin/notification-templates` · `/api/admin/notifications` · `/api/admin/notifications/resend` | 행사 조건 6종 · 템플릿 변수 검증 · 재발송 상태 검증 |

## 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 모듈 배치 | 애그리거트 `ClubEventMail` · `ClubEventMailRecipient` · 저장소 · `ClubEventMailSentEvent` 는 domain `com.studyclub.domain.event.mail`. 메일 행을 만드는 구독자 · 생성 코드는 notification 모듈. 컨트롤러 · 서비스는 api `com.studyclub.api.event` | 공지(`StudyNotice` domain · `StudyNoticeEmailListener` notification · 공지 서비스 api)와 같은 배치. notification 은 domain 에 의존하고 api 는 둘 다에 의존한다 |
| 애그리거트 | `ClubEventMail`(루트, 테이블 `EVENT_MAIL`) + `ClubEventMailRecipient`(`@OneToMany` cascade, 테이블 `EVENT_MAIL_RECIPIENT`, FK 는 애그리거트 안에만). 팩터리 `ClubEventMail.send(event, type, audience, notice, template, recipients, displayTimeZone, sender, idempotencyKey, renderedSubject, renderedBody)` | 스펙 「데이터 모델」. 받는 사람 스냅샷은 발송과 함께 고정된다 |
| 보낼 수 있나 | `ClubEventMail.sendBlock(EventStatus, MailType, boolean templateExists, int recipientCount, String notice)` → `MailBlockedReason`(null 이면 가능). 미리보기와 보내기가 같은 메서드 | 스펙 `blockedReason` 표 순서. 판정은 한 메서드 |
| 렌더링 값 | 순수 도메인 값 객체 `EventMailValues` (`com.studyclub.domain.event.mail`) — `schedule(event, zone)` · `channelName(...)` · `participation(event, channel, audience)` · `forPreview(...)` · `forRecipient(...)` 가 `Map<String, Object>` PAYLOAD 를 만든다 | 미리보기(api) · 보내기(api) · 자동 메일(notification) 세 곳이 같은 값을 써야 한다. 프로토 `eventNoticeValues` 와 같은 결과를 단위 테스트로 고정 |
| 일정 문자열 | `ko-KR` `M월 d일 (E) HH:mm`, 종료가 있으면 `{시작} ~ {종료} {약어}`. 약어는 서울 `KST`, 그 밖은 그 시각의 서머타임 여부로 `EST`·`EDT`·`PST`·`PDT` (`ZoneId.getRules().isDaylightSavings`) | 스펙 「일정 문자열」. JDK 의 짧은 이름(`TextStyle.SHORT`)은 로케일 · JDK 에 따라 `GMT-05:00` 처럼 나올 수 있어 표로 고정한다 |
| 렌더러 `<br>` | `NotificationTemplateRenderer.render(template, payload, RenderOptions options)` 오버로드. `RenderOptions.lineBreaks()` 면 HTML 템플릿에서 이스케이프 뒤 `\n` → `<br>`. 기존 `render(template, payload)` 는 그대로(옵션 끔) | 스펙 「치환 방식」. 행사 조건에만 켜서 `STUDY_NOTICE` · 웰컴 메일 모양을 바꾸지 않는다 |
| 쓰는 템플릿 | `NotificationTemplateRepository.findFirstByEventTypeAndChannelOrderByIdAsc(type, EMAIL)` | M1 — 행사 조건만 가장 작은 ID 한 건. 기존 조건은 지금처럼 `findAllByEventTypeAndChannelOrderByIdAsc` |
| 발송 내용 고정 | `Notification` 에 `subjectTemplate` · `bodyTemplate` (nullable) 와 팩터리 `pendingEventMail(...)`. 발송은 `WelcomeEmailDispatcher.dispatch` 가 스냅샷이 있으면 스냅샷 + PAYLOAD 로 렌더링하고(행사 조건은 `<br>` 옵션), 없으면 지금처럼 `TEMPLATE_ID` 로 읽는다 | M6. 폴러 · 재발송 모두 같은 디스패처를 지나므로 한 곳만 바꾼다 |
| 메일 행 생성 | `NotificationCreationService` 에 `createClubEventMailEmails(mailId)` (운영자 안내) · `createClubEventRegistrationEmail(eventType, registrationId)` (자동). 둘 다 `Propagation.REQUIRED` 로 처리 트랜잭션에 참여 | 기존 `createStudyNoticeEmails` 와 같은 방식. 계정은 잠그지 않고 읽어 없으면 그 사람 몫을 건너뛴다 |
| 운영자 안내 구독자 | `ClubEventMailEmailListener` (notification, `BEFORE_COMMIT`) ← `ClubEventMailSentEvent`. 실패는 삼키지 않는다 | 처리 순서 12. `StudyNoticeEmailListener` 와 같다 |
| 자동 메일 구독자 | `ClubEventRegistrationEmailListener` (notification, `BEFORE_COMMIT`, 처리 서비스와 다른 빈). 이벤트별 매핑: Submitted(`PENDING` → `EVENT_REGISTRATION_PENDING`, `CONFIRMED` → `EVENT_REGISTRATION_CONFIRMED`) · Confirmed → `_CONFIRMED` · Declined → `_DECLINED` · Cancelled(`SELF` · `ADMIN`) → `_CANCELLED`. 템플릿이 없으면 메일만 건너뛰고 누락 경보, DB 오류는 전파(롤백) | 스펙 「자동 메일」 · M2. `ClubEventRegistrationsCancelledEvent.Cause.EVENT_CANCELLED` 는 event-status 구현 PR 이 지우므로 이 구독자는 그 값을 다루지 않는다 |
| 누락 경보 | notification 모듈은 api 의 `OpsAlertNotifier` 를 모르므로, 자동 메일 구독자가 건너뛸 때 도메인 이벤트 `ClubEventMailTemplateMissing`(`club_event_mail.template_missing`)을 발행하고 api 의 `OpsAlertListener` 가 받아 `OpsAlertNotifier.send(WARN, …)` 를 `(eventType, clubEventId)` 10분 묶음으로 보낸다. 로그에는 `eventType` · `clubEventId` · `registrationId` 만 | 스펙 「템플릿이 없을 때」. ops-alerts 표에 줄을 더한다 |
| 멱등 보내기 | `Idempotency-Key` 는 기존 `IdempotencyKeys`(api.event) 로 검사 · 소문자화. `EVENT_MAIL` `UNIQUE(SENDER_ACCOUNT_ID, IDEMPOTENCY_KEY)`. 처리 순서 2 는 잠금 뒤 `findBySenderAccountIdAndIdempotencyKey`, 유일성 위반(`DataIntegrityViolationException`)은 새 읽기 트랜잭션으로 이긴 행을 읽어 같은 201 | 행사 등록(event N1)과 같은 방식 · 같은 유틸 |
| 잠금 | 보내기만 `ClubEventRepository.findByIdForUpdate` 를 첫 조회로. `ACCOUNT` 는 잠그지 않는다. 미리보기 · 이력은 잠그지 않는다 | 스펙 「행사 행을 잠그는 이유」 · 「탈퇴와 메일 예약의 순서」. 탈퇴(`ACCOUNT` → `CLUB_EVENT`)는 PR #516 이 이미 구현했다 |
| 받는 사람 | 안내: `CONFIRMED`(+ 방식). 취소 안내: `CANCELLED ∧ CANCEL_REASON = EVENT_CANCELLED`. 신청 저장소에 `findRecipients(eventId, statuses, channel, cancelReason)` + 계정 묶음 조회로 남은 계정만 | 스펙 「받는 사람」. 탈퇴 계정은 세지도 보내지도 않는다 (event-status S5 와 같은 기준) |
| 템플릿 변수 검증 | `NotificationTemplateCommandService` 의 등록 · 수정 앞에서 `EventTemplateVariables.validate(eventType, subject, body)` (notification 모듈). 행사 6조건만 검사, 기존 3조건은 그대로 | 스펙 「템플릿 검증」. 공백 있는 변수(`{{ notice }}`)도 지원하지 않는 변수로 거절 |
| 재발송 검증 | `Notification.resendSkipReason(existingAccountIds, stateChangedIds)` 로 인자를 하나 더하고 `ResendSkipReason.STATE_CHANGED` 를 둔다. `stateChangedIds` 는 api 의 새 `ClubEventNotificationStates`(행사 조건 행만 골라 신청 · 행사 · `EVENT_MAIL_RECIPIENT` 를 ID 묶음으로 한 번씩 읽어 스펙 표대로 판정)가 만든다. 목록(`NotificationQueryService`)과 재발송(`NotificationResendService`)이 `NotificationRecipientAccounts.existingIds` 와 함께 같은 재료를 넘긴다 | 스펙 「재발송 가능 조건」. 목록 `canResend` 와 재발송 접수가 같은 메서드 · 같은 재료. `RECIPIENT_GONE` 이 `STATE_CHANGED` 보다 먼저 |
| 알림 조건 | `NotificationEventType` 에 6값 (`EVENT_ANNOUNCEMENT` · `EVENT_CANCELLATION` · `EVENT_REGISTRATION_PENDING` · `_CONFIRMED` · `_DECLINED` · `_CANCELLED`) | `VARCHAR(40)` 이라 스키마 변경 없음 |
| 오류 코드 | 새 4개 (모두 409): `EVENT_NOT_CANCELLED` · `EVENT_MAIL_TEMPLATE_MISSING` · `EVENT_MAIL_TEMPLATE_CHANGED` · `EVENT_MAIL_NO_RECIPIENTS`. 기존 `EVENT_CANCELLED` 는 상황 문구로 | 스펙 「Error Responses」 |
| 확정 방식 전환 연결 | `AdminClubEventService.update` 의 `TODO(event-mail)` 주석을 지운다. 이벤트는 이미 발행 중이라 구독자만 붙이면 된다 | event tasks T020 |

## 마이그레이션

`beta` 최신은 V63 이다. event-status 가 `V64`(감사 로그)를 쓰고 event-participant 는 마이그레이션이 없으므로, 이 PR 은 **V65 부터** 쓴다. 테이블을 가진 모듈마다 파일을 나눈다 (기존 규칙: 알림 테이블 · 템플릿 시드는 `backend/notification/src/main/resources/db/migration`, 그 밖은 `backend/domain/...`). PR 을 올릴 때 `beta` 최신을 다시 보고 번호를 정한다.

| 파일 | 모듈 | 내용 |
|---|---|---|
| `V65__create_event_mail.sql` | domain | `EVENT_MAIL` (`INDEX(CLUB_EVENT_ID, CREATED_AT, ID)` · `UNIQUE(SENDER_ACCOUNT_ID, IDEMPOTENCY_KEY)`, `BODY MEDIUMTEXT`, `NOTICE TEXT`) · `EVENT_MAIL_RECIPIENT` (`EVENT_MAIL_ID` FK · `UNIQUE(EVENT_MAIL_ID, ACCOUNT_ID)`, `ACCOUNT_ID` · `REGISTRATION_ID` 는 FK 없음) |
| `V66__notification_template_snapshot.sql` | notification | `NOTIFICATION.SUBJECT_TEMPLATE VARCHAR(255) NULL` · `BODY_TEMPLATE TEXT NULL` 추가. 기존 행은 NULL |
| `V67__event_mail_templates.sql` | notification | 행사 알림 템플릿 6종 시드 (`EMAIL`, 제목은 스펙 「시드」 표, 본문은 `proto/mail/templates/` 의 HTML 시안). 이미 같은 조건 템플릿이 있으면 넣지 않는다(`INSERT … SELECT … WHERE NOT EXISTS`) |

- 스키마(V65 · V66)와 데이터(V67)를 나누는 이유: 시드 문구는 오너 승인 뒤 바뀔 수 있고, stage 는 Flyway 가 꺼져 있어 시드만 손으로 한 번 넣는다 (메일 템플릿 README 「적용」). 문의 회신의 V50(스키마) · V52(시드)와 같은 나눔이다
- 엔티티 `@Table` 에 유일 제약 · 인덱스를 같은 이름으로 선언한다 (테스트 H2 · stage Hibernate 가 엔티티로 스키마를 만든다)

## 애그리거트 매핑

[ddd-guide.md](../../docs/backend-development-guide/ddd-guide.md) 기준.

- **ClubEventMail** (루트) → `ClubEventMailRepository` — `EVENT_MAIL` 전 컬럼, `sendBlock`
  - `ClubEventMailRecipient` → 받는 사람 스냅샷 (`ACCOUNT_ID` · `REGISTRATION_ID` · `CHANNEL`)
- **ClubEvent** → 잠금 · 상태 · 일정 · 참여 방식(장소 · 링크)
- **ClubEventRegistration** → 받는 사람 고르기 · 자동 메일의 방식 · 신청 당시 시간대 · 재발송 판정
- **Account** → 이메일 · 닉네임 · 시간대 (잠그지 않음)
- **Notification** · **NotificationTemplate** (notification 모듈) → 아웃박스 행 · 템플릿 원문 스냅샷

## 구현 순서

1. common — `ErrorCode` 4개
2. domain — `ClubEventMail` · `ClubEventMailRecipient` · 저장소 · `ClubEventMailSentEvent` · `EventMailValues` · `MailBlockedReason`, 신청 저장소의 받는 사람 쿼리, 단위 테스트, `V65`
3. notification — `NotificationEventType` 6값, `Notification` 스냅샷 · 재발송 인자, `ResendSkipReason.STATE_CHANGED`, 렌더러 옵션, 디스패처, `NotificationCreationService` 두 메서드, 두 구독자, `EventTemplateVariables`, `V66` · `V67`
4. api — DTO · `AdminClubEventMailService` · `AdminClubEventMailController`, `NotificationTemplateCommandService` 검증, `ClubEventNotificationStates` · 목록 · 재발송 연결, `AdminClubEventService` 의 `TODO(event-mail)` 정리
5. 메일 시안 — `frontend/apps/playground/src/proto/mail/templates/` 에 다섯 HTML 시안 · README 시안 표 (playground 빌드 확인)
6. 테스트 — 단위 · 통합 · 스테이지 측정(M7)
7. 문서 — ERD 4개 · `.prober/map/concepts.json` · notification · domain-events · ops-alerts 스펙, 스펙 · PRD 상태

## 의존성

- **ERD 변경**: 있음 — 새 `docs/erd/EVENT_MAIL.md` · `EVENT_MAIL_RECIPIENT.md` (+ `docs/erd/README.md` 표 · 관계도), [NOTIFICATION](../../docs/erd/NOTIFICATION.md) 컬럼 2개 · `EVENT_TYPE` 값, [NOTIFICATION_TEMPLATE](../../docs/erd/NOTIFICATION_TEMPLATE.md) `EVENT_TYPE` 값 · 「템플릿이 하나도 없으면」 표
- **SecurityConfig**: 변경 없음
- **다른 스펙**: event-status(취소 안내 대상 = `EVENT_CANCELLED`, `Cause.EVENT_CANCELLED` 정리가 먼저) · event-participant(`…DeclinedEvent` · `Cause.ADMIN` 발행이 먼저) · event-registration(`ClubEventRegistrationSubmittedEvent` · 본인 취소 `Cause.SELF` 는 이미 발행 중) · notification(템플릿 · 재발송 규칙 변경) · study-notice(같은 아웃박스 구조, 동작 변경 없음)
- **FE**: 팀원 PR #528 의 `EventMailComposer.tsx` · `MailHistoryTab.tsx`, 백오피스 알림 템플릿 화면의 조건 선택(6값)

## 리스크

- **큰 발송의 잠금 시간 (M7)** — 행사 잠금을 쥔 채 수신자 × `NOTIFICATION` INSERT(IDENTITY 라 배치 없음)를 한다. 구현 뒤 stage 에서 수신자 합계 최대 20,000명까지 저장 시간 · 같은 행사 신청/취소 대기 · 오류를 잰다. 지나치면 배포 전에 상한이나 저장 분리를 정한다 (태스크로 둔다)
- **자동 메일 롤백 범위** — 구독자가 `BEFORE_COMMIT` 이라 메일 행 저장 실패가 신청 · 참가 처리 · 종료 전환을 되돌린다. 「템플릿 없음」만 예외로 커밋한다. 두 경우를 통합 테스트로 나눠 고정한다
- **시간대 약어** — JDK 기본 이름에 기대지 않고 표로 정한다. 시간대 넷 × 서머타임 전 · 후를 프로토 결과와 맞추는 단위 테스트를 둔다
- **기존 메일 모양 회귀** — 렌더러 · 디스패처를 바꾸므로 기존 `NotificationTemplateRendererTest` · 웰컴 메일 · 공지 · 문의 회신 테스트가 그대로 통과해야 한다
- **재발송 판정 재료 쿼리** — 목록 한 페이지의 행사 조건 행만 골라 ID 묶음으로 읽는다. 행마다 읽지 않는다 (N+1 금지)
- **템플릿 시드와 stage** — stage 는 Flyway 가 꺼져 있다. 시드 SQL 을 손으로 한 번 넣는 절차를 PR 설명에 적는다
