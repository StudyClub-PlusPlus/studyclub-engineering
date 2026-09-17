# STUDY_APPLICATION — 신청서

회원이 스터디의 특정 기수에 낸 신청. 폼 답변을 보관한다. 폼 질문 정의는 [STUDY_COHORT.APPLICATION_FORM](./STUDY_COHORT.md) 을 참조한다. **행이 있으면 제출 완료**다. 취소·대기·검토 상태값은 두지 않는다.

> **STUDY_ID → STUDY_COHORT_ID.** "이 사람이 몇 기에 신청했는가"를 답하려면 기수를
> 가리켜야 한다. 유니크가 기수 단위라, 클럽 3기에 낸 사람과 별개로 4기가 열리면 다시 신청할 수 있다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACCOUNT_ID | BIGINT FK → ACCOUNT | N | 신청자 |
| STUDY_COHORT_ID | BIGINT FK → STUDY_COHORT | N | 구 `STUDY_ID` |
| FORM_ANSWER | JSON | N | 답변 |

## 관계
- N : 1 [ACCOUNT](./ACCOUNT.md), [STUDY_COHORT](./STUDY_COHORT.md)
- 제출되면 같은 트랜잭션에서 [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md) 행이 생긴다 (신청서는 그대로 남는다).

## 제출 조건
- 기수 `STATUS=OPEN` + 모집 상태 `RECRUITING` + 로그인 + 같은 기수에 신청 행 없음.
- 정원은 [STUDY_COHORT.CAPACITY](./STUDY_COHORT.md)만 본다. 비교 대상은 그 기수 명부 활성 인원(`STUDY_PARTICIPANT` 중 `WITHDRAWN` 제외). 가득이면 저장하지 않는다. **반은 신청 이후에 정해지므로** [STUDY_CLASS.CAPACITY](./STUDY_CLASS.md)는 신청 검사에 넣지 않는다. 대기열은 두지 않는다.

## 제약
- `UNIQUE(STUDY_COHORT_ID, ACCOUNT_ID)` — 같은 기수 중복 신청 차단.
- 인덱스 `ACCOUNT_ID` — 내 신청 목록.

## 미확정
- 폼 구조를 `STUDY_QUESTION` + `STUDY_APPLICATION_ANSWER` 테이블로 정규화할지 — 현재는 STUDY_COHORT.APPLICATION_FORM JSON + STUDY_APPLICATION.FORM_ANSWER JSON 으로 단순화.
