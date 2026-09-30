# STUDY_GROUP — 분반

한 기수 안의 시간대별 그룹 (예: 목요일반, 미주반). 참가자·회차·출석은 **분반**에 붙는다.
분반이 하나뿐인 기수도 분반을 1개 만든다 — 그래야 나중에 반을 나눌 때 데이터가 안 움직인다.

> **STUDY_ID → STUDY (기수) 참조.** 분반은 스터디 프로그램이 아니라 특정 기수에 속한다 —
> 클럽 3기의 목요일반과 4기의 목요일반은 이름이 같아도 다른 행이다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_ID | BIGINT | N | STUDY 참조. 구 `STUDY_COHORT_ID` |
| NAME | VARCHAR(255) | N | `목요일반` |
| START_AT | TIME | Y | 분반 정규 시작 시각 |
| TIMEZONE | VARCHAR(64) | Y | IANA. 회차 시각 기준 시간대 |
| CAPACITY | INT | Y | 분반 정원 |

## 관계
- N : 1 [STUDY](./STUDY.md)
- 1 : N [STUDY_MEETING](./STUDY_MEETING.md), [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md)

## 상태
없음. 분반의 활성 여부는 부모 STUDY.STATUS 를 따른다.

## 제약
- `UNIQUE(STUDY_ID, NAME)` — `uk_study_group_study_name`
- 인덱스 `(STUDY_ID)` — `idx_study_group_study`

## 미확정
- 요일(`WEEKDAY MON~SUN`) 컬럼 — 반복 회차 자동 생성하려면 필요.
- 멤버의 분반 이동은 STUDY_PARTICIPANT.STUDY_GROUP_ID 갱신 + 이력 남길지.
