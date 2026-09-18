# 모집 상태 (모집 마감 자동 판정) Spec

> ERD: [STUDY_COHORT](../../docs/erd/STUDY_COHORT.md) § "모집 상태" · 관련 스펙: [study/spec.md](../study/spec.md)
> 생성일: 2026-09-15
> 상태: 구현완료 (UPCOMING 은 범위 밖 — 아래 미확정)
> 이슈: Notion 51 「[기능] 모집 마감 (정원 도달 or 기한 만료 시 자동)」

## WHAT

코호트가 아직 모집 중인지 마감됐는지를 **매 조회마다 계산해서** 목록·상세 응답에 실어 보낸다.
운영자가 "마감" 버튼을 누르는 게 아니라 **기한이 지나거나 정원이 차면 자동으로** 마감으로 보인다.

저장하지 않는다. 저장하면 "DB 에는 모집중인데 마감일은 지난" 상태가 생기고, 그걸 맞춰주는
배치가 필요해진다. 계산은 마감일·정원·신청자 수 셋이면 끝나므로 컬럼도 배치도 없다.

지금 프론트는 `cohort.status`(라이프사이클)를 모집 상태로 겸해서 쓰고 있다 —
`frontend/apps/core-front/src/lib/api.ts:38` 의 `DRAFT → 'recruiting'` 매핑이 그 흔적이다.
이 스펙이 두 축을 분리한다.

## 두 축을 겹치지 않는다

| | 타입 | 정하는 주체 | 저장 |
|---|---|---|---|
| `status` (라이프사이클) | `StudyCohortStatus` = `DRAFT` / `OPEN` / `CLOSED` | 사람(운영자) | `STUDY_COHORT.STATUS` |
| `recruitStatus` (모집 상태) | `RecruitStatus` = `RECRUITING` / `RECRUIT_CLOSED` | 날짜·정원 | **안 함 (계산)** |

`recruitStatus` 는 `status = OPEN` 일 때만 값이 있다. 그 밖에서는 **`null`** —
"마감됐다"가 아니라 "모집 상태라는 개념이 없다"다. `DRAFT` 는 아직 공개 전이고 `CLOSED` 는
기수 자체가 끝났으니, 그 둘은 `status` 가 이미 다 말해준다.

## 판정 규칙

```
status != OPEN                        → null
recruitDeadline != null && now >= recruitDeadline → RECRUIT_CLOSED
capacity != null && 신청자수 >= capacity           → RECRUIT_CLOSED
그 외                                              → RECRUITING
```

| 경계 | 결과 | 근거 |
|---|---|---|
| `now == recruitDeadline` (정확히 마감 시각) | `RECRUIT_CLOSED` | ERD 가 `now() >= RECRUIT_DEADLINE` 을 마감으로 쓴다. 마감 시각 그 순간은 이미 못 받는다 |
| `recruitDeadline == null` | 시각으로는 마감 안 됨 | V8 이후 NULL = 상시 모집 ([study/spec.md](../study/spec.md)) |
| `capacity == null` | 정원으로는 마감 안 됨 | 무제한. 신청자가 9999 여도 `RECRUITING` |
| `capacity == null` **그리고** `recruitDeadline == null` | 항상 `RECRUITING` | 마감 조건이 하나도 없는 코호트 |
| 신청자수 `== capacity` | `RECRUIT_CLOSED` | 정원 "도달"이 마감. 초과까지 기다리지 않는다 |

구현: `StudyCohort.recruitStatus(long applicantCount)` — `isClosingSoon()` 바로 옆.
신청자 수는 `STUDY_APPLICATION` 애그리거트 소관이라 엔티티가 직접 세지 않고 **인자로 받는다**
(애그리거트 사이는 ID 참조 — [ddd-guide](../../docs/backend-development-guide/ddd-guide.md)).

## 정원을 차지하는 신청 — `countByStudyIds` 수정

`StudyApplicationRepository.countByCohortIds` 가 `REJECTED` 만 빼고 세고 있었다.
`WITHDRAWN`(철회) · `WAITLISTED`(대기자)까지 세는 값을 정원 도달 판정에 그대로 쓰면
**철회한 사람이 자리를 잡고 있어서 모집이 닫힌다.**

| `ApplicationStatus` | 정원 차지 | 왜 |
|---|---|---|
| `PENDING` | O | 심사 중이지만 자리는 잡고 있다. 정원이 찬 뒤 들어오는 신청이 `WAITLISTED` 가 되려면 `PENDING` 이 세어져야 한다 |
| `APPROVED` | O | |
| `REJECTED` | X | |
| `WITHDRAWN` | X | 자리를 비웠다 |
| `WAITLISTED` | X | 정의상 정원 **밖**이다 |

**표시용 수와 정원용 수를 나누지 않고 쿼리 하나를 고쳤다.** 프론트가 이미 이 값을
`seats: { total: capacity, taken: currentApplicants }` 로 그리고 있어
(`frontend/apps/core-front/src/lib/api.ts`), 두 수가 갈리면 정원 20 에 `21/20` 이 찍힌다.
"N명 신청" 표시와 "정원 도달" 판정은 같은 수여야 한다.

> 대기자(`WAITLISTED`) 를 **만드는** 로직은 이 스펙 범위 밖 — 이슈 50 (정원 관리·대기자).
> 여기서는 이미 그 상태인 행을 어떻게 셀지만 정한다.

---

