# NOTIFICATION_TEMPLATE — 알림 템플릿

이벤트·채널별 메일 문구를 저장한다. V14 마이그레이션이 웰컴메일 한 건을 시딩하고, 캡틴이 백오피스에서 추가·수정·삭제한다(`/api/admin/notification-templates`).

> 스펙: [notification](../../specs/notification/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| EVENT_TYPE | VARCHAR(40) | N | `USER_REGISTERED` · `STUDY_NOTICE` |
| CHANNEL | VARCHAR(20) | N | `EMAIL` |
| SUBJECT | VARCHAR(255) | N | |
| BODY | TEXT | N | `{{nickname}}` 플레이스홀더 포함 |
| UPDATED_AT | DATETIME(6) | N | `BaseEntity` |
| UPDATED_BY_ADMIN_ID | BIGINT | Y | ID 참조([ACCOUNT](./ACCOUNT.md), FK 없음) — 추가·수정한 캡틴. 마이그레이션이 만든 행은 NULL |
| CREATED_AT | DATETIME(6) | N | BaseEntity 생성 시각 |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md), ID 참조뿐 FK 는 없다(애그리거트 간 참조 — database-guide.md 외래키 정책). 관리자 계정이 삭제돼도 UPDATED_BY_ADMIN_ID 는 DB 가 자동으로 지워주지 않는다.
- 1 : N [NOTIFICATION](./NOTIFICATION.md).

## 상태 — STATUS

없음.

## 제약

- `UNIQUE(EVENT_TYPE, CHANNEL)`.
- 인덱스 `idx_notification_template_updated_by_admin (UPDATED_BY_ADMIN_ID)`.
- 이벤트는 USER_REGISTERED · STUDY_NOTICE(V42 시딩), 채널은 EMAIL 뿐이다. 조건마다 템플릿은 한 건이다.
- 템플릿이 없을 때의 영향은 조건마다 다르다 — STUDY_NOTICE 는 메일을 포함한 공지가 롤백된다([notification 스펙](../../specs/notification/spec.md)).
- SUBJECT/BODY 의 `{{nickname}}` 을 발송 시 치환한다.
- 입력 한도(API 검증): SUBJECT 255자, BODY UTF-8 65,535바이트(`TEXT` 한도).
- 템플릿을 지워도 NOTIFICATION 이력은 남는다(TEMPLATE_ID 는 FK 없는 ID 참조).
- UPDATED_BY_ADMIN_ID 는 애그리거트 사이 참조라 FK 를 걸지 않는다 — ID + 인덱스만
  ([database-guide.md 외래키 정책](../backend-development-guide/database-guide.md)). 엔티티 간에도 객체 연관 없이 ID 로만 참조한다.
