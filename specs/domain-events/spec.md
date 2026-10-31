# 도메인 이벤트

> 상태: 1단계 구현 · 계약: `backend/common/src/main/java/com/studyclub/common/event/` · 실행기: `backend/api/src/main/java/com/studyclub/api/config/AsyncConfig.java`

## 공통 계약

모든 도메인 이벤트는 `DomainEvent` (common 모듈, `com.studyclub.common.event`) 를 구현한다.

| 필드 | 타입 | 뜻 |
|---|---|---|
| `eventId` | UUID | 이벤트마다 새로 만든다 (`EventMeta.now`) |
| `name` | String | `aggregate.past_tense`, snake case. 예 `user.registered` · `study_application.submitted` |
| `occurredAt` | Instant (UTC) | 사실이 생긴 시각 (`EventMeta.now`) |
| `aggregateType` | String | 사실이 생긴 aggregate. snake case (`account`, `study_application`) |
| `aggregateId` | String | 그 aggregate 의 id |
| `actorId` | String, nullable | 사실을 일으킨 계정 id. 시스템이 일으켰으면 null |
| 페이로드 | 이벤트별 | id 와 표시용 값만. 비밀값·토큰·연락처 원문은 싣지 않는다 |

Java 모양:

- 이벤트 = `record`. 첫 컴포넌트는 `EventMeta meta` (eventId · occurredAt · actorId), 그 뒤에 페이로드
- `name()` · `aggregateType()` · `aggregateId()` 를 구현한다. `name` 은 `NAME` 상수로 둔다
- 만들 때는 `of(...)` 정적 팩토리를 쓴다 — 메타를 손으로 채우지 않는다
- 클래스는 사실이 생긴 aggregate 의 `domain` 패키지에 둔다
- 버전 필드·이벤트 레지스트리·레포 간 공유 패키지는 두지 않는다 (필요해지면 그때)

### 이름 규칙

- `<aggregate>.<과거형 동사>` — 무엇이 **일어났다**. 명령(`send_mail`)이 아니라 사실(`user.registered`)
- Java 클래스 이름은 레포 관례를 따른다 (기존 `UserRegisteredEvent` 는 이름을 유지)

### 발행·전달 규칙

사실이 생기면 서비스가 도메인 이벤트를 발행하고, 부수효과(ops 알림·메일·외부 연동)는 **구독자**로 붙인다.
서비스 메서드에서 부수효과를 직접 부르지 않는다.

- 발행: `ApplicationEventPublisher.publishEvent(...)` — 트랜잭션 안에서
- 구독: 발행하는 서비스와 **다른 빈**에 `@TransactionalEventListener(phase = AFTER_COMMIT)`.
  같은 빈 안에 두면 프록시를 안 거쳐 `@Async` 가 무시된다
- 요청을 막으면 안 되는 구독자는 `@Async` 를 붙이고 `fallbackExecution = true` (트랜잭션 밖 발행도 받는다)
- **예외 — 아웃박스 행을 만드는 구독자는 `BEFORE_COMMIT`.** 메일처럼 잃으면 안 되는 부수효과는 구독자가 `NOTIFICATION` 행을 만들고 폴러가 보낸다. 이 행은 사실(공지 저장)과 **같은 트랜잭션에서** 커밋되어야 「사실은 있는데 메일 행이 없는」 상태가 생기지 않는다. 그래서 `BEFORE_COMMIT` 으로 받고, 행 생성이 실패하면 **예외를 삼키지 않고** 트랜잭션 전체를 롤백한다. 실제 발송(SES)은 커밋 뒤 폴러가 하므로 요청 트랜잭션에 외부 호출이 들어가지 않는다 (`study_notice.sent` → `StudyNoticeEmailListener`)
- 구독자는 예외를 삼키고 warn/error 로그만 남긴다 — 이미 커밋된 사실을 되돌릴 수 없다. 로그에는 `eventId` 를 남긴다

### 전달 보장

메모리 안 · 커밋 뒤 전달이다. **커밋과 전송 사이에 프로세스가 죽으면 그 이벤트는 사라진다** (outbox 없음).
ops 알림처럼 잃어도 되는 부수효과에 맞다. 잃으면 안 되는 것(메일)은 구독자가 DB 행을 만들고 폴러가 보낸다 —
`specs/notification/spec.md` 의 웰컴메일이 그 방식이다.

`@Async` 실행기는 상한이 있다 — 스레드 2 · 대기열 100. 넘치면 작업을 버리고 warn 로그.

## 이벤트

