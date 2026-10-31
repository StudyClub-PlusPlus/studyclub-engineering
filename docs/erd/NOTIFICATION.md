# NOTIFICATION — 알림 발송 이력

알림 수신처·닉네임 스냅샷과 발송 상태를 저장한다. 웰컴메일은 온보딩 커밋 이후 별도 트랜잭션으로, 반 공지·문의 회신 메일은 공지·회신을 저장하는 트랜잭션 안(`BEFORE_COMMIT`)에서 생성한다.

> 스펙: [notification](../../specs/notification/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| EVENT_TYPE | VARCHAR(40) | N | `USER_REGISTERED`(웰컴메일) · `STUDY_NOTICE`(반 공지) · `FEEDBACK_REPLIED`(문의 회신) |
| RECIPIENT_TYPE | VARCHAR(20) | N | 이번 구현에서 쓰는 값은 `EMAIL` 뿐. `DISCORD` 는 정의하지 않는다 |
| RECIPIENT_VALUE | VARCHAR(255) | N | 발송 시점 이메일 스냅샷 (나중에 회원이 이메일을 바꿔도 이 값은 그대로) |
| RECIPIENT_USER_ID | BIGINT | Y | ID 참조([ACCOUNT](./ACCOUNT.md), FK 없음) — 웰컴메일은 항상 본인 수신이라 이번 구현에서는 NULL 이 나오지 않는다. 컬럼 자체는 nullable(운영 공용 발송 등 미래 대비) |
| TEMPLATE_ID | BIGINT | N | ID 참조([NOTIFICATION_TEMPLATE](./NOTIFICATION_TEMPLATE.md), FK 없음) |
| REFERENCE_ID | BIGINT | Y | 이 알림을 만든 쪽의 ID 참조 — `STUDY_NOTICE` 면 [STUDY_NOTICE](./STUDY_NOTICE.md).ID (FK 없음). `FEEDBACK_REPLIED` 면 [FEEDBACK](./FEEDBACK.md).ID. 웰컴메일은 NULL. 인덱스 `(EVENT_TYPE, REFERENCE_ID)` |
| SENDER_ACCOUNT_ID | BIGINT | Y | 이 알림을 보낸 사람의 [ACCOUNT](./ACCOUNT.md).ID 참조 (FK 없음). 공지 메일만 채우고 나머지는 NULL. 보낸 사람이 탈퇴하면 이 값으로 그가 보낸 메일 행을 찾아 보낸 사람 이름을 비식별화한다 — 공지는 스터디 삭제로 사라질 수 있어 `REFERENCE_ID` 로는 되짚지 못한다. 인덱스 `(SENDER_ACCOUNT_ID)` |
| PAYLOAD | JSON | N | `USER_REGISTERED` 는 `{"nickname": "..."}`, `STUDY_NOTICE` 는 `{"studyTitle","groupName","senderName","title","body"}` — 보낸 사람이 탈퇴하면 `senderName` 을 「탈퇴한 회원」으로 치환한다([user-leave](../../specs/user-leave/spec.md#스터디-공지를-보낸-사람이-탈퇴하는-경우)). 리스너가 INSERT 시점에 `ACCOUNT.NICKNAME` 을 읽어 스냅샷 (발송 시점에 다시 조회하지 않음 — RECIPIENT_VALUE 와 같은 이유) |
| STATUS | VARCHAR(20) | N | `PENDING`/`PROCESSING`/`SENT`/`FAILED`/`CANCELLED` |
| LOCKED_AT | DATETIME(6) | Y | PROCESSING 전환 시각. 재수거 판단 기준이자 클레임 토큰(재수거로 값이 달라지면 이전 클레임의 완료 처리를 무시한다) |
| ERROR_TYPE | VARCHAR(30) | Y | FAILED 일 때만. `TEMPLATE_MISSING`/`INVALID_RECIPIENT`/`PROVIDER_ERROR`/`UNKNOWN`. 자동 재시도 판단에는 안 쓴다(이번 구현엔 자동 재시도가 없음) — 실패 원인을 나중에 사람이 보기 위한 값 |
| SCHEDULED_AT | DATETIME(6) | Y | 이번 구현에서는 항상 NULL(즉시 발송). 시간 트리거형 이벤트를 위해 컬럼만 미리 둔다 |
| SENT_AT | DATETIME(6) | Y | 발송 성공 시각 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity` |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md), ID 참조뿐 FK 는 없다(애그리거트 간 참조 — database-guide.md 외래키 정책). 계정이 삭제돼도 RECIPIENT_USER_ID 는 DB 가 자동으로 지워주지 않는다.
- N : 1 [NOTIFICATION_TEMPLATE](./NOTIFICATION_TEMPLATE.md), 마찬가지로 ID 참조뿐이라 사용 중인 템플릿도 삭제될 수 있다 — 백오피스에서 템플릿을 지워도 이미 만든 발송 이력은 남고, 지운 템플릿을 가리키는 `PENDING` 행은 발송 때 `TEMPLATE_MISSING` 으로 실패한다.
- **같은 조건에 템플릿이 N개면 알림 한 건(가입 한 번, 공지 수신자 한 명)마다 이 테이블에 N행이 생긴다** — 행마다 `TEMPLATE_ID` 가 다르다. 재발송·탈퇴 비식별화·`CANCELLED` 전이는 행 단위라 그대로다. `STUDY_NOTICE` 의 공지별 메일 건수는 행 수가 아니라 받는 사람(`RECIPIENT_USER_ID`) 수 기준으로 센다([study-notice 스펙](../../specs/study-notice/spec.md)).

## 상태 — STATUS

```mermaid
stateDiagram-v2
    [*] --> PENDING : 리스너가 INSERT
    PENDING --> PROCESSING : 폴링 스케줄러가 클레임
    PROCESSING --> SENT : SES 발송 성공
    PROCESSING --> FAILED : SES 발송 실패 (error_type 기록)
    PROCESSING --> PENDING : 재수거 (locked_at 타임아웃 — 인스턴스 재시작 등)
    PENDING --> CANCELLED : 수신 계정 탈퇴 — 발송 시도 전에 취소
    SENT --> [*]
    FAILED --> PENDING : 운영자가 재발송 (아래)
    FAILED --> [*]
    CANCELLED --> [*]
```

`CANCELLED` 는 `FAILED` 와 구분한다 — `FAILED` 는 발송을 시도했다가 실패한 것(`ERROR_TYPE` 기록),
`CANCELLED` 는 발송 시도 전에 수신자가 탈퇴해 더 보낼 이유가 없어진 것이다. `ERROR_TYPE` 은 `FAILED`
전용이라 `CANCELLED` 에는 채우지 않는다. 트리거는 [user-leave spec](../../specs/user-leave/spec.md#알림-비식별화)
의 `DELETE /api/me` 뿐이다.

재발송은 운영자가 고른 `FAILED` 행을 **그 행 그대로** `PENDING` 으로 되돌린다 — 새 행을 만들지 않는다(알림 하나에 줄
하나, 시도 이력 없음). `ERROR_TYPE`·`LOCKED_AT` 은 비워진다. **스키마 변경은 없다.**
조건과 API 는 [spec](../../specs/notification/spec.md#재발송-가능-조건).

## 제약

- 인덱스 `idx_notification_status_created (STATUS, CREATED_AT)`, `idx_notification_recipient_user (RECIPIENT_USER_ID)`, `idx_notification_template (TEMPLATE_ID)`.
- PAYLOAD 는 MySQL JSON. 이메일·닉네임 원문은 발송에만 사용하며 조회 응답에서 이메일을 마스킹한다.
- PROCESSING 은 5분 초과 시 재수거한다. FAILED 는 **자동으로는 재시도하지 않는다**. 운영자가 고른 건만 그 행을 `PENDING` 으로 되돌려 재발송한다.
- RECIPIENT_USER_ID·TEMPLATE_ID 는 애그리거트 사이 참조라 FK 를 걸지 않는다 — ID + 인덱스만
  ([database-guide.md 외래키 정책](../backend-development-guide/database-guide.md)). 엔티티 간에도 객체 연관 없이 ID 로만 참조한다.

문의 회신 payload 는 `nickname` · `feedbackUrl` 뿐이다. 답변·첨부·캡틴 메모는 담지 않는다. 첫 회신마다 등록된 템플릿 수만큼 예약하고 수정은 추가 예약하지 않는다.
