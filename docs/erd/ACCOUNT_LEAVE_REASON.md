# ACCOUNT_LEAVE_REASON — 탈퇴 사유

회원 탈퇴 때 고른 사유를 **집계용으로만** 쌓는다. `ACCOUNT_ID` 를 두지 않는다 — 계정이 지워지면 이을 대상도 없고,
사유는 세어 보려는 값이라 개인과 이어질 필요가 없다. 어떤 애그리거트에도 속하지 않는 insert-only 로그다.

> 스펙: [user-leave](../../specs/user-leave/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| REASON | VARCHAR(30) | Y | `NO_DESIRED_STUDY` / `PARTICIPATION_BURDEN` / `OTHER`. 사유를 고르지 않으면 NULL |
| CREATED_AT / UPDATED_AT | DATETIME | N | `BaseEntity`. UPDATED_AT 은 갱신되지 않는다 (insert-only) |

## 관계

없음. [ACCOUNT](./ACCOUNT.md) 를 참조하지 않는다.

## 상태 — STATUS

없음.

## 제약

- 없음. 탈퇴 요청마다 사유 값과 무관하게 1행을 남긴다 — "사유 없음"의 비중과 총 탈퇴 건수도 이 테이블의 count 로 얻는다.