| name | 클래스 | 언제 | aggregate (type · id) · actor | 페이로드 | 구독자 |
|---|---|---|---|---|---|
| `user.registered` | `UserRegisteredEvent` (domain.account) | 온보딩 최초 완료 = 가입 확정. 계정당 1회 | `account` · accountId · 본인 | `accountId` · `gaClientId`(nullable, GA4 귀속용) | `UserRegisteredNotificationListener` (웰컴메일 행 생성, 동기) · `OpsAlertListener` (@Async) · `AnalyticsEventListener` (@Async, [analytics](../analytics/spec.md)) |
| `study_application.submitted` | `StudyApplicationSubmitted` (domain.application) | 스터디 신청 저장 | `study_application` · applicationId · 신청자 | `applicationId` · `studyId` · `studyTitle` · `accountId` · `applicantNickname` | `OpsAlertListener` (@Async) · `AnalyticsEventListener` (@Async, 계정의 첫 신청만) |
| `account.deleted` | `AccountDeleted` (domain.account) | 회원 탈퇴로 계정 삭제 ([user-leave](../user-leave/spec.md)). 계정당 1회 | `account` · accountId · 본인 | `accountId` · `nickname` · `discordUserId`(nullable) · `discordHandle`(nullable) · `studyIds`(탈퇴 직전 ACTIVE·PAUSED) · `navigator`(그중 LEADER 가 있었는지). 커밋 뒤에는 계정 행이 없어 지우기 전 값을 담는다 | `OpsAlertListener` (@Async) — 운영자가 디스코드 role 을 손으로 정리하도록 알린다 |
| `study_participant.joined` | `StudyParticipantJoined` (domain.participant) | 명부에 참여(`ACTIVE`)로 들어옴 — 새 행이든 빠졌던 옛 행을 되살렸든 행마다 1개. 지금 입구는 신청 제출 하나다 ([study-application](../study-application/spec.md) 신청 제출 4단계). 명부 입구는 디스코드 연동을 먼저 검사하므로 이 사람에게는 디스코드 ID 가 있다 | `study_participant` · participantId · 명부에 넣은 사람 (신청이면 본인) | `studyId` · `participantId` · `accountId` · `participantRole`(들어온 때, 신청이면 `MEMBER`) | `StudyRoleSyncListener` — 디스코드 스터디 role 을 명부에 맞춘다 (DSC-07) |
| `study_participant.role_changed` | `StudyParticipantRoleChanged` (domain.participant) | 백오피스 「반 · 역할 한 번에 바꾸기」에서 역할이 실제로 바뀐 명부 행마다 1개. 반만 바뀐 행 · 같은 역할로 보낸 행은 발행하지 않는다 ([study-group](../study-group/spec.md)) | `study_participant` · participantId · 바꾼 캡틴 | `studyId` · `participantId` · `accountId` · `previousRole` · `newRole` | `StudyRoleSyncListener` — LEADER 로 바뀌거나 LEADER 에서 바뀐 행마다 navigator role 을 명부에 맞춘다 (DSC-08) |
| `study_participant.withdrawn` | `StudyParticipantWithdrawn` (domain.participant) | 출석부에서 참여 중단 — 이번에 중단된 명부 행마다 1개. 이미 중단된 행은 발행하지 않는다 ([study-participant](../study-participant/spec.md)) | `study_participant` · participantId · 중단시킨 네비게이터·담당 캡틴 | `studyId` · `participantId` · `accountId` · `participantRole`(중단 직전) · `discordUserId`(중단 시점, 미연동이면 null — 구독자가 돌기 전에 연결을 해제해도 옛 계정에서 role 을 뗀다) | `StudyRoleSyncListener` — 디스코드 스터디 role 을 명부에 맞춘다 (DSC-09). 중단된 사람이 LEADER 면 navigator role 도 맞춘다 (DSC-09) |
| `study_notice.sent` | `StudyNoticeSent` (domain.notice) | 네비게이터·담당 캡틴이 반 공지를 보냄 — 공지 1건마다 1개 ([study-notice](../study-notice/spec.md)) | `study_notice` · noticeId · 보낸 사람 | `noticeId` · `studyId` · `studyGroupId` · `senderAccountId` · `sendEmail` · `sendDiscord` · `recipientCount` (제목·본문·주소는 싣지 않는다) | `StudyNoticeEmailListener` (`BEFORE_COMMIT`, 동기 — 받는 사람마다 메일 행 생성) · `StudyNoticeDiscordListener` (`@Async`, 로비 채널에 글 + 멘션). ops 알림은 보내지 않는다 |

가입 이벤트는 새로 만들지 않고 기존 `UserRegisteredEvent` 를 그대로 쓴다 — 같은 사실에 이벤트가 둘이면 구독자가 어느 쪽을 들을지 갈린다.

## 이벤트로 옮길 후보 (아직 직접 호출)

| 지금 | 위치 | 메모 |
|---|---|---|
| 디스코드 봇 스터디 생성 (`DiscordBotClient.createStudy`) | `StudyDiscordLinkService` | 응답에 봇이 만든 채널·역할 ID 가 필요해 지금은 동기여야 한다. 비동기로 바꾸려면 "연결 대기" 상태와 콜백이 필요하다 |
