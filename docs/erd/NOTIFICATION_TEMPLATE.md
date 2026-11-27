# NOTIFICATION_TEMPLATE — 알림 템플릿

이벤트·채널별 메일 문구를 저장한다. V14 마이그레이션이 웰컴메일 한 건을 시딩하고, 캡틴이 백오피스에서 추가·수정·삭제한다(`/api/admin/notification-templates`).

> 스펙: [notification](../../specs/notification/spec.md) · 행사 여섯 조건은 [event-mail](../../specs/event-mail/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| EVENT_TYPE | VARCHAR(40) | N | `USER_REGISTERED` · `STUDY_NOTICE` · `FEEDBACK_REPLIED` · 행사 여섯: `EVENT_ANNOUNCEMENT` · `EVENT_CANCELLATION` · `EVENT_REGISTRATION_PENDING` · `EVENT_REGISTRATION_CONFIRMED` · `EVENT_REGISTRATION_DECLINED` · `EVENT_REGISTRATION_CANCELLED` |
| CHANNEL | VARCHAR(20) | N | `EMAIL` |
| SUBJECT | VARCHAR(255) | N | |
| BODY | TEXT | N | 치환 변수 포함 — `USER_REGISTERED` 는 `{{nickname}}`, `STUDY_NOTICE` 는 `{{studyTitle}}`·`{{groupName}}`·`{{senderName}}`·`{{title}}`·`{{body}}`, `FEEDBACK_REPLIED` 는 `{{nickname}}`·`{{feedbackUrl}}`. 행사 여섯 조건은 저장 때 허용 변수만 받는다 — `EVENT_ANNOUNCEMENT` 는 `{{nickname}}`·`{{eventTitle}}`·`{{channel}}`·`{{eventSchedule}}`·`{{participation}}`·`{{notice}}`(`{{notice}}` 필수), `EVENT_CANCELLATION` 은 `{{nickname}}`·`{{eventTitle}}`·`{{notice}}`(`{{notice}}` 필수), `EVENT_REGISTRATION_CONFIRMED` 는 `{{nickname}}`·`{{eventTitle}}`·`{{eventSchedule}}`·`{{channel}}`·`{{participation}}`, 나머지 자동 세 조건은 `{{nickname}}`·`{{eventTitle}}`·`{{eventSchedule}}`·`{{channel}}` ([event-mail 「템플릿 검증」](../../specs/event-mail/spec.md#템플릿-검증-notification-스펙에-더한다)) |
| UPDATED_AT | DATETIME(6) | N | `BaseEntity` |
| UPDATED_BY_ADMIN_ID | BIGINT | Y | ID 참조([ACCOUNT](./ACCOUNT.md), FK 없음) — 추가·수정한 캡틴. 마이그레이션이 만든 행은 NULL |
| CREATED_AT | DATETIME(6) | N | BaseEntity 생성 시각 |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md), ID 참조뿐 FK 는 없다(애그리거트 간 참조 — database-guide.md 외래키 정책). 관리자 계정이 삭제돼도 UPDATED_BY_ADMIN_ID 는 DB 가 자동으로 지워주지 않는다.
- 1 : N [NOTIFICATION](./NOTIFICATION.md). 같은 조건에 템플릿이 N개면 알림 한 건(가입 한 번, 공지 수신자 한 명)마다 NOTIFICATION 행이 N개 생긴다. 행사 여섯 조건은 예외로 한 행이다 (아래 「제약」).
- 1 : N [EVENT_MAIL](./EVENT_MAIL.md) — `EVENT_MAIL.TEMPLATE_ID` 가 보낼 때 쓴 템플릿을 ID 로 가리킨다. FK 없음

## 상태 — STATUS

없음.

## 제약

- 유일 제약은 없다 — **같은 조건(`EVENT_TYPE`, `CHANNEL`)에 템플릿을 여럿 둘 수 있고, 그 조건이 생기면 모두 발송한다.** 같은 조건·같은 제목도 막지 않는다. (V14 의 `UNIQUE(EVENT_TYPE, CHANNEL)` 은 V50 이 걷어낸다.)
- **행사 여섯 조건은 다르다** — 같은 조건의 `EMAIL` 템플릿 중 **`ID` 가 가장 작은 한 건만** 쓴다 (`ORDER BY ID ASC LIMIT 1`, event-mail M1). 그 템플릿을 지우거나 다른 조건으로 옮기면 남은 것 중 ID 가 가장 작은 템플릿을 쓴다
- 인덱스 `idx_notification_template_event_channel (EVENT_TYPE, CHANNEL)` — 조건의 템플릿 목록 조회용 (V50).
- 인덱스 `idx_notification_template_updated_by_admin (UPDATED_BY_ADMIN_ID)`.
- 이벤트는 USER_REGISTERED · STUDY_NOTICE(V42 시딩) · FEEDBACK_REPLIED(V52 시딩) · 행사 여섯 조건(V70 시딩), 채널은 EMAIL 뿐이다. 조건마다 템플릿은 여럿일 수 있다.
- 조건에 템플릿이 하나도 없을 때의 영향은 조건마다 다르다 (아래 「템플릿이 하나도 없으면」). 기존 세 조건은 여럿 중 하나를 지우면 그 템플릿의 메일만 멈춘다.
- SUBJECT/BODY 의 `{{변수}}` 를 발송 시 `NOTIFICATION.PAYLOAD` 값으로 치환한다.
- 입력 한도(API 검증): SUBJECT 255자, BODY UTF-8 65,535바이트(`TEXT` 한도).
- 템플릿을 지워도 NOTIFICATION 이력은 남는다(TEMPLATE_ID 는 FK 없는 ID 참조).
- UPDATED_BY_ADMIN_ID 는 애그리거트 사이 참조라 FK 를 걸지 않는다 — ID + 인덱스만
  ([database-guide.md 외래키 정책](../backend-development-guide/database-guide.md)). 엔티티 간에도 객체 연관 없이 ID 로만 참조한다.

## 템플릿이 하나도 없으면

| 조건 | 그 조건의 `EMAIL` 템플릿이 없으면 | 근거 |
|---|---|---|
| `USER_REGISTERED` | 알림 행을 만들지 못하고 에러 로그만 남긴다. 가입은 영향이 없다 (`AFTER_COMMIT`) | [notification 「지운 뒤의 동작」](../../specs/notification/spec.md#delete-apiadminnotification-templatesid) |
| `STUDY_NOTICE` | 메일을 포함한 공지는 저장 자체가 롤백된다. 디스코드만 보내는 공지는 영향이 없다 | 같음 |
| `FEEDBACK_REPLIED` | 첫 회신 · 완료 저장이 롤백된다. 이미 있는 답변 수정에는 영향이 없다 | 같음 |
| `EVENT_ANNOUNCEMENT` · `EVENT_CANCELLATION` (운영자 안내) | 보내기가 409 `EVENT_MAIL_TEMPLATE_MISSING` 으로 막힌다. 작성 창은 미리 `blockedReason = TEMPLATE_MISSING` 으로 알린다. 아무것도 저장하지 않는다 | [event-mail 「템플릿이 없을 때 (M2)」](../../specs/event-mail/spec.md#템플릿이-없을-때-m2) |
| `EVENT_REGISTRATION_*` 네 조건 (자동) | 신청 접수 · 참가 처리 · 개별 · 본인 취소 · 종료 자동 전환은 **그대로 커밋**하고 그 메일만 건너뛴다. 운영 채널에 누락 경보(WARN, `(eventType, clubEventId)` 10분 묶음)를 보낸다. 템플릿을 되살려도 건너뛴 메일을 소급해 보내지 않는다 | 같음 |

- 행사 조건의 예외는 템플릿이 **없을 때만**이다. 템플릿은 있는데 메일 행 저장이 DB 오류로 실패하면 처리 전체가 롤백된다
- 이미 예약한 행사 메일 행은 템플릿 원문 스냅샷(`NOTIFICATION.SUBJECT_TEMPLATE` · `BODY_TEMPLATE`)이 있어 템플릿을 지워도 영향이 없다

## 마이그레이션

`V14__notification_schema.sql` (테이블 · 웰컴메일 시드), `V50__notification_template_multi.sql` (유일 제약 제거), 시드 `V42__study_notice_email.sql` · `V52__feedback_replied_email.sql` · `V70__event_mail_templates.sql` (행사 여섯 조건).
