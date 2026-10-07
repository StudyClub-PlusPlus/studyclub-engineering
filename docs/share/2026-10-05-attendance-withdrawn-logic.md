---
상태: 결정됨
---

# 출석률 집계에서 하차·탈퇴를 다루는 방식 — 세 가지 결정

## 미리 알아야 할 것

- **STUDY_PARTICIPANT**: 스터디에 참여 중인 사람의 명부 행. 상태(`STATUS`)가 `ACTIVE`(참여 중), `WITHDRAWN`(하차), `DELETED`(회원 탈퇴) 등으로 나뉜다.
- **LEFT_AT**: 명부에서 빠진 시각. `WITHDRAWN`·`DELETED`일 때만 값이 있다.
- **출석률 계산(`AttendanceRateCalculator`)**: 참가자별로 "분모에 넣을 회차"를 고른다. 하차·탈퇴 이후 회차는 결석(0점)이 아니라 **분모에서 아예 제외**한다 — 하차와 결석이라는 서로 다른 사실이 같은 숫자로 섞이지 않도록.
- **`countsToward()` 의 `upper_bound`**: 분모에 넣을 회차의 상한. `ACTIVE`/`PAUSED`/`COMPLETED`는 `now()`, `WITHDRAWN`/`DELETED`는 `LEFT_AT`이다. `LEFT_AT`이 null이면 `countable_meetings`가 항상 0이 되어 그 참가자 전체가 집계에서 제외된다 — "시각을 모르면 안전하게 전부 빼는" 폴백.

비유: 출석률 계산을 시험 채점에 빗대면, 하차는 "시험을 보지 않고 나간 것"이지 "0점을 받은 것"이 아니다. 남은 시험지만 채점한다.

---

## 결정 1 — `markWithdrawn()`은 `leftAt`을 항상 덮어쓴다

### 한 줄 요약

하차(`markWithdrawn`)는 "하차 행위 자체"를 기록하는 메서드라 항상 새 시각으로 쓴다.
반면 회원탈퇴(`markDeletedDueToAccountDeletion`)는 이미 하차했던 사람의 원래 시각을 보존한다.

### 왜 다르게 동작하는가

`markDeletedDueToAccountDeletion()`이 `leftAt`을 조건 분기로 보존하는 이유는 다음 시나리오 때문이다:

1. 3월에 하차 → `STATUS=WITHDRAWN`, `LEFT_AT=3월`
2. 9월에 계정 탈퇴 → `STATUS=DELETED`

이 때 `LEFT_AT`을 9월로 덮어쓰면, 3월~9월 사이에 열린 회차가 분모에 다시 들어와 출석률이 오염된다. 그래서 `markDeletedDueToAccountDeletion()`은 기존 값이 있으면 건드리지 않는다.

`markWithdrawn()`은 다르다. "하차한다"는 행위 자체가 `LEFT_AT`을 새로 기록하는 것이다. 이미 WITHDRAWN 상태였다면 재하차 요청 자체가 비즈니스 규칙 위반이므로, 이 메서드가 호출될 때는 반드시 ACTIVE 또는 PAUSED에서 전환하는 경우다.

### 코드 위치

- `StudyParticipant.markWithdrawn()` — `backend/domain/src/main/java/com/studyclub/domain/participant/StudyParticipant.java`
- `StudyParticipant.markDeletedDueToAccountDeletion()` — 같은 파일, 비교 참고

---

## 결정 2 — 출석부 기본 뷰는 ACTIVE 참여자만(`includeWithdrawn=false`)

### 한 줄 요약

`GET /api/studies/{studyId}/attendances`의 기본 응답은 ACTIVE 참여자만 포함한다.
하차·탈퇴자를 보려면 `?includeWithdrawn=true`를 붙인다.

### 왜 기본을 ACTIVE로 정했는가

출석부의 주 용도는 "지금 함께 공부하는 사람들의 참여도 파악"이다. 하차·탈퇴한 참가자가 기본으로 섞이면 캡틴·네비게이터가 현재 활성 인원을 빠르게 파악하기 어렵다.

하차·탈퇴자의 과거 이력이 필요한 경우(전체 출석 현황 확인, 완주율 계산 등)는 토글 한 번으로 볼 수 있다.

### `participantCount`는 필터와 무관하게 항상 전체 수

`study.participantCount`는 "이 그룹에 몇 명이 있었는가"이지, "지금 화면에 표시된 사람 수"가 아니다. `includeWithdrawn=false`로 ACTIVE만 표시하더라도 이 숫자는 전체(WITHDRAWN·DELETED 포함)를 센다.

이유: 프론트가 "7명 중 5명 표시 중"을 계산하려면 전체 수가 필요하고, 이 값을 별도 API로 또 부르지 않도록 항상 전체 수를 내려준다.

### 코드 위치

- `AttendanceController` — `@RequestParam(defaultValue = "false") boolean includeWithdrawn`
- `AttendanceService.getAttendances()` — `includeWithdrawn` 분기 + `totalParticipantCount` 별도 계산

---

## 결정 3 — `markWithdrawn()` 호출 지점은 이번 브랜치에 없다

### 한 줄 요약

`markWithdrawn()` 메서드 선언은 이번 브랜치에서 추가했지만, 실제로 호출하는 endpoint(캡틴이 크루를 하차 처리하는 API)는 아직 없다.

### 왜 지금 당장 호출 지점을 안 만들었는가

하차 처리 API(`POST /api/studies/{studyId}/participants/{participantId}/withdraw` 등)는 별도 스토리로 기획 중이다. 이번 브랜치의 범위는 "집계 로직이 `leftAt`을 올바르게 쓸 수 있도록 도메인 메서드를 준비하는 것"이다.

지금은 `markWithdrawn()`이 호출되지 않으므로 WITHDRAWN 상태인 참가자에게 `leftAt`이 채워지는 경우는 없다. 기존 데이터에 `leftAt=null`인 WITHDRAWN 행이 있으면 `countsToward()`의 폴백(전체 제외)이 적용된다.

### 다음 작업자가 할 일

하차 처리 endpoint를 만들 때 반드시 `participant.markWithdrawn(Instant.now())`를 호출한다. 이 메서드를 거치지 않고 상태만 바꾸면 `leftAt`이 채워지지 않아 집계에서 해당 참가자의 모든 이력이 제외된다.

---

## 영향 — 누가 무엇을 해야 하나

| 작업 | 담당 |
|------|------|
| 하차 처리 API 구현 시 `markWithdrawn()` 호출 | 해당 스토리 담당자 |
| 출석부 프론트 — `includeWithdrawn` 토글 UI 구현 | 프론트 담당자 |
| `study.participantCount`를 필터 결과 수로 오해하지 않도록 주의 | 출석부 화면 개발자 |
