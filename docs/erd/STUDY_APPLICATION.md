# STUDY_APPLICATION — 신청서

회원이 특정 모집 회차에 낸 신청. 폼 답변을 보관한다. 폼 질문 정의는 [STUDY_COHORT.APPLICATION_FORM](./STUDY_COHORT.md) 을 참조한다. **행이 있으면 제출 완료**다. 취소·대기·검토 상태값은 두지 않는다.

> **STUDY_COHORT_ID → RECRUITMENT_ID.** 신청은 기수가 아닌 모집 회차([STUDY_RECRUITMENT](./STUDY_RECRUITMENT.md))를
> 가리킨다. 같은 기수에 2차 모집이 열려도 1차 신청과 구분된다. 유니크 제약도 모집 회차 단위다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACCOUNT_ID | BIGINT | N | 신청자. ACCOUNT 참조 (인덱스만) |
| RECRUITMENT_ID | BIGINT | N | 신청한 모집 회차. STUDY_RECRUITMENT 참조 (인덱스만) |
| FORM_ANSWER | JSON | N | 답변 |

## 관계
- N : 1 [ACCOUNT](./ACCOUNT.md), [STUDY_RECRUITMENT](./STUDY_RECRUITMENT.md)
- 제출되면 같은 트랜잭션에서 [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md) 행이 생긴다 (신청서는 그대로 남는다).

## 제출 조건
- 기수 `STATUS=OPEN` + 모집 기간 내 + 로그인 + 같은 모집 회차에 신청 행 없음.
- 정원은 모집 회차의 `RECRUITMENT_CAPACITY` 를 그 회차의 `STUDY_APPLICATION` 행 수와 비교해 검사한다 (모집 회차마다 독립). 가득이면 저장하지 않는다. **반은 신청 이후에 정해지므로** [STUDY_CLASS.CAPACITY](./STUDY_CLASS.md)는 신청 검사에 넣지 않는다. 대기열은 두지 않는다.

## 제약
- `UNIQUE(RECRUITMENT_ID, ACCOUNT_ID)` — 같은 모집 회차 중복 신청 차단.
- 인덱스 `ACCOUNT_ID` — 내 신청 목록.

## 미확정
- 폼 구조를 `STUDY_QUESTION` + `STUDY_APPLICATION_ANSWER` 테이블로 정규화할지 — 현재는 STUDY_COHORT.APPLICATION_FORM JSON + STUDY_APPLICATION.FORM_ANSWER JSON 으로 단순화.
