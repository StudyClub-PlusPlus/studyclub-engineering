# 운영자 알림 (ops alerts)

> 상태: 1단계 구현 · 코드: `backend/api/src/main/java/com/studyclub/api/ops/OpsAlertNotifier.java`

## 왜

서비스 초반에는 가입·신청이 한 건 한 건 의미가 있다. 운영자가 DB 나 백오피스를 열어 보지 않아도
"방금 누가 가입했고 어떤 스터디에 신청이 들어왔는지" 를 운영 디스코드 채널에서 바로 보게 한다.

## 계약

| 항목 | 값 |
|---|---|
| 설정 | `OPS_DISCORD_WEBHOOK_URL` (→ `ops.discord-webhook-url`). **비어 있으면 아무것도 하지 않는다** |
| 환경 표시 | `APP_ENV` (→ `ops.env`, 기본 `local`). 제목 접두어 — `production` 없음 · `stage` `[Stage] ` · `beta` `[Beta] ` · 그 밖 `[Local] ` |
| 채널 | 모든 환경이 같은 채널. 접두어로 구분한다 |
| 페이로드 | 임베드 한 장 `{"embeds":[{"title":"<접두어>[StudyClub] <제목>","color":<int>,"fields":[{"name","value","inline":false}],"timestamp":<ISO>}],"allowed_mentions":{"parse":[]}}` |
| 색 | INFO `0x2ECC71` · WARN `0xE67E22` · ERROR `0xE74C3C` |
| 한도 | 필드 값 1000자, 필드 10개 (넘치면 자르고 버린다) |
| 전송 | 백그라운드, 3초 타임아웃. 요청을 막지 않고 예외를 던지지 않는다. 실패는 warn 로그(예외 종류만 — URL 은 토큰이라 로그에 남기지 않는다) |
| 트랜잭션 | 트랜잭션 안에서 부르면 **커밋 뒤에** 보낸다. 롤백된 가입·신청은 알리지 않는다 |
| 개인정보 | 닉네임은 그대로. 이메일은 `ab***@domain.com` 으로 가린다. 토큰·비밀번호·전화번호는 싣지 않는다 |

## 이벤트

| 이벤트 | 레벨 | 필드 | 발생 위치 |
|---|---|---|---|
| 신규 가입 (온보딩 최초 완료) | INFO | 닉네임 · 이메일(마스킹) · 마케팅 동의 | `AccountOnboardingService` — `UserRegisteredEvent` 발행 직후 |
| 스터디 신청 접수 | INFO | 스터디(제목 #id) · 신청자 닉네임 · 신청 ID | `StudyApplicationService.submit` |

아직 없는 것 — 생기면 이 표에 추가한다.

- **신청 승인** — 승인(신청 → 참여자) API 가 아직 없다
- **출석 "첫" 이벤트** — 출석은 디스코드 봇·네비게이터가 회차마다 일괄로 올린다. 운영자가 알아야 할 "처음" 이 정의돼 있지 않다
- **결제** — 결제 기능이 없다

## 새 이벤트를 붙일 때

1. 이 표에 한 줄 추가 (이벤트 · 레벨 · 필드 · 위치)
2. 서비스에서 `opsAlertNotifier.send(Level, "제목", fields)` — 필드는 `LinkedHashMap` 으로 순서를 지킨다
3. 이메일은 `OpsAlertNotifier.maskEmail(...)`. 그 밖의 연락처·자격증명은 넣지 않는다

## 배포

`OPS_DISCORD_WEBHOOK_URL` 과 `APP_ENV` 를 **API 서버**(core-api) 배포 env 에 넣는다. 값은 레포 밖 시크릿 저장소에서 주입한다.
로컬·CI 는 비워 둔다 (→ 보내지 않음).

## 검증

`backend/api/src/test/java/com/studyclub/api/ops/OpsAlertNotifierTest.java` — 로컬 HTTP 서버를 웹훅 자리에 세워
페이로드 모양·접두어·마스킹·자르기와, 웹훅이 비거나 죽어 있어도 던지지 않는 것을 본다. 실제 디스코드로는 보내지 않는다.
