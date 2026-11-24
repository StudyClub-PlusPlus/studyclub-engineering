# ADMIN_AUDIT_LOG — 운영 감사 로그

캡틴이 백오피스에서 개인정보를 보거나 권한을 바꾸거나 행사를 취소한 일을 남긴다. 앱 로그(Loki)는 30일이면 지워져서,
「누가 언제 이 사람의 이메일을 봤나」·「누가 이 사람을 캡틴으로 올렸나」에 답하려면 DB 에 남겨야 한다.
**계정 ID·행위·접속 IP·당시 역할**을 담는다. 이메일·닉네임 원문은 넣지 않는다. API에서 수정하지 않으며 보관 기한이 지나면 자동 파기한다. ID와 IP도 개인정보일 수 있다.

> 스펙: [admin-users](../../specs/admin-users/spec.md#감사-로그) · [보관 기한·일일 정리](../../specs/data-retention/spec.md) · [행사 참가자 이메일 보기](../../specs/event-participant/spec.md#이메일-보기) · [행사 취소](../../specs/event-status/spec.md#행사-취소-감사-기록-s4)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACTOR_ACCOUNT_ID | BIGINT | N | 행위한 사람 — 캡틴, `WITHDRAW` 는 네비게이터도. [ACCOUNT](./ACCOUNT.md) ID. FK 없음 |
| ACTION | VARCHAR(20) | N | 아래 |
| TARGET_ACCOUNT_ID | BIGINT | N | 대상 회원. [ACCOUNT](./ACCOUNT.md) ID. FK 없음. `EVENT_CANCEL` 은 대상 회원이 없어 NULL 이 필요하다 — 구현 때 nullable 로 바꾼다 (아래 「구현 반영 메모」) |
| BEFORE_VALUE | VARCHAR(20) | Y | `ROLE_CHANGE` 의 변경 전 `SYSTEM_ROLE` · `WITHDRAW` 의 중단 직전 상태 · `PARTICIPANT_ROLE` 의 변경 전 역할. 권한 말소는 이전 역할, 조회는 NULL |
| AFTER_VALUE | VARCHAR(20) | Y | `ROLE_CHANGE` 의 변경 후 `SYSTEM_ROLE` · `WITHDRAW` · `PARTICIPANT_ROLE` 의 명부 행 ID. 권한 말소는 NONE, 조회는 NULL |
| ACTOR_IP | VARCHAR(45) | Y | 검증된 접속 주소. 과거 기록·요청 문맥 없는 내부 호출은 NULL. 신뢰 프록시 설정은 정리 스펙 참조 |
| PARTICIPANT_ID | BIGINT | Y | 참여 관련 신규 로그의 대상 명부 행 ID. FK 없음 |
| PARTICIPANT_ROLE | VARCHAR(20) | Y | 행위 직전 MEMBER/LEADER. 과거 행의 역할은 추정하지 않음 |
| CLUB_EVENT_ID | BIGINT | Y | **(구현 때 추가)** `EVENT_CANCEL` 의 대상 행사 [CLUB_EVENT](./CLUB_EVENT.md) ID. FK 없음. 그 밖의 행위는 NULL |
| REASON | VARCHAR(30) | Y | 계정 탈퇴 권한 말소는 ACCOUNT_DELETION, 그 밖에는 NULL |
| RETENTION_POLICY | VARCHAR(40) | Y | 적용한 종류·버전 코드. 초기화 전만 NULL, 코드 목록은 공통 스펙 참조 |
| EXPIRES_AT | DATETIME(6) | Y | 저장한 만료 시각. 초기화 전·과거 역할 미상 보류는 NULL |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity`. CREATED_AT 이 행위 시각. 과거 보관 메타데이터 초기화 시 UPDATED_AT만 갱신될 수 있음 |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md) — 행위자 (`ACTOR_ACCOUNT_ID`)
- N : 1 [ACCOUNT](./ACCOUNT.md) — 대상 (`TARGET_ACCOUNT_ID`)

둘 다 **FK 를 걸지 않는다** (애그리거트 사이 — [database-guide](../backend-development-guide/database-guide.md#외래키-정책)).
계정 삭제 뒤에도 기록은 정해진 기한까지 남긴다. 계정 ID만 남았다고 완전한 익명 데이터로 간주하지 않는다.

## 상태 — ACTION

운영 행위의 내용은 저장 후 수정하지 않는다. `ACTION` 은 무슨 일이었는지를 가르는 값이다.

| 값 | 뜻 | BEFORE / AFTER |
|---|---|---|
| `EMAIL_REVEAL` | 백오피스 회원 목록 또는 행사 참가자 목록([event-participant](../../specs/event-participant/spec.md#이메일-보기))에서 한 명의 이메일 원본을 봤다. 어느 화면인지 · 행사 · 신청 ID 는 남기지 않고 이메일 원문도 넣지 않는다 (PR #479 P4). `TARGET_ACCOUNT_ID` = 그 회원(행사 화면이면 신청자) | NULL / NULL |
| `DISCORD_REVEAL` | 백오피스 회원 목록에서 한 명의 디스코드 username을 봤다. 원문은 기록하지 않는다 | NULL / NULL |
| `ROLE_CHANGE` | 계정 권한(`SYSTEM_ROLE`)을 바꿨다. 값이 실제로 바뀐 경우만 | `MEMBER` / `ADMIN` 등 |
| `WITHDRAW` | 출석부에서 참여를 중단시켰다 ([study-participant](../../specs/study-participant/spec.md)). 이번에 중단된 행만. 행위자는 **네비게이터일 수도 있다** | 중단 직전 상태(`ACTIVE` · `PAUSED`) / 중단된 명부 행 ID — 한 사람이 스터디 여럿에 있어 계정 ID 만으로는 어느 행인지 모른다 |
| `PARTICIPANT_ROLE` | 백오피스 신청자 탭에서 명부 행의 역할(네비게이터 지정 · 해제)을 바꿨다 ([study-group](../../specs/study-group/spec.md)). 역할이 실제로 바뀐 행만 | 변경 전 역할(`MEMBER` · `LEADER`) / 명부 행 ID — 역할은 둘뿐이라 변경 후 값은 BEFORE 의 반대다 |
| `OWNER_CAPTAIN` | 백오피스 신청자 탭에서 스터디의 담당 캡틴(`STUDY.OWNER_CAPTAIN_ID`)을 바꿨다 ([study-group](../../specs/study-group/spec.md#담당-캡틴-바꾸기)). 값이 실제로 바뀐 경우만. `TARGET_ACCOUNT_ID` = 새 담당 캡틴 (2026-11-16) | 옛 담당 캡틴 계정 ID(없었으면 NULL) / 스터디 ID |
| `ACCOUNT_ROLE_REVOKE` | 캡틴 본인의 계정 탈퇴로 권한 말소 | ADMIN / NONE |
| `PARTICIPANT_REVOKE` | ACTIVE/PAUSED 네비게이터의 계정 탈퇴로 권한 말소. 참여 행마다 1건 | LEADER / NONE |
| `EVENT_CANCEL` | **(구현 때 추가)** 캡틴이 행사를 실제로 `CANCELLED` 로 바꿨다 — 함께 취소된 신청이 0건이어도 남긴다. 이미 취소된 행사 · 409 실패는 남기지 않는다 ([event-status](../../specs/event-status/spec.md#행사-취소-감사-기록-s4), PR #479 S4). `TARGET_ACCOUNT_ID` = NULL, `CLUB_EVENT_ID` = 행사. 이메일 · 답변 · 취소 안내 본문은 넣지 않는다 | 취소 직전 행사 상태(`PUBLISHED` · `CLOSED`) / 함께 취소된 신청 수(10진 문자열, `0` 포함) |

## 제약

- 인덱스 `(TARGET_ACCOUNT_ID, CREATED_AT)` — 「이 사람에게 무슨 일이 있었나」
- 인덱스 `(ACTOR_ACCOUNT_ID, CREATED_AT)` — 「이 캡틴이 무엇을 했나」
- 인덱스 `(CREATED_AT, ID)` — 발생 시각 조회
- 인덱스 `(EXPIRES_AT, ID)` — 저장한 만료일로 삭제 후보 검사
- 기록은 그 행위와 **같은 트랜잭션**에서 쓴다. 기록이 실패하면 행위도 일어나지 않는다 (앱 레벨)
- 고치거나 지우는 API 는 없다

## 보관과 파기

- 이메일·디스코드 조회와 MEMBER 참여 중단: 행위 시각부터 1년. 법정 2년 의무 대상은 신규 기록에 설정으로 2년을 적용한다. 기존 기한은 별도 검토 없이 바꾸지 않는다.
- 역할 부여·변경·말소와 LEADER 참여 중단: 행위 시각부터 3년.
- 행사 취소(`EVENT_CANCEL`, 구현 때 추가): 행위 시각부터 3년. 규칙 코드 `AUDIT_EVENT_CANCEL_V1`. 권한 기록(제5조 제3항 3년)을 운영 기준으로 준용한 것으로, 이 행위에 법이 기간을 정한 것은 아니다. 권한 기록과 섞이지 않게 코드를 따로 둔다
- 역할 스냅샷이 없는 과거 WITHDRAW: 자동 삭제 보류, 보류 수 관측. 현재 역할로 과거를 추정하지 않는다.
- 하루 간격으로 저장한 `EXPIRES_AT`을 확인하고 만료 행을 물리 삭제한다. 실행 시점의 설정으로 다시 계산하지 않는다.
- IP·당시 역할은 V53, 규칙·만료일은 V55로 추가한다. 현재 과거 기록은 테스트 데이터이므로 당시 V1으로 초기화한다. 조회 1년·권한 3년을 원래 생성일에 더하며, 역할 미상은 보류한다. 이미 채운 규칙·만료일은 재실행해도 유지한다.
- 실제 적용 전 2년 의무 여부·프록시 신뢰 범위를 확인한다. 상세 기준은 [공통 스펙](../../specs/data-retention/spec.md)에 둔다.

## 구현 반영 메모

PR #479(행사 상태 전환 · 참가자 스펙) 리뷰에서 정한 것 중 **아직 스키마에 없는 것**이다. 위 표의 「(구현 때 추가)」 항목은 이 메모대로 구현 PR 에서 마이그레이션과 함께 반영한다. 지금 테이블은 `TARGET_ACCOUNT_ID NOT NULL`, `ACTION VARCHAR(20)` 이다.

| 변경 | 이유 | 구현 PR 에서 할 일 |
|---|---|---|
| `TARGET_ACCOUNT_ID` → nullable | `EVENT_CANCEL` 은 대상이 회원이 아니라 행사다 | `V{n}` 에서 `MODIFY TARGET_ACCOUNT_ID BIGINT NULL`. 기존 행은 모두 값이 있어 데이터 변경 없음. 인덱스 `(TARGET_ACCOUNT_ID, CREATED_AT)` 는 그대로 |
| `CLUB_EVENT_ID BIGINT NULL` 추가 | 행사 취소의 대상 행사 (기존 `PARTICIPANT_ID` 와 같은 방식, FK 없음) | 같은 `V{n}` 에서 추가 |
| `ACTION` 값 `EVENT_CANCEL` | 행사 전체 취소 | `AdminAuditAction.EVENT_CANCEL`. 12자라 `VARCHAR(20)` 그대로 |
| 보관 규칙 `AUDIT_EVENT_CANCEL_V1` (발생일 + 3년) | S4 「필요한 감사 기록 필드와 보관 기준」 | [data-retention](../../specs/data-retention/spec.md) 규칙 코드 표에 추가. 일일 정리는 저장된 `EXPIRES_AT` 으로 지우므로 정리 작업은 바꾸지 않는다 |
| `EMAIL_REVEAL` 사용처 확대 | 행사 참가자 이메일 보기 (P4) | 스키마 변경 없음. 보관 규칙은 기존 조회 기록(`AUDIT_ACCESS_V1`, 2년 설정이면 `AUDIT_ACCESS_TWO_YEARS_V1`) 그대로 |

- 행사 취소 기록 조회 화면 · 운영자 알림은 만들지 않는다
