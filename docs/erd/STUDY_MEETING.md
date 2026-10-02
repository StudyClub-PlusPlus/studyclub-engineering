# STUDY_MEETING — 회차

반의 N번째 모임. 출석은 회차 단위로 찍는다. "회차 시작 전 알림 자동화"가 이 행을 보고 돈다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_GROUP_ID | BIGINT FK → STUDY_GROUP | N | |
| SCHEDULED_AT | DATETIME | N | 예정 시각 (UTC) |
| START_AT | DATETIME | Y | 실제 시작 — 반장이 시작 명령 시 기록 |
| END_AT | DATETIME | Y | 실제 종료 |
| TITLE | VARCHAR(50) | Y | 표시용 제목 (`3주차 논문 읽기`). 반복으로 만들면 묶음 전체에 같은 제목 |
| SERIES_ID | VARCHAR(36) | Y | 반복 묶음 ID (UUID). 한 번에 여러 회차를 만들 때 같은 값을 붙인다. 「이후 반복 모두」 삭제가 이 값으로 묶음을 찾는다 |

**회차 번호는 저장하지 않는다** — 분반 회차를 `SCHEDULED_AT` 오름차순으로 센 순번으로 계산한다. 저장하면 추가·삭제·수정 때마다 뒤 회차를 전부 다시 써야 한다.
쓰기 규칙(같은 날 중복 금지 · 31일 상한 · 시작한 회차 수정·삭제 금지)은 [study-meeting 스펙](../../specs/study-meeting/spec.md).

## 관계
- N : 1 [STUDY_GROUP](./STUDY_GROUP.md)
- 1 : N [STUDY_ATTENDANCE](./STUDY_ATTENDANCE.md)

## 상태 (저장하지 않음 — 시각으로 계산)

| 판정 | 조건 |
|---|---|
| `SCHEDULED` | `START_AT IS NULL AND now() < SCHEDULED_AT` |
| `IN_PROGRESS` | `START_AT IS NOT NULL AND END_AT IS NULL` |
| `DONE` | `END_AT IS NOT NULL` |
| `MISSED` | `START_AT IS NULL AND now() > SCHEDULED_AT + 여유` — 열리지 않은 회차 |

## 제약
- 인덱스 `(STUDY_GROUP_ID, SCHEDULED_AT)` — `idx_study_meeting_group_scheduled`

## 미확정
- 취소된 회차 표현 — `CANCELED_AT` 추가할지.
