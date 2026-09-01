# STUDY_REVIEW — 후기

참가자가 스터디에 남기는 후기. 지난 스터디 탐색·다음 기수 모집 페이지에 노출.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| USER_ID | BIGINT FK → USER | N | |
| STUDY_ID | BIGINT FK → STUDY | N | |
| CONTENT | TEXT | N | |
| CREATED_AT | DATETIME | N | |

## 관계
- N : 1 [USER](./USER.md), [STUDY](./STUDY.md)

## 상태
없음.

## 제약
- 작성 조건: 해당 STUDY 의 STUDY_PARTICIPANT 였던 사람만 (앱 레벨)
- `UNIQUE(STUDY_ID, USER_ID)` — 한 사람 한 후기 (미확정)

## 미확정
- 별점(`RATING`)·수정(`UPDATED_AT`)·숨김(`IS_HIDDEN`, 운영자 모더레이션) 컬럼.
