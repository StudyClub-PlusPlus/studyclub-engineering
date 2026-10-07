# ADMIN_AUDIT_LOG — 운영 감사 로그

캡틴이 백오피스에서 개인정보를 보거나 권한을 바꾼 일을 남긴다. 앱 로그(Loki)는 30일이면 지워져서,
「누가 언제 이 사람의 이메일을 봤나」·「누가 이 사람을 캡틴으로 올렸나」에 답하려면 DB 에 남겨야 한다.
**계정 ID 와 행위만** 담는다 — 이메일·닉네임 같은 개인정보는 넣지 않는다. 어떤 애그리거트에도 속하지 않는 insert-only 로그다.

> 스펙: [admin-accounts](../../specs/admin-accounts/spec.md#감사-로그)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACTOR_ACCOUNT_ID | BIGINT | N | 행위한 캡틴. [ACCOUNT](./ACCOUNT.md) ID. FK 없음 |
| ACTION | VARCHAR(20) | N | 아래 |
| TARGET_ACCOUNT_ID | BIGINT | N | 대상 회원. [ACCOUNT](./ACCOUNT.md) ID. FK 없음 |
| BEFORE_VALUE | VARCHAR(20) | Y | `ROLE_CHANGE` 의 변경 전 `SYSTEM_ROLE`. 그 밖의 ACTION 은 NULL |
| AFTER_VALUE | VARCHAR(20) | Y | `ROLE_CHANGE` 의 변경 후 `SYSTEM_ROLE`. 그 밖의 ACTION 은 NULL |
| CREATED_AT / UPDATED_AT | DATETIME | N | `BaseEntity`. CREATED_AT 이 행위 시각. UPDATED_AT 은 갱신되지 않는다 (insert-only) |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md) — 행위자 (`ACTOR_ACCOUNT_ID`)
- N : 1 [ACCOUNT](./ACCOUNT.md) — 대상 (`TARGET_ACCOUNT_ID`)

둘 다 **FK 를 걸지 않는다** (애그리거트 사이 — [database-guide](../backend-development-guide/database-guide.md#외래키-정책)).
회원이 탈퇴해 `ACCOUNT` 행이 지워져도 기록은 남고, 남은 ID 로는 더 이상 사람을 되짚을 수 없다 —
[user-leave](../../specs/user-leave/spec.md) 의 「식별할 수 없게 처리한 뒤 남긴다」와 같은 방식이다.

## 상태 — ACTION

저장하는 상태는 없다 (insert-only). `ACTION` 은 무슨 일이었는지를 가르는 값이다.

| 값 | 뜻 | BEFORE / AFTER |
|---|---|---|
| `EMAIL_REVEAL` | 백오피스 회원 목록에서 한 명의 이메일 원본을 봤다 | NULL / NULL |
| `ROLE_CHANGE` | 계정 권한(`SYSTEM_ROLE`)을 바꿨다. 값이 실제로 바뀐 경우만 | `MEMBER` / `ADMIN` 등 |

## 제약

- 인덱스 `(TARGET_ACCOUNT_ID, CREATED_AT)` — 「이 사람에게 무슨 일이 있었나」
- 인덱스 `(ACTOR_ACCOUNT_ID, CREATED_AT)` — 「이 캡틴이 무엇을 했나」
- 기록은 그 행위와 **같은 트랜잭션**에서 쓴다. 기록이 실패하면 행위도 일어나지 않는다 (앱 레벨)
- 고치거나 지우는 API 는 없다

## 미확정

- **보관 기간** — 운영진 확인 중. 정해지면 그보다 오래된 행을 지우는 작업을 따로 둔다 ([admin-accounts 미확정](../../specs/admin-accounts/spec.md#미확정))
