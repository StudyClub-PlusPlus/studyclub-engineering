# STUDY_MEETING_RETRO_LIKE — 회고 공감

회고(STUDY_MEETING_RETRO) × 문항 × 계정 한 줄. 기한과 상관없이 누르고 취소할 수 있다.
내 회고에는 누르지 못하고, 소감이 빈 칸에는 누르지 못한다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| RETRO_ID | BIGINT FK | N | → STUDY_MEETING_RETRO. CASCADE DELETE |
| SECTION | VARCHAR(16) | N | `GOOD` · `IMPROVE` · `FEELING` |
| ACCOUNT_ID | BIGINT | N | 누른 사람 → ACCOUNT (FK 없음 — 다른 애그리거트). 회고 × 문항 × 계정 유일 |
| CREATED_AT | DATETIME(6) | N | |
| UPDATED_AT | DATETIME(6) | N | |

## 관계

- N : 1 [STUDY_MEETING_RETRO](./STUDY_MEETING_RETRO.md) (FK, CASCADE DELETE)
- N : 1 [ACCOUNT](./ACCOUNT.md) (FK 없음)

## 상태

없음.

## 제약

- `UNIQUE(RETRO_ID, SECTION, ACCOUNT_ID)` — 한 사람이 문항마다 하나
- 인덱스 `(ACCOUNT_ID)` — 내가 누른 공감 목록 조회
