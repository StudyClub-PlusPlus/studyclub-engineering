# STUDY_GROUP — 분반

한 기수 안의 시간대별 그룹 (예: 목요일반, 미주반). 참가자·회차·출석은 **분반**에 붙는다.
분반이 하나뿐인 기수도 분반을 1개 만든다 — 그래야 나중에 반을 나눌 때 데이터가 안 움직인다.
**스터디를 만들 때 「기본반」을 하나 같이 만든다.** 신청자는 그 스터디의 첫 반(id 최소 = 기본 반)에 들어간다. 기본 반은 이름을 바꿀 수 있고 지울 수 없다 (2026-10-20, → [share 10-18](../share/2026-10-18-roster-on-apply.md)).

> **STUDY_ID → STUDY (기수) 참조.** 분반은 스터디 프로그램이 아니라 특정 기수에 속한다 —
> 클럽 3기의 목요일반과 4기의 목요일반은 이름이 같아도 다른 행이다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_ID | BIGINT | N | STUDY 참조. 구 `STUDY_COHORT_ID` |
| NAME | VARCHAR(255) | N | 반 제목. `A반` · `미국 금요일반`. 캡틴이 짓는다 — API 가 앞뒤 공백을 자르고 20자(코드포인트) 이하로 받는다 ([study-group 스펙](../../specs/study-group/spec.md)) |
| START_AT | DATETIME | Y | 분반 정규 시작 시각. `LocalDate.EPOCH` 기준 Instant 로 저장 — 시각(HH:mm)만 뜻이 있고 날짜는 무시한다 |
| TIMEZONE | VARCHAR(64) | Y | IANA. 회차 시각 기준 시간대 |
| DAYS_OF_WEEK | VARCHAR(30) | Y | 스터디 요일. 쉼표 구분 소문자 3자 키(`mon,thu`). 미정이면 NULL (V50) |
| CAPACITY | INT | Y | 분반 정원 |
| RULES | VARCHAR(500) | Y | 스터디 규칙 (500자 이하 — 운영 중인 시트의 규칙은 150~350자). 킥오프에서 정하고 네비게이터·캡틴이 고친다. 참여자 전원이 본다 |

## 관계
- N : 1 [STUDY](./STUDY.md)
- 1 : N [STUDY_MEETING](./STUDY_MEETING.md), [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md)

## 상태
없음. 분반의 활성 여부는 부모 STUDY.STATUS 를 따른다.

## 제약
- `UNIQUE(STUDY_ID, NAME)` — `uk_study_group_study_name`
- 인덱스 `(STUDY_ID)` — `idx_study_group_study`

## 미확정
- 반 이동 이력을 별도 테이블에 남길지 — 이동 자체(`STUDY_PARTICIPANT.STUDY_GROUP_ID` 갱신)는 구현됐다 ([study-group 스펙](../../specs/study-group/spec.md)).
