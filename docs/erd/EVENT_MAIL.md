# EVENT_MAIL — 행사 메일 발송 기록

캡틴이 행사 상세에서 보낸 **운영자 안내 메일 한 건**(안내 메일 · 취소 안내 메일). 행사 상세 「메일 이력」 탭이 이 테이블을 읽는다.
자동 메일(확인 대기 · 참가 확정 · 참가 불가 · 신청 취소)은 여기 남기지 않는다. 메일 결과는 [NOTIFICATION](./NOTIFICATION.md) 행(받는 사람마다 하나)에서 센다.

> 스펙: [event-mail](../../specs/event-mail/spec.md) · 마이그레이션 `V68__create_event_mail.sql` (domain) · 엔티티 `com.studyclub.domain.event.mail.ClubEventMail` (애그리거트 루트)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | 응답의 `mailId` |
| CLUB_EVENT_ID | BIGINT | N | [CLUB_EVENT](./CLUB_EVENT.md) ID 참조. **FK 없음** (다른 애그리거트) |
| TYPE | VARCHAR(20) | N | `ANNOUNCEMENT`(안내 메일) / `CANCELLATION`(취소 안내 메일) |
| AUDIENCE | VARCHAR(20) | N | 받는 사람 범위. 안내: `ALL` / `ONLINE` / `OFFLINE` (참가 확정자 전체 또는 참여 방식별). 취소 안내: `CANCELLED_ACTIVE` (취소 직전 확인 대기 · 참가 확정이던 신청자) |
| TEMPLATE_ID | BIGINT | N | 보낼 때 쓴 [NOTIFICATION_TEMPLATE](./NOTIFICATION_TEMPLATE.md) ID 참조. FK 없음 — 템플릿을 지워도 기록은 남는다 |
| SUBJECT | VARCHAR(255) | N | 공통 제목 (렌더링 결과) |
| BODY | MEDIUMTEXT | N | 공통 본문 (렌더링 결과). `{{nickname}}` 은 원문 그대로다. 템플릿 본문에 안내 내용 · 일정 · 참여 안내가 더해져 `TEXT` 를 넘을 수 있어 `MEDIUMTEXT` |
| FORMAT | VARCHAR(10) | N | `HTML` / `TEXT`. 템플릿 본문이 앞 공백을 뺀 뒤 `<` 로 시작하면 `HTML` |
| NOTICE | TEXT | N | 운영진이 쓴 안내 내용 (앞뒤 공백 제거, 5,000자 이하 애플리케이션 검증). 수신자별 `NOTIFICATION.PAYLOAD.notice` 와 같은 값. 화면에 내려 주지 않는다 |
| DISPLAY_TIME_ZONE | VARCHAR(64) | N | 공통 본문의 일정을 쓴 시간대 (요청 값 → 캡틴 `ACCOUNT.TIME_ZONE` → 행사 `TIME_ZONE`) |
| RECIPIENT_COUNT | INT | N | 받는 사람 수 (보낸 시점, 탈퇴 계정 제외) |
| SENDER_ACCOUNT_ID | BIGINT | N | 보낸 캡틴 [ACCOUNT](./ACCOUNT.md) ID 참조. FK 없음. 탈퇴로 `ACCOUNT` 가 사라지면 되짚을 수 없다 |
| IDEMPOTENCY_KEY | VARCHAR(36) | N | 보내기 요청의 `Idempotency-Key` (UUID, 소문자). 같은 캡틴 · 같은 키의 재시도는 이 행을 그대로 돌려준다 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity`. `CREATED_AT` 이 보낸 시각이다 |

받는 사람의 주소 · 닉네임은 두지 않는다. 받는 사람은 [EVENT_MAIL_RECIPIENT](./EVENT_MAIL_RECIPIENT.md), 주소는 `NOTIFICATION.RECIPIENT_VALUE` 에 있다.

## 관계

- N : 1 [CLUB_EVENT](./CLUB_EVENT.md) · [NOTIFICATION_TEMPLATE](./NOTIFICATION_TEMPLATE.md) · [ACCOUNT](./ACCOUNT.md) — 모두 ID 참조뿐이다 (애그리거트 간, FK 없음)
- 1 : N [EVENT_MAIL_RECIPIENT](./EVENT_MAIL_RECIPIENT.md) — 같은 애그리거트, FK
- 1 : N [NOTIFICATION](./NOTIFICATION.md) — `NOTIFICATION.REFERENCE_ID` = `EVENT_MAIL.ID`, `EVENT_TYPE ∈ {EVENT_ANNOUNCEMENT, EVENT_CANCELLATION}`. 받는 사람마다 한 행. FK 없음

## 상태

없음. 한 번 쓰면 바꾸지 않는다 (발송 결과는 `NOTIFICATION` 이 갖는다).

## 제약 · 인덱스

- `idx_event_mail_event_created (CLUB_EVENT_ID, CREATED_AT, ID)` — 메일 이력 목록 (최신순 · 페이지)
- `uk_event_mail_sender_key UNIQUE(SENDER_ACCOUNT_ID, IDEMPOTENCY_KEY)` — 같은 보내기 시도의 재시도가 새 행을 만들지 않게. `SENDER_ACCOUNT_ID` 인덱스를 겸한다

## 개인정보 · 탈퇴

- `SENDER_ACCOUNT_ID` 는 ID 참조라 탈퇴 때 손대지 않는다 — `ACCOUNT` 가 지워지면 되짚을 수 없다
- 공통 본문에는 닉네임이 원문 변수(`{{nickname}}`)라 수신자 개인정보가 없다. 안내 내용에 운영진이 쓴 개인정보는 운영진 책임으로 둔다
- 행사는 지우는 API 가 없어 행사 삭제로 생기는 고아 이력은 없다

## 마이그레이션

`V68__create_event_mail.sql` (domain). 수신자별 메일의 템플릿 원문 스냅샷 컬럼은 `V69__notification_template_snapshot.sql`, 템플릿 시드는 `V70__event_mail_templates.sql` (notification).
