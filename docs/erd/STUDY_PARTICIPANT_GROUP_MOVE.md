# STUDY_PARTICIPANT_GROUP_MOVE — 반 이동 기록

명부 행의 반이 바뀐 일을 한 줄씩 남긴다. 명부(`STUDY_PARTICIPANT`)는 「지금 어느 반」만 들고 있어서, 옮긴 뒤에는 어디서 언제 왔는지 알 수 없다.
네비게이터 · 캡틴이 출석부에서 「A반에서 이동 · 11/10」을 보고, 출석률이 반마다 그 반에 있던 동안만 세는 데 쓴다 ([share 11-19](../share/2026-11-19-group-move-log.md)).

> 스펙: [study-group — 반 · 역할 한 번에 바꾸기](../../specs/study-group/spec.md) (쓰기) · [attendance — 출석 명부 조회 · 출석률 산식](../../specs/attendance/spec.md) (읽기)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_ID | BIGINT | N | [STUDY](./STUDY.md) ID. FK 없음 |
| PARTICIPANT_ID | BIGINT | N | 옮긴 명부 행. [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md) ID. FK 없음 |
| ACCOUNT_ID | BIGINT | N | 옮긴 사람. 명부 행에서 복사한다 — 출석 행(`STUDY_ATTENDANCE`)이 계정 ID 로 이어지기 때문. FK 없음 |
| FROM_GROUP_ID | BIGINT | Y | 옛 반 ID. 반이 없던 행(미배정)이면 NULL. **반을 지운 뒤에도 값을 남긴다** |
| FROM_GROUP_NAME | VARCHAR(255) | Y | 옮긴 그때 옛 반 이름. `FROM_GROUP_ID` 가 NULL 이면 NULL |
| TO_GROUP_ID | BIGINT | Y | 새 반 ID. 반을 비운 경우 NULL |
| TO_GROUP_NAME | VARCHAR(255) | Y | 옮긴 그때 새 반 이름 |
| MOVED_BY_ACCOUNT_ID | BIGINT | N | 옮긴 캡틴. **어느 API 응답에도 내지 않는다** — 확인은 DB 에서만. FK 없음 |
| MOVED_AT | DATETIME(6) | N | 옮긴 시각(UTC). 반 · 회차 잠금을 얻은 **뒤** 잰 `now` — 「예정 회차」 판정과 같은 시각 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity`. 행을 고치지 않으므로 두 값이 같다 |

반 이름은 `STUDY_GROUP.NAME` 과 같은 길이로 둔다. 지금 이름은 20자 이하로 받지만(`StudyGroup.normalizeName`), 옛 행 이름 길이를 가정하지 않는다.

## 관계

- N : 1 [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md) — 한 명부 행이 여러 번 옮길 수 있다 (A → C → B)
- 반([STUDY_GROUP](./STUDY_GROUP.md))에는 **FK 를 걸지 않는다.** 반을 지워도 기록은 남아야 한다. 그래서 이름을 복사해 둔다

## 쓰는 규칙

- 반이 **실제로 바뀐** 명부 행마다 한 줄. 같은 반으로 보낸 줄 · 역할만 바뀐 줄은 쓰지 않는다
- 반 이동과 **같은 트랜잭션**에 쓴다. 기록이 실패하면 이동도 롤백된다
- 고치거나 지우는 API 는 없다
- 반 삭제(`DELETE …/groups/{groupId}`)는 이 표를 건드리지 않는다
- 스터디 삭제는 그 스터디의 명부와 함께 이 표의 행도 지운다 (`STUDY_ID`)
- 회원 탈퇴는 행을 지우지 않는다. 명부 행이 `DELETED` 로 남는 것과 같은 이유다 — 출석률 구간을 잃지 않게

## 읽는 규칙 — 반별 구간

한 사람이 반 G 에 있던 구간을 이 표와 명부 행으로 만든다. 출석률은 G 회차 중 이 구간 안의 것만 센다 ([attendance 출석률 산식](../../specs/attendance/spec.md#출석률-산식)).

| 구간 | 시작 | 끝 |
|---|---|---|
| 지금 반 | `TO_GROUP_ID = 지금 반` 인 가장 늦은 `MOVED_AT`. 없으면 `JOINED_AT`. 둘 다 있으면 더 늦은 값 (재신청은 `JOINED_AT` 을 옮긴다) | 명부 행의 기존 상한 (`now` 또는 `LEFT_AT`) |
| 옮겨 나간 반 | 그 이동 직전에 G 로 들어온 `MOVED_AT`. 없으면 `JOINED_AT` (그 값이 이동보다 늦으면 하한 없음) | 그 이동의 `MOVED_AT` |

한 반에서 여러 번 나갔다 들어왔으면(A → B → A) 출석부에는 **지금 반의 줄 하나**만 보이고, 출석률은 마지막으로 들어온 구간만 센다.

## 제약

- 인덱스 `(PARTICIPANT_ID, MOVED_AT)` — 「이 사람은 어디서 왔나」 (출석부 `groupMoves`)
- 인덱스 `(FROM_GROUP_ID, MOVED_AT)` — 「이 반에서 나간 사람」 (옛 반 출석부의 옮겨 간 줄)
- 인덱스 `(STUDY_ID, MOVED_AT)` — 스터디 요약 · 대시보드의 반별 구간

## 보관

스터디 데이터와 같이 둔다. 개인정보 처리 기록이 아니라 출석 집계의 재료라 [감사 로그](./ADMIN_AUDIT_LOG.md)의 보관 기한을 따르지 않는다. 이메일 · 이름 원문은 넣지 않는다.

## 과거 데이터

이 표가 생기기 전의 이동은 되살릴 수 없다. 기록이 없는 사람은 지금처럼 `JOINED_AT` 부터 지금 반에서 센다.
