# ADMIN_AUDIT_LOG — 운영 감사 로그

캡틴이 백오피스에서 개인정보를 보거나 권한을 바꾼 일을 남긴다. 앱 로그(Loki)는 30일이면 지워져서,
「누가 언제 이 사람의 이메일을 봤나」·「누가 이 사람을 캡틴으로 올렸나」에 답하려면 DB 에 남겨야 한다.
**계정 ID·행위·접속 IP·당시 역할**을 담는다. 이메일·닉네임 원문은 넣지 않는다. API에서 수정하지 않으며 보관 기한이 지나면 자동 파기한다. ID와 IP도 개인정보일 수 있다.

> 스펙: [admin-users](../../specs/admin-users/spec.md#감사-로그) · [보관 기한·일일 정리](../../specs/data-retention/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACTOR_ACCOUNT_ID | BIGINT | N | 행위한 사람 — 캡틴, `WITHDRAW` 는 네비게이터도. [ACCOUNT](./ACCOUNT.md) ID. FK 없음 |
| ACTION | VARCHAR(20) | N | 아래 |
| TARGET_ACCOUNT_ID | BIGINT | N | 대상 회원. [ACCOUNT](./ACCOUNT.md) ID. FK 없음 |
| BEFORE_VALUE | VARCHAR(20) | Y | `ROLE_CHANGE` 의 변경 전 `SYSTEM_ROLE` · `WITHDRAW` 의 중단 직전 상태 · `PARTICIPANT_ROLE` 의 변경 전 역할. 권한 말소는 이전 역할, 조회는 NULL |
| AFTER_VALUE | VARCHAR(20) | Y | `ROLE_CHANGE` 의 변경 후 `SYSTEM_ROLE` · `WITHDRAW` · `PARTICIPANT_ROLE` 의 명부 행 ID. 권한 말소는 NONE, 조회는 NULL |
| ACTOR_IP | VARCHAR(45) | Y | 검증된 접속 주소. 과거 기록·요청 문맥 없는 내부 호출은 NULL. 신뢰 프록시 설정은 정리 스펙 참조 |
| PARTICIPANT_ID | BIGINT | Y | 참여 관련 신규 로그의 대상 명부 행 ID. FK 없음 |
| PARTICIPANT_ROLE | VARCHAR(20) | Y | 행위 직전 MEMBER/LEADER. 과거 행의 역할은 추정하지 않음 |
| REASON | VARCHAR(30) | Y | 계정 탈퇴 권한 말소는 ACCOUNT_DELETION, 그 밖에는 NULL |
| CREATED_AT / UPDATED_AT | DATETIME | N | `BaseEntity`. CREATED_AT 이 행위 시각. UPDATED_AT 은 갱신되지 않는다 (insert-only) |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md) — 행위자 (`ACTOR_ACCOUNT_ID`)
- N : 1 [ACCOUNT](./ACCOUNT.md) — 대상 (`TARGET_ACCOUNT_ID`)

둘 다 **FK 를 걸지 않는다** (애그리거트 사이 — [database-guide](../backend-development-guide/database-guide.md#외래키-정책)).
계정 삭제 뒤에도 기록은 정해진 기한까지 남긴다. 계정 ID만 남았다고 완전한 익명 데이터로 간주하지 않는다.

## 상태 — ACTION

저장하는 상태는 없다 (insert-only). `ACTION` 은 무슨 일이었는지를 가르는 값이다.

| 값 | 뜻 | BEFORE / AFTER |
|---|---|---|
| `EMAIL_REVEAL` | 백오피스 회원 목록에서 한 명의 이메일 원본을 봤다 | NULL / NULL |
| `DISCORD_REVEAL` | 백오피스 회원 목록에서 한 명의 디스코드 username을 봤다. 원문은 기록하지 않는다 | NULL / NULL |
| `ROLE_CHANGE` | 계정 권한(`SYSTEM_ROLE`)을 바꿨다. 값이 실제로 바뀐 경우만 | `MEMBER` / `ADMIN` 등 |
| `WITHDRAW` | 출석부에서 참여를 중단시켰다 ([study-participant](../../specs/study-participant/spec.md)). 이번에 중단된 행만. 행위자는 **네비게이터일 수도 있다** | 중단 직전 상태(`ACTIVE` · `PAUSED`) / 중단된 명부 행 ID — 한 사람이 스터디 여럿에 있어 계정 ID 만으로는 어느 행인지 모른다 |
| `PARTICIPANT_ROLE` | 백오피스 신청자 탭에서 명부 행의 역할(네비게이터 지정 · 해제)을 바꿨다 ([study-group](../../specs/study-group/spec.md)). 역할이 실제로 바뀐 행만 | 변경 전 역할(`MEMBER` · `LEADER`) / 명부 행 ID — 역할은 둘뿐이라 변경 후 값은 BEFORE 의 반대다 |

| `ACCOUNT_ROLE_REVOKE` | 캡틴 본인의 계정 탈퇴로 권한 말소 | ADMIN / NONE |
| `PARTICIPANT_REVOKE` | ACTIVE/PAUSED 네비게이터의 계정 탈퇴로 권한 말소. 참여 행마다 1건 | LEADER / NONE |

## 제약

- 인덱스 `(TARGET_ACCOUNT_ID, CREATED_AT)` — 「이 사람에게 무슨 일이 있었나」
- 인덱스 `(ACTOR_ACCOUNT_ID, CREATED_AT)` — 「이 캡틴이 무엇을 했나」
- 인덱스 `(CREATED_AT, ID)` — 만료 후보 검사
- 기록은 그 행위와 **같은 트랜잭션**에서 쓴다. 기록이 실패하면 행위도 일어나지 않는다 (앱 레벨)
- 고치거나 지우는 API 는 없다

## 보관과 파기

- 이메일·디스코드 조회와 MEMBER 참여 중단: 행위 시각부터 1년. 법정 2년 의무 대상은 설정으로 2년 적용한다.
- 역할 부여·변경·말소와 LEADER 참여 중단: 행위 시각부터 3년.
- 역할 스냅샷이 없는 과거 WITHDRAW: 자동 삭제 보류, 보류 수 관측. 현재 역할로 과거를 추정하지 않는다.
- 하루 간격으로 달력상 만료를 확인하고 행을 물리 삭제한다. 신규 컬럼은 V53으로 추가하며 기존 값은 NULL로 둔다.
- 실제 적용 전 2년 의무 여부·프록시 신뢰 범위를 확인한다. 상세 기준은 [공통 스펙](../../specs/data-retention/spec.md)에 둔다.
