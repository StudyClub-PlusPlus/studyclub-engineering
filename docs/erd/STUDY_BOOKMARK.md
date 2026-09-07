# STUDY_BOOKMARK — 북마크

회원이 스터디를 찜. 마이페이지 북마크 목록·탐색 카드 하트 상태.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACCOUNT_ID | BIGINT FK → ACCOUNT | N | |
| STUDY_ID | BIGINT FK → STUDY | N | |

## 관계
- N : 1 [ACCOUNT](./ACCOUNT.md), [STUDY](./STUDY.md)

## 상태
없음. 해제 = 행 삭제 (이 테이블만 물리 삭제 허용 — 이력 가치 없음).

## 제약
- `UNIQUE(ACCOUNT_ID, STUDY_ID)`
- 인덱스 `(STUDY_ID)` — 북마크 수 집계

## 미확정
- 조회수(`STUDY_VIEW`) 테이블 — 요구사항에 "조회수 필요". drawio 에는 없음. 별도 테이블 또는 STUDY.VIEW_COUNT 카운터.
