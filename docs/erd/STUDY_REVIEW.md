# STUDY_REVIEW — 후기

참가자가 스터디의 특정 기수에 남기는 후기. 지난 스터디 탐색·다음 기수 모집 페이지에 노출.

> **정본 FK 는 STUDY_COHORT_ID.** 후기는 실제로 참여한 그 기수에 대한 것이다 —
> 3기와 4기의 커리큘럼·운영이 다르면 후기 내용도 그 기수 얘기다. `STUDY_ID` 는
> STUDY_ATTENDANCE 가 STUDY_CLASS_ID 를 비정규화하는 것과 같은 이유로 같이 저장한다:
> 스터디 상세 페이지의 "전체 후기" 조회가 STUDY_COHORT 조인 없이 바로 된다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACCOUNT_ID | BIGINT FK → ACCOUNT | N | |
| STUDY_COHORT_ID | BIGINT FK → STUDY_COHORT | N | 정본. 어느 기수에 대한 후기인지 |
| STUDY_ID | BIGINT FK → STUDY | N | 비정규화 — 스터디 상세 페이지 "전체 후기" 조회용 (STUDY_COHORT_ID 로 도출 가능) |
| CONTENT | TEXT | N | |

## 관계
- N : 1 [ACCOUNT](./ACCOUNT.md), [STUDY_COHORT](./STUDY_COHORT.md), [STUDY](./STUDY.md)

## 상태
없음.

## 제약
- 작성 조건: 해당 STUDY_COHORT 의 STUDY_PARTICIPANT 였던 사람만 (앱 레벨)
- `UNIQUE(STUDY_COHORT_ID, ACCOUNT_ID)` — 한 사람이 참여한 기수마다 후기 1개 (한 스터디를 여러 기수 참여했다면 기수별로 각각 작성 가능)
- 인덱스 `(STUDY_ID, CREATED_AT)` — 스터디 상세 페이지 후기 목록

## 미확정
- 별점(`RATING`)·숨김(`IS_HIDDEN`, 운영자 모더레이션) 컬럼.
- `STUDY_ID` 비정규화 값 정합성 — 애플리케이션에서 INSERT 시 STUDY_COHORT.STUDY_ID 로부터
  채우고, 이후 절대 STUDY_COHORT_ID 없이 단독으로 갱신하지 않는다는 규칙을 어디에 문서화할지.
