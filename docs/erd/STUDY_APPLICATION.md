# STUDY_APPLICATION — 신청서

회원이 스터디의 특정 기수에 낸 신청. 폼 답변을 보관한다. 폼 질문 정의는 [STUDY_COHORT.APPLICATION_FORM](./STUDY_COHORT.md) 을 참조한다.

> **STUDY_ID → STUDY_COHORT_ID.** "이 사람이 몇 기에 신청했는가"를 답하려면 기수를
> 가리켜야 한다. 부수 효과: 클럽 3기에서 `WITHDRAWN`/`REJECTED` 된 사람도 4기가
> 열리면 다시 신청할 수 있다 — 유니크 제약이 기수 단위로 바뀌기 때문 (아래 제약 참고).

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| USER_ID | BIGINT FK → USER | N | 신청자 |
| STUDY_COHORT_ID | BIGINT FK → STUDY_COHORT | N | 구 `STUDY_ID` |
| STATUS | VARCHAR(20) | N | 아래 |
| FORM_ANSWER | JSON | N | 답변 |

## 관계
- N : 1 [USER](./USER.md), [STUDY_COHORT](./STUDY_COHORT.md)
- 승인되면 [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md) 행이 생긴다 (신청서는 그대로 남는다)

## 상태 — STATUS

| 값 | 뜻 | 누가 |
|---|---|---|
| `PENDING` | 제출됨, 검토 대기. 기본값 | 신청자 |
| `APPROVED` | 승인. **같은 트랜잭션에서 STUDY_PARTICIPANT 생성** | 운영자 |
| `REJECTED` | 거절 | 운영자 |
| `WITHDRAWN` | 신청자가 스스로 취소 | 신청자 |
| `WAITLISTED` | 정원 초과로 대기 (미확정) | 운영자/자동 |

```mermaid
stateDiagram-v2
  [*] --> PENDING : 제출
  PENDING --> APPROVED : 운영자 승인 → 명부 편입
  PENDING --> REJECTED : 운영자 거절
  PENDING --> WITHDRAWN : 신청자 취소
  PENDING --> WAITLISTED : 정원 초과
  WAITLISTED --> APPROVED : 자리 남
  WAITLISTED --> WITHDRAWN : 신청자 취소
  APPROVED --> [*]
  REJECTED --> [*]
  WITHDRAWN --> [*]
```

- `APPROVED`/`REJECTED` 는 종결. 되돌리려면 새 신청.
- 신청 가능 조건: STUDY_COHORT.STATUS=`OPEN` + 모집 상태 `RECRUITING` + 로그인 + 같은 기수에 열린 신청 없음.

## 제약
- `UNIQUE(STUDY_COHORT_ID, USER_ID)` — 같은 기수 중복 신청 차단. `WITHDRAWN` 후 같은 기수 재신청을 허용하려면 부분 유니크(활성 상태만) 또는 앱 레벨 검사.
- 인덱스 `(STUDY_COHORT_ID, STATUS)` — 운영자 신청 목록

## 미확정
- 폼 구조를 `STUDY_QUESTION` + `STUDY_APPLICATION_ANSWER` 테이블로 정규화할지 — 현재는 STUDY_COHORT.APPLICATION_FORM JSON + STUDY_APPLICATION.FORM_ANSWER JSON 으로 단순화.
- 결정자·거절 사유(`DECIDED_BY`, `DECIDED_AT`, `REJECTION_REASON`) — 표 설계에 있음. 운영자 화면에 필요하면 추가.
- 운영자가 신청 목록에서 "이전 참여 이력·완주율"을 보려면 STUDY_PARTICIPANT + STUDY_ATTENDANCE 조인 — 스키마 추가 없음.
