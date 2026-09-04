# STUDY_MEETING — 회차

반의 N번째 모임. 출석은 회차 단위로 찍는다. "세션 시작 전 알림 자동화"가 이 행을 보고 돈다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_CLASS_ID | BIGINT FK → STUDY_CLASS | N | |
| SCHEDULED_AT | DATETIME | N | 예정 시각 (UTC) |
| STARTS_AT | DATETIME | Y | 실제 시작 — 반장이 시작 명령 시 기록 |
| ENDS_AT | DATETIME | Y | 실제 종료 |

## 관계
- N : 1 [STUDY_CLASS](./STUDY_CLASS.md)
- 1 : N [STUDY_ATTENDANCE](./STUDY_ATTENDANCE.md)

## 상태 (저장하지 않음 — 시각으로 계산)

| 판정 | 조건 |
|---|---|
| `SCHEDULED` | `STARTS_AT IS NULL AND now() < SCHEDULED_AT` |
| `IN_PROGRESS` | `STARTS_AT IS NOT NULL AND ENDS_AT IS NULL` |
| `DONE` | `ENDS_AT IS NOT NULL` |
| `MISSED` | `STARTS_AT IS NULL AND now() > SCHEDULED_AT + 여유` — 열리지 않은 회차 |

## 제약
- 인덱스 `(STUDY_CLASS_ID, SCHEDULED_AT)`

## 미확정
- 회차 번호(`SESSION_NO`)·제목(`TITLE`) — 표 설계에 있음. "3주차 논문 읽기" 같은 표시용.
- 취소된 회차 표현 — `CANCELED_AT` 추가할지.
