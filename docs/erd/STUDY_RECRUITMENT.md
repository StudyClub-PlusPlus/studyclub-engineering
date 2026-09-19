# STUDY_RECRUITMENT — 모집 회차

[STUDY_COHORT](./STUDY_COHORT.md) 의 모집 단위. 기수 하나에 모집 회차가 여러 개 올 수 있다
(예: 1차 모집 마감 후 2차 추가 모집). 모집 기간·정원·제목은 회차마다 독립적으로 설정한다.
[STUDY_APPLICATION](./STUDY_APPLICATION.md) 은 코호트가 아닌 이 모집 회차를 참조한다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| COHORT_ID | BIGINT | N | STUDY_COHORT 참조 (인덱스만, FK 없음) |
| TITLE | VARCHAR(255) | N | 모집 회차 제목 |
| DESCRIPTION | TEXT | N | 모집 상세 설명 |
| START_AT | DATETIME | N | 모집 시작 시각 (UTC) |
| CLOSE_AT | DATETIME | N | 모집 마감 시각 (UTC) |
| RECRUITMENT_CAPACITY | INT | Y | 이 회차 모집 정원. NULL 이면 제한 없음 |

## 관계
- N : 1 [STUDY_COHORT](./STUDY_COHORT.md)
- 1 : N [STUDY_APPLICATION](./STUDY_APPLICATION.md)

## 상태
없음 — 모집중/마감 여부는 `START_AT`·`CLOSE_AT`·`RECRUITMENT_CAPACITY` 로 계산한다. 저장하지 않는다.

## 제약
- 인덱스 `(COHORT_ID)` — 기수별 모집 회차 조회
