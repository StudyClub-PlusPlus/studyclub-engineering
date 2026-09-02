# STUDY_PROPOSAL_INTEREST — 제안 관심 표시

제안에 "나도 하고 싶어요". 관심 수가 운영자의 채택 판단 근거.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| PROPOSAL_ID | BIGINT FK → STUDY_PROPOSAL | N | |
| USER_ID | BIGINT FK → USER | N | |
| CREATED_BY / UPDATED_BY | BIGINT FK → USER | Y | drawio 에 있음 — 본인 행위라 USER_ID 와 중복 (아래) |
| CREATED_AT / UPDATED_AT | DATETIME | N | |

## 관계
- N : 1 [STUDY_PROPOSAL](./STUDY_PROPOSAL.md), [USER](./USER.md)

## 상태
없음. 취소 = 행 삭제 (STUDY_BOOKMARK 와 같은 취급).

## 제약
- `UNIQUE(PROPOSAL_ID, USER_ID)`

## 미확정
- `CREATED_BY`/`UPDATED_BY` 는 USER_ID 와 항상 같다 — 빼는 쪽 제안. 유지한다면 이유(운영자 대리 등록?)를 적어둘 것.
