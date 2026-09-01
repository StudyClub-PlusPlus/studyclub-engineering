# STUDY_SECTION — 반

한 스터디 안의 시간대별 그룹 (예: 목요일반, 미주반). 참가자·회차·출석은 **반**에 붙는다.
반이 하나뿐인 스터디도 반을 1개 만든다 — 그래야 나중에 반을 나눌 때 데이터가 안 움직인다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_ID | BIGINT FK → STUDY | N | |
| NAME | VARCHAR(50) | N | `목요일반` |
| STARTS_AT | TIME | Y | 반 정규 시작 시각 (요일은 미확정 — 아래) |
| STANDARD_TIMEZONE | VARCHAR(64) | Y | IANA. 회차 시각 기준 시간대 |
| CAPACITY | INT | Y | 반 정원 |
| CREATED_AT / UPDATED_AT | DATETIME | N | |

## 관계
- N : 1 [STUDY](./STUDY.md)
- 1 : N [STUDY_SESSION](./STUDY_SESSION.md), [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md), [STUDY_INTEREST](./STUDY_INTEREST.md)

## 상태
없음. 반의 활성 여부는 부모 STUDY.STATUS 를 따른다.

## 제약
- `UNIQUE(STUDY_ID, NAME)`

## 미확정
- 요일(`WEEKDAY MON~SUN`) 컬럼 — 표 설계에 있음. 반복 회차 자동 생성하려면 필요.
- 멤버의 반 이동은 STUDY_PARTICIPANT.STUDY_SECTION_ID 갱신 + 이력 남길지.
- 감사 컬럼(`CREATED_BY/UPDATED_BY`) 추가 여부 — 운영자가 만지는 테이블이라 규약상 넣는 쪽.
