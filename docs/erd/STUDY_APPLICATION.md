# STUDY_APPLICATION — 신청서

회원이 특정 모집 회차에 낸 신청. 폼 답변을 보관한다. 폼 질문 정의는 [STUDY_COHORT.APPLICATION_FORM](./STUDY_COHORT.md) 을 참조한다.

> **STUDY_COHORT_ID → RECRUITMENT_ID.** 신청은 기수가 아닌 모집 회차([STUDY_RECRUITMENT](./STUDY_RECRUITMENT.md))를
> 가리킨다. 같은 기수에 2차 모집이 열려도 1차 신청과 구분된다. 부수 효과: 클럽 3기에서 `WITHDRAWN`/`REJECTED` 된
> 사람도 같은 기수의 2차 모집 또는 4기 모집에 다시 신청할 수 있다 — 유니크 제약이 모집 회차 단위이기 때문 (아래 참고).

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACCOUNT_ID | BIGINT | N | 신청자. ACCOUNT 참조 (인덱스만) |
| RECRUITMENT_ID | BIGINT | N | 신청한 모집 회차. STUDY_RECRUITMENT 참조 (인덱스만) |
| STATUS | VARCHAR(20) | N | 아래 |
| FORM_ANSWER | JSON | N | 답변 |

## 관계
- N : 1 [ACCOUNT](./ACCOUNT.md), [STUDY_RECRUITMENT](./STUDY_RECRUITMENT.md)
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
- 신청 가능 조건: STUDY_COHORT.STATUS=`OPEN` + STUDY_RECRUITMENT 모집 기간 내 + 로그인 + 같은 모집 회차에 열린 신청 없음.

## 제약
- `UNIQUE(RECRUITMENT_ID, ACCOUNT_ID)` — 같은 모집 회차 중복 신청 차단. `WITHDRAWN` 후 재신청을 허용하려면 부분 유니크(활성 상태만) 또는 앱 레벨 검사.
- 인덱스 `(RECRUITMENT_ID, STATUS)` — 운영자 신청 목록

## 미확정
- 폼 구조를 `STUDY_QUESTION` + `STUDY_APPLICATION_ANSWER` 테이블로 정규화할지 — 현재는 STUDY_COHORT.APPLICATION_FORM JSON + STUDY_APPLICATION.FORM_ANSWER JSON 으로 단순화.
- 결정자·거절 사유(`DECIDED_BY`, `DECIDED_AT`, `REJECTION_REASON`) — 표 설계에 있음. 운영자 화면에 필요하면 추가.
- 운영자가 신청 목록에서 "이전 참여 이력·완주율"을 보려면 STUDY_PARTICIPANT + STUDY_ATTENDANCE 조인 — 스키마 추가 없음.
