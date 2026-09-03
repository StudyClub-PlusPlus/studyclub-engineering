# STUDY_PROPOSAL_INTEREST — 제안 관심 표시

제안에 "나도 하고 싶어요". 관심 수가 운영자의 채택 판단 근거.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| PROPOSAL_ID | BIGINT FK → STUDY_PROPOSAL | N | |
| USER_ID | BIGINT FK → USER | N | |

## 관계
- N : 1 [STUDY_PROPOSAL](./STUDY_PROPOSAL.md), [USER](./USER.md)

## 상태
없음. 취소 = 행 삭제 (STUDY_BOOKMARK 와 같은 취급).

## 제약
- `UNIQUE(PROPOSAL_ID, USER_ID)`

