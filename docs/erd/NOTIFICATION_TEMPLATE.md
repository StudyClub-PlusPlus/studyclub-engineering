# NOTIFICATION_TEMPLATE — 알림 템플릿

이벤트·채널별 메일 문구를 저장한다. V12 마이그레이션이 웰컴메일 한 건을 시딩하며 편집 API는 별도 기능이다.

> 스펙: [notification](../../specs/notification/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| EVENT_TYPE | VARCHAR(40) | N | `USER_REGISTERED` |
| CHANNEL | VARCHAR(20) | N | `EMAIL` |
| SUBJECT | VARCHAR(255) | N | |
| BODY | TEXT | N | `{{nickname}}` 플레이스홀더 포함 |
| UPDATED_AT | DATETIME(6) | N | `BaseEntity` |
| UPDATED_BY_ADMIN_ID | BIGINT | Y | ID 참조([ACCOUNT](./ACCOUNT.md), FK 없음) — 편집 화면이 아직 없어 이번 구현에서는 항상 NULL(마이그레이션이 만든 행) |
| CREATED_AT | DATETIME(6) | N | BaseEntity 생성 시각 |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md), ID 참조뿐 FK 는 없다(애그리거트 간 참조 — database-guide.md 외래키 정책). 관리자 계정이 삭제돼도 UPDATED_BY_ADMIN_ID 는 DB 가 자동으로 지워주지 않는다.
- 1 : N [NOTIFICATION](./NOTIFICATION.md).

## 상태 — STATUS

없음.

## 제약

- `UNIQUE(EVENT_TYPE, CHANNEL)`.
- 인덱스 `idx_notification_template_updated_by_admin (UPDATED_BY_ADMIN_ID)`.
- 이번 이벤트는 USER_REGISTERED, 채널은 EMAIL 뿐이다.
- 수정 관리자 ID는 현재 NULL이며 SUBJECT/BODY 의 `{{nickname}}` 을 발송 시 치환한다.
- UPDATED_BY_ADMIN_ID 는 애그리거트 사이 참조라 FK 를 걸지 않는다 — ID + 인덱스만
  ([database-guide.md 외래키 정책](../backend-development-guide/database-guide.md)). 엔티티 간에도 객체 연관 없이 ID 로만 참조한다.
