# CLUB_EVENT_QUESTION — 행사 신청 질문

행사 신청서에 지금 보이는 질문 한 개. 수정(`PUT`)이 질문 목록 전체를 교체한다. 기존 신청은 **신청 당시 질문과 답변의 사본**(신청 쪽에 보관)을 읽으므로 질문을 고치거나 지워도 바뀌지 않는다.

> 스펙: [event](../../specs/event/spec.md) · 마이그레이션 `V59__create_club_event.sql` · 엔티티 `ClubEventQuestion` ([CLUB_EVENT](./CLUB_EVENT.md) 애그리거트 안)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | 밖으로 내보내지 않는다 |
| CLUB_EVENT_ID | BIGINT FK | N | [CLUB_EVENT](./CLUB_EVENT.md) |
| QUESTION_KEY | VARCHAR(36) | N | 행사 안에서 바뀌지 않는 키 = 응답의 `questionId`. 새 질문이면 서버가 UUID 로 만든다. 수정 요청에 이 키를 보내면 그 질문을 갱신한다 |
| LABEL | VARCHAR(200) | N | 질문 제목 1~200자 |
| TYPE | VARCHAR(20) | N | `TEXT`(단답) / `TEXTAREA`(장문) / `RADIO`(객관식 하나) / `CHECKBOX`(객관식 여럿). `SELECT` 는 없다 |
| REQUIRED | BOOLEAN | N | 필수 응답 여부 |
| OPTIONS | JSON | N | 문자열 배열. `RADIO`·`CHECKBOX` 는 공백 아닌 서로 다른 선택지 2~10개(각 1~100자), `TEXT`·`TEXTAREA` 는 `[]` |
| SORT_ORDER | INT | N | 표시 순서 0부터. 요청 배열의 순서 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity` |

## 관계

- N : 1 [CLUB_EVENT](./CLUB_EVENT.md) — FK `fk_club_event_question_event` (`ON DELETE CASCADE`). 행사 루트를 통해서만 바뀐다
- 신청은 이 행을 **외래키로 물지 않는다** — 현재 질문을 조인해 기존 답을 다시 그리는 방식은 금지다 (스펙 「신청 질문의 보존」)

## 상태

상태 컬럼은 없다. 수정이 목록을 교체할 때:

| 요청의 질문 | 결과 |
|---|---|
| 기존 `questionId` 를 보냄 | 그 행을 고친다 (키 유지) |
| `questionId = null` | 새 행, 새 키 |
| 기존 질문이 요청에 없음 | 행 삭제 |
| 그 행사에 없는 키 · 같은 키 두 번 | 400 `INVALID_INPUT` (`questions[i].questionId`) |

## 제약

- `uk_club_event_question_event_key (CLUB_EVENT_ID, QUESTION_KEY)` — 행사 안에서 키 유일
- `idx_club_event_question_event_sort (CLUB_EVENT_ID, SORT_ORDER)` — 상세의 질문 순서. 순서를 바꾸는 수정이 중간에 같은 값을 거치므로 유일 제약은 두지 않는다
- 행사당 최대 20개 (앱이 본다)
