# EVENT_MAIL_RECIPIENT — 행사 메일을 받는 사람

[EVENT_MAIL](./EVENT_MAIL.md) 한 건을 받는 사람 한 명당 한 행. 보낸 시점의 받는 사람 스냅샷이다. 메일 애그리거트 안이라 메일에 외래키를 둔다.

> 스펙: [event-mail](../../specs/event-mail/spec.md) · 엔티티 `com.studyclub.domain.event.mail.ClubEventMailRecipient`

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| EVENT_MAIL_ID | BIGINT FK → EVENT_MAIL | N | |
| ACCOUNT_ID | BIGINT | N | ID 참조([ACCOUNT](./ACCOUNT.md)). 보낸 시점에 계정이 남아 있던 사람만 |
| REGISTRATION_ID | BIGINT | N | ID 참조([CLUB_EVENT_REGISTRATION](./CLUB_EVENT_REGISTRATION.md)). 이 사람이 받게 된 신청. 재발송 판정(그 신청이 지금 `CONFIRMED` 인가 · `EVENT_CANCELLED` 로 취소됐나)에 쓴다 |
| CHANNEL | VARCHAR(20) | N | `ONLINE` / `OFFLINE`. 그 신청의 참여 방식 사본. 수신자별 본문의 참여 안내를 이 방식 하나로 채운다 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity` |

주소 · 닉네임은 두지 않는다. 주소는 수신자별 `NOTIFICATION.RECIPIENT_VALUE` 에 있다.

## 관계

- N : 1 [EVENT_MAIL](./EVENT_MAIL.md) — 같은 애그리거트, FK `fk_event_mail_recipient_mail`. 행은 메일을 통해서만 만든다
- N : 1 [ACCOUNT](./ACCOUNT.md) · [CLUB_EVENT_REGISTRATION](./CLUB_EVENT_REGISTRATION.md) — ID 참조뿐이다 (애그리거트 간, FK 없음). 회원이 탈퇴해 `ACCOUNT` 행이 지워지면 되짚을 수 없어 따로 비식별할 것이 없다 ([STUDY_NOTICE_RECIPIENT](./STUDY_NOTICE_RECIPIENT.md) 와 같은 원칙)

## 상태

없음.

## 제약

- `uk_event_mail_recipient_mail_account UNIQUE(EVENT_MAIL_ID, ACCOUNT_ID)` — 한 메일에 같은 사람은 한 번

## 마이그레이션

`V68__create_event_mail.sql` (domain).
