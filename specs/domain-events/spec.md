# 도메인 이벤트

> 상태: 1단계 구현 · 실행기: `backend/api/src/main/java/com/studyclub/api/config/AsyncConfig.java`

## 규칙

사실이 생기면 서비스가 도메인 이벤트를 발행하고, 부수효과(ops 알림·메일·외부 연동)는 **구독자**로 붙인다.
서비스 메서드에서 부수효과를 직접 부르지 않는다.

- 이벤트 = Java `record`, 과거형 이름, 얇은 페이로드 (id + 표시용 이름. 비밀값·연락처 원문 금지)
- 이벤트는 사실이 생긴 aggregate 의 `domain` 패키지에 둔다 (`domain.account.UserRegisteredEvent` 와 같은 자리)
- 발행: `ApplicationEventPublisher.publishEvent(...)` — 트랜잭션 안에서
- 구독: 발행하는 서비스와 **다른 빈**에 `@TransactionalEventListener(phase = AFTER_COMMIT)`.
  같은 빈 안에 두면 프록시를 안 거쳐 `@Async` 가 무시된다
- 요청을 막으면 안 되는 구독자는 `@Async` 를 붙이고 `fallbackExecution = true` (트랜잭션 밖 발행도 받는다)
- 구독자는 예외를 삼키고 warn/error 로그만 남긴다 — 이미 커밋된 사실을 되돌릴 수 없다

## 전달 보장

메모리 안 · 커밋 뒤 전달이다. **커밋과 전송 사이에 프로세스가 죽으면 그 이벤트는 사라진다** (outbox 없음).
ops 알림처럼 잃어도 되는 부수효과에 맞다. 잃으면 안 되는 것(메일)은 구독자가 DB 행을 만들고 폴러가 보낸다 —
`specs/notification/spec.md` 의 웰컴메일이 그 방식이다.

`@Async` 실행기는 상한이 있다 — 스레드 2 · 대기열 100. 넘치면 작업을 버리고 warn 로그.

## 이벤트

| 이벤트 | 언제 | 페이로드 | 구독자 |
|---|---|---|---|
| `UserRegisteredEvent` (domain.account) | 온보딩 최초 완료 = 가입 확정. 계정당 1회 | `accountId` | `UserRegisteredNotificationListener` (웰컴메일 행 생성, 동기) · `OpsAlertListener` (@Async) |
| `StudyApplicationSubmitted` (domain.application) | 스터디 신청 저장 | `applicationId` · `studyId` · `studyTitle` · `accountId` · `applicantNickname` | `OpsAlertListener` (@Async) |

가입 이벤트는 새로 만들지 않고 기존 `UserRegisteredEvent` 를 그대로 쓴다 — 같은 사실에 이벤트가 둘이면 구독자가 어느 쪽을 들을지 갈린다.

## 이벤트로 옮길 후보 (아직 직접 호출)

| 지금 | 위치 | 메모 |
|---|---|---|
| 디스코드 봇 스터디 생성 (`DiscordBotClient.createStudy`) | `StudyDiscordLinkService` | 응답에 봇이 만든 채널·역할 ID 가 필요해 지금은 동기여야 한다. 비동기로 바꾸려면 "연결 대기" 상태와 콜백이 필요하다 |
