# STUDY_RECRUITMENT — 모집 회차

[STUDY](./STUDY.md) 의 모집 단위. 기수 하나에 모집 회차가 여러 개 올 수 있다
(예: 1차 모집 마감 후 2차 추가 모집). 모집 기간·정원·제목은 회차마다 독립적으로 설정한다.
[STUDY_APPLICATION](./STUDY_APPLICATION.md) 은 이 모집 회차를 참조한다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_ID | BIGINT | N | STUDY 참조 (인덱스만, FK 없음) |
| TITLE | VARCHAR(255) | N | 모집 회차 제목 |
| DESCRIPTION | TEXT | N | 모집 상세 설명 |
| START_AT | DATETIME | Y | 모집 시작 시각 (UTC). 캡틴이 모집을 시작하면 `STUDY.STATUS: DRAFT → OPEN` 과 함께 채워지고, 공개를 취소하면 비운다. 등록 직후는 NULL (V49 전에는 NOT NULL 이라 등록 시각이 들어갔다). 사실 데이터일 뿐, 공개 판정은 `STUDY.STATUS` 로 한다([STUDY ERD](./STUDY.md#공개-여부)). 신청 폼 잠금이 이 값을 본다 |
| RECRUIT_DEADLINE_AT | DATETIME | N | 모집 마감 시각 (UTC). 상시 모집은 없다 — 항상 마감이 있다. 계획된 hard cutoff — 정원 도달로 인한 조기 마감은 계산으로 판정 |
| RECRUITMENT_CAPACITY | INT | Y | 이 회차 모집 정원. NULL 이면 제한 없음 |
| RECRUITMENT_TZ_MODE | VARCHAR(16) | N | 모집 시간대 모드 `unset` · `all` · `selected`. 기본 `unset` (V68). `selected` 의 지역은 [STUDY_RECRUITMENT_ZONE](./STUDY_RECRUITMENT_ZONE.md). [timezone 스펙](../../specs/timezone/spec.md) §4.2 |

`RECRUIT_DEADLINE_AT` 은 시간대 확장 이관에서 바꾸지 않았다 — 날짜만 고르던 시절의 마감도 저장된 UTC 로만 판정한다 ([timezone §4.5](../../specs/timezone/spec.md) A안). 새로 날짜 칸으로 받은 마감은 요청의 표시 시간대 23:59:59 를 UTC 로 바꿔 저장한다.

## 관계
- N : 1 [STUDY](./STUDY.md)
- 1 : N [STUDY_APPLICATION](./STUDY_APPLICATION.md)
- 1 : N [STUDY_RECRUITMENT_ZONE](./STUDY_RECRUITMENT_ZONE.md) (모집 지역, `selected` 모드)

## 상태
없음 — 모집중/마감 여부는 `START_AT`·`RECRUIT_DEADLINE_AT`·`RECRUITMENT_CAPACITY` 로 계산한다. (시작·마감 일자는 화면·기획 문서에서 `start_date` · `end_date` 로 부르기도 한다.) 저장하지 않는다.

## 제약
- 인덱스 `(STUDY_ID)` — 기수별 모집 회차 조회