## 스터디 목록 조회 — 응답 변경

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies`
- **인증**: 불필요 (공개)
- **변경**: `cohort` 에 `recruitStatus` 필드 추가. 나머지 필드·필터·페이지네이션 그대로

### Response — 200 (변경분만)

```json
{
  "items": [
    {
      "studyId": 1,
      "cohort": {
        "cohortId": 1,
        "status": "OPEN",
        "recruitStatus": "RECRUITING",
        "capacity": 20,
        "currentApplicants": 18,
        "recruitDeadline": "2026-10-01T00:00:00Z",
        "closingSoon": false
      }
    }
  ],
  "total": 1, "offset": 0, "limit": 20
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| cohort.recruitStatus | String | Y | `RECRUITING` / `RECRUIT_CLOSED`. `status != OPEN` 이면 null | 계산: 위 [판정 규칙](#판정-규칙) |
| cohort.currentApplicants | long | N | 정원을 차지하는 신청자 수 | 계산: `STUDY_APPLICATION` 중 `STATUS IN (PENDING, APPROVED)` **(판정 기준 변경)** |

### Error Responses

변경 없음.

---

## 스터디 상세 조회 — 응답 변경

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}`
- **인증**: 불필요 (공개)
- **변경**: `cohort` 에 `recruitStatus` 필드 추가

### Response — 200 (변경분만)

```json
{
  "id": 1,
  "cohort": {
    "id": 1,
    "status": "OPEN",
    "recruitStatus": "RECRUIT_CLOSED",
    "capacity": 20
  }
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| cohort.recruitStatus | String | Y | 목록과 같은 규칙·같은 신청자 수 쿼리 | 계산: 위 [판정 규칙](#판정-규칙) |

상세는 `currentApplicants` 를 **원래부터 안 내려준다.** 이번에 추가하지 않았다 —
`recruitStatus` 계산에만 쓰고 버린다. 상세에서 `18/20` 을 그려야 하면 그때 추가한다.

### Error Responses

변경 없음.

### 프론트엔드 사용처

- `frontend/apps/core-front/src/lib/api.ts` — `mapStatus()` 가 `cohort.status` 로 모집 상태를
  흉내내던 걸 `cohort.recruitStatus` 로 교체
- 스터디 목록 상태 필터 (지연 · 아연)

---

## 스키마 변경

**없다.** 파생 상태라 컬럼을 만들지 않았으므로 `V12__*.sql` 도 없다.
엔티티 필드도 안 늘었다 (`StudyCohort` 에 메서드만 추가).

## 테스트

| 위치 | 덮는 것 |
|---|---|
| `domain/.../StudyCohortTest` | 판정 규칙 단위 — 마감 시각 정확히 now / 1초 전 / 경과, 정원 도달·초과, `capacity` null, `recruitDeadline` null, `DRAFT`·`CLOSED` → null |
| `api/.../StudyRecruitStatusIntegrationTest` | 목록·상세 응답에 필드가 실제로 실리는지, `REJECTED`·`WITHDRAWN`·`WAITLISTED` 가 정원을 안 차지하는지 |

## 미확정

- **[NEEDS CLARIFICATION] `UPCOMING`(모집예정) — 이번 범위에서 뺐다.**
  ERD § 미확정 은 "모집 시작 시각 컬럼(`PUBLISH_AT` / `RECRUIT_START_DATE`) 미확정" 이라고
  적혀 있고(2026-09-02), 그 뒤 V10(2026-09-13)이 `PUBLISH_DATE` 를 추가했다. 그런데 V10 은
  ERD 의 그 미확정 항목을 닫지 않았고, [study/spec.md](../study/spec.md) 는 `PUBLISH_DATE` 를
  **"공개일 · null = 즉시 공개"** 로만 정의한다 — *모집 시작*이라고 쓴 문서가 없다.
  `PUBLISH_DATE = 모집 시작` 이면 `UPCOMING` 은 3줄이면 되지만, 그렇게 못 박는 건 추측이라
  **9/19 스쿼드 회의 안건**으로 남긴다. 결정되면 ERD 미확정 항목도 같이 닫는다.
- **[NEEDS CLARIFICATION] `ONGOING` / `ENDED` 도 이번 범위 밖.**
  ERD § "모집 상태" 표에 같이 있지만 축이 다르다 — 모집이 아니라 **진행**이고,
  `START_DATE`/`END_DATE` 로 판정하며 `status = CLOSED` 와 의미가 겹친다.
  이슈 51 은 모집 마감만 다루므로 `RecruitStatus` 에 넣지 않았다.
  필요해지면 별도 타입(`ProgressStatus`)이 맞는지부터 정한다.
- **[NEEDS CLARIFICATION] 서버측 `recruitStatus` 필터 파라미터.**
  목록은 필터 → 정렬 → `offset/limit` 순으로 **서버에서** 자르므로, 프론트가 받은 페이지만
  걸러내면 페이지마다 개수가 들쭉날쭉해진다. 상태 필터를 제대로 하려면
  `GET /api/studies?recruitStatus=RECRUITING` 가 필요하다. 이번엔 "노출"까지만 하고
  파라미터는 안 넣었다 — 필터 스펙(기본값·`status` 와의 조합)은 FE 와 합의가 먼저다.
- **[NEEDS CLARIFICATION] `closingSoon` 과의 관계.**
  `closingSoon`(`StudyCohort.isClosingSoon()`)은 `status = OPEN` + 마감일이 `now + 3일` 이전인지만
  본다. 그래서 (a) 정원이 차서 `RECRUIT_CLOSED` 인데 `closingSoon = true`, (b) **마감일이 이미 지난**
  코호트도 `closingSoon = true` 두 조합이 나온다. 둘 다 `recruitStatus == RECRUITING` 일 때만
  true 로 좁히면 한 번에 풀리는데, 지금 화면 표기를 바꾸는 일이라 이번 PR 에서는 건드리지 않았다.

## 변경이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-09-15 | 최초 작성 — `RecruitStatus` 파생 상태 + `countByStudyIds` 정원 판정 기준 수정 | Notion 이슈 51 |
