# 스터디 신청 API Spec

> ERD: [STUDY](../../docs/erd/STUDY.md) · [STUDY_APPLICATION](../../docs/erd/STUDY_APPLICATION.md) · [STUDY_RECRUITMENT](../../docs/erd/STUDY_RECRUITMENT.md) · [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [ACCOUNT](../../docs/erd/ACCOUNT.md)
> 생성일: 2026-09-19
> 상태: 스펙작성중
>
> 유저스토리:
> - 캡틴은 스터디 신청용 폼을 작성할 수 있다
> - 크루는 스터디 신청 폼을 제출할 수 있다
> - 캡틴은 스터디 신청서 결과를 모아볼 수 있다
>
> 기획 근거: playground 프로토 (`ApplicationFormTab` · `ApplyDialog` · `ResultsTab`)
>
> Story PRD:
> - [캡틴으로서, 스터디 신청용 폼을 제작할 수 있다](../../planning/stories/captain-application-form/PRD.md)
> - [크루로서, 스터디 신청 폼을 제출할 수 있다](../../planning/stories/crew-submit-application/PRD.md)
> - [캡틴으로서, 스터디 신청서 결과를 모아볼 수 있다](../../planning/stories/captain-application-results/PRD.md)

신청 폼 정의는 **기수(`STUDY.APPLICATION_FORM`)** 에 두고, 신청 행은 **모집 회차(`STUDY_APPLICATION.RECRUITMENT_ID`)** 에 붙인다. `STUDY_COHORT` 경로(`/cohorts/{cohortId}/…`)는 쓰지 않는다.

ERD 문서 일부(`STUDY_APPLICATION.md`, `STUDY_RECRUITMENT.md`)는 아직 `STUDY_COHORT` 를 가리킨다. 이 스펙의 정본은 [STUDY.md](../../docs/erd/STUDY.md) · [erd/README.md](../../docs/erd/README.md) 다이어그램이다.

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 스토리 | 상태 |
|--------|------|------|------|--------|------|
| GET | /api/studies/{studyId}/application-form | 신청 폼 조회 | 공개 (OPEN 기수) | 캡틴 설계 · 크루 제출 | 스펙작성중 |
| PUT | /api/admin/studies/{studyId}/application-form | 신청 폼 저장 | O (캡틴) | 캡틴은 스터디 신청용 폼을 작성할 수 있다 | 스펙작성중 |
| POST | /api/studies/{studyId}/applications | 신청 제출 | O (로그인 + 디스코드 연동) | 크루는 스터디 신청 폼을 제출할 수 있다 | 스펙작성중 |
| GET | /api/studies/{studyId}/applications/me | 내 신청 여부 | O (로그인) | 크루는 스터디 신청 폼을 제출할 수 있다 | 스펙작성중 |
| GET | /api/admin/studies/{studyId}/applications | 신청 결과 목록 | O (캡틴) | 캡틴은 스터디 신청서 결과를 모아볼 수 있다 | 스펙작성중 |
| POST | /api/me/discord/link | 디스코드 계정 연동 | O (로그인) | 크루는 스터디 신청 폼을 제출할 수 있다 | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

## 공통 사항

- **accountId**: JWT `authentication.getPrincipal()`. 바디로 받지 않는다.
- **캡틴**: 이 기수 `STUDY_PARTICIPANT` 의 `PARTICIPANT_ROLE` 이 `LEADER` 또는 `CO_LEADER` 이거나, `ACCOUNT.SYSTEM_ROLE=ADMIN`.
- **날짜**: UTC ISO 8601.
- **에러 바디**: `{ "errorCode", "errorMessage" }`. 유효값 실패는 `fields` 를 추가한다. 별명·폼 답·`DISCORD_ID`·`DISCORD_HANDLE` 원문은 넣지 않는다.
- **500**: 예기치 않은 서버 오류 시 `INTERNAL_ERROR`.

### 열려 있는 모집 회차

신청 제출·내 신청 조회는 기수의 **현재 열려 있는** `STUDY_RECRUITMENT` 한 건에 붙는다.

| 조건 | 판정 |
|------|------|
| 기수 `STUDY.STATUS` | `OPEN` |
| 시각 | `START_AT <= now() < RECRUIT_DEADLINE_AT` |
| 정원 | 아래 [정원](#정원) |

해당하는 행이 없으면 모집 마감으로 본다.

### 정원

비교 대상은 **분반 정원이 아니다.** 반은 신청 이후에 정한다. 대기열 없음.

1. `STUDY_RECRUITMENT.RECRUITMENT_CAPACITY` 가 있으면 — 그 회차의 `STUDY_APPLICATION` 행 수와 비교
2. `STUDY.CAPACITY` 가 있으면 — 그 기수 명부 활성 인원(`STUDY_PARTICIPANT` 중 `WITHDRAWN` 제외)과 비교
3. 둘 다 없으면 인원 제한 없음

가득이면 저장하지 않는다.

### APPLICATION_FORM (STUDY.APPLICATION_FORM)

캡틴이 저장하는 JSON. **플랫폼 기본 문항(디스코드 별명·참여 가능 요일·일정 참여 확인)은 이 배열에 넣지 않는다.** 서버가 신청 화면에 항상 붙인다.

```json
{
  "title": "AI 논문 스터디 신청",
  "description": "매주 목요일 논문을 읽습니다.\n\n**준비물**은 가이드를 보세요.",
  "questions": [
    {
      "id": "reason",
      "label": "지원 사유",
      "type": "TEXT",
      "required": true,
      "placeholder": "내 답변",
      "description": "선택 입력입니다.\n\n**자유롭게** 적어도 됩니다."
    }
  ]
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| title | String | N | trim 후 1~200자. 빈 문자열은 null 과 같다 | 설문 제목. 없으면 `STUDY.TITLE` |
| description | String | N | TEXT. 마크다운 원문 저장. 서버는 HTML 로 바꾸지 않는다 | 설문 설명. 없으면 `STUDY.ONE_LINE_SUMMARY` |
| questions | Array | Y | 빈 배열 허용 — 추가 질문 없음 | 캡틴이 만든 추가 질문. 순서 = 화면 순서 |
| questions[].id | String | Y | 폼 안에서 UNIQUE. 공백 불가 | `FORM_ANSWER.answers` 키 |
| questions[].label | String | Y | trim 후 1~200자 | 질문 제목 |
| questions[].type | String | Y | `TEXT` / `TEXTAREA` / `RADIO` / `CHECKBOX` / `SELECT` | |
| questions[].required | Boolean | Y | | `true` 면 해당 타입 Empty 불가 |
| questions[].options | String[] | RADIO·CHECKBOX·SELECT 이면 Y | 1개 이상. 빈 문자열 옵션 불가 | 선택지. 유효값 ENUM |
| questions[].allowOther | Boolean | N | RADIO·CHECKBOX 만. 그 외 타입에 있으면 400 | `true` 면 라벨 `기타` + 자유 입력 |
| questions[].placeholder | String | N | TEXT·TEXTAREA 만 | 안내 예시 |
| questions[].description | String | N | TEXT. 마크다운 원문. 여러 줄 허용 | 지원자에게 보일 부가 설명 |

`questions[]` 에 `min` / `max` 필드를 두지 않는다. 길이·개수 상한은 아래 유효값 표.

마크다운 범위(설문 설명·질문 설명 동일): `#`~`######` 제목, `**굵게**`, `*기울임*`, `~~취소선~~`, `` `코드` ``, `[링크](url)`, 순서/비순서 목록, 펜스 코드 블록. 렌더는 클라이언트. XSS 방지는 클라이언트 렌더러 책임.

### FORM_ANSWER (STUDY_APPLICATION.FORM_ANSWER)

```json
{
  "discordNickname": "홍길동/SWE/산호세/시스템디자인",
  "availableDays": ["mon", "wed"],
  "scheduleAgreed": true,
  "answers": {
    "reason": "논문을 같이 읽고 싶습니다."
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| discordNickname | String | Y | 제출 시점 서버 별명. 계정 `DISCORD_NICKNAME` 에도 같은 값으로 갱신 |
| availableDays | String[] | Y | `mon` `tue` `wed` `thu` `fri` `sat` `sun`. 화면 라벨이 아니라 이 키 |
| scheduleAgreed | Boolean | 기수 `STUDY.SCHEDULE` 이 있을 때만 Y | `true` 만 허용. 일정 문구가 없으면 이 키를 보내지 않는다 |
| answers | Object | Y | `questions[].id` → 문자열 또는 문자열 배열. 추가 질문이 없으면 `{}` |

행이 있으면 제출 완료다. 대기·취소·검토 상태값을 두지 않는다. 이미 낸 신청은 덮어쓰지 않는다.

### 유효값 표

trim 후 판정. 화면과 서버가 같은 표. 실패 카피는 화면용. API `fields` 값은 사유 코드.

| 필드 | Empty | MIN | MAX | ENUM | 기본값 | 사유 코드 | 실패 카피 |
|------|-------|-----|-----|------|--------|-----------|-----------|
| discordNickname | 불가 | 1자 | 100자 | — | 계정 `DISCORD_NICKNAME`. 없으면 빈 칸 | `empty` / `max` | `디스코드 서버 별명을 입력해 주세요.` / `100자 이내로 입력해 주세요.` |
| availableDays | 불가 | 1개 | 7개 | 요일 키 7종 | 없음 | `empty` / `max` / `enum` | `참여 가능한 요일을 하나 이상 선택해 주세요.` / `참여 가능한 요일을 다시 선택해 주세요.` |
| scheduleAgreed | 일정 있으면 불가 | — | — | `true` | `false` | `empty` | `일정 참여 가능 여부를 확인해 주세요.` |
| 추가 질문 TEXT | 필수면 불가 | 1자 | 200자 | — | 빈 칸 | `empty` / `max` | `필수 질문에 답해 주세요.` / `{N}자 이내로 입력해 주세요.` |
| 추가 질문 TEXTAREA | 필수면 불가 | 1자 | 2000자 | — | 빈 칸 | `empty` / `max` | 동일 |
| 추가 질문 RADIO·SELECT | 필수면 불가 | 1개 | 1개 | 그 질문 `options`. 기타면 자유 입력 | 미선택 | `empty` / `enum` / `other-empty` / `other-max` | `필수 질문에 답해 주세요.` / `선택지를 다시 골라 주세요.` / `기타 내용을 입력해 주세요.` / `100자 이내로 입력해 주세요.` |
| 추가 질문 CHECKBOX | 필수면 불가 | 1개 | 옵션 수(+기타 1) | `options` + (기타 시) 자유 입력 | 없음 | 동일 | 동일 |
| 기타 자유 입력 | 기타를 고르면 불가 | 1자 | 100자 | — | 빈 칸 | `other-empty` / `other-max` | `기타 내용을 입력해 주세요.` / `100자 이내로 입력해 주세요.` |

공백만이면 빈 값이다. `fields` 키는 `discordNickname` · `availableDays` · `scheduleAgreed` · `answers.{questionId}`.

### 플랫폼 기본 문항 (캡틴이 빼지 못함)

| 문항 | 저장 위치 | 화면 |
|------|-----------|------|
| 디스코드 서버 별명 | `FORM_ANSWER.discordNickname` + `ACCOUNT.DISCORD_NICKNAME` | 모든 신청 폼. 계정 값으로 채우고 지원자가 고칠 수 있다 |
| 참여 가능한 요일 | `FORM_ANSWER.availableDays` | 모든 신청 폼. 진행 일정 유무와 무관 |
| 일정 참여 확인 | `FORM_ANSWER.scheduleAgreed` | `STUDY.SCHEDULE` 이 있을 때만. 없으면 화면에 `일정 미정`이고 이 문항은 없음 |

이름·이메일은 신청 폼에 두지 않는다. 계정에서 읽기만 한다.

---

## 신청 폼 조회

> 스토리: 캡틴 설계 화면 로드 · 크루 신청 폼 렌더

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}/application-form`
- **인증**: 불필요 — `STUDY.STATUS=OPEN` 이고 `IS_HIDDEN=false` 일 때. 캡틴이 DRAFT 기수를 보려면 로그인 + 캡틴
- **설명**: 설문 제목·설명·추가 질문과, 신청 화면에 필요한 기수 안내(일정·모집 기한·주제)를 반환한다. 플랫폼 기본 문항 정의는 응답에 넣지 않는다 — 클라이언트·서버가 이 스펙 표로 안다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 기수 ID (`STUDY.ID`) |

### Response — 200

```json
{
  "studyId": 1,
  "title": "AI 논문 스터디 신청",
  "description": "매주 목요일 논문을 읽습니다.",
  "schedule": "매주 목 20:00 · 8주 과정",
  "recruitDeadline": "2026-11-01T00:00:00Z",
  "category": "AI_ML",
  "summary": "AI 논문을 함께 읽고 토론합니다.",
  "detail": "매주 논문 하나씩 읽고 토론합니다.",
  "questions": [
    {
      "id": "reason",
      "label": "지원 사유",
      "type": "TEXT",
      "required": true,
      "placeholder": "내 답변",
      "description": null
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| studyId | Long | N | | STUDY.ID |
| title | String | N | 설문 제목. 폼 title 없으면 기수 제목 | APPLICATION_FORM.title ?? STUDY.TITLE |
| description | String | Y | 설문 설명 마크다운. 폼 description 없으면 한 줄 소개 | APPLICATION_FORM.description ?? STUDY.ONE_LINE_SUMMARY |
| schedule | String | Y | 진행 일정. null 이면 신청 화면은 `일정 미정` 이고 참여 확인을 받지 않는다 | STUDY.SCHEDULE |
| recruitDeadline | String | Y | 열려 있는 모집 회차 마감. null 이면 상시 모집(열려 있는 회차의 마감이 없음) | STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT |
| category | String | N | 주제 | STUDY.CATEGORY |
| summary | String | N | 한 줄 소개 (등록 폼 항목 표시용) | STUDY.ONE_LINE_SUMMARY |
| detail | String | Y | 상세 소개 | STUDY.DESCRIPTION |
| questions | Array | N | 캡틴 추가 질문. 없으면 `[]` | APPLICATION_FORM.questions |

`APPLICATION_FORM` 이 null 이면 `title`/`description` 은 기수 제목·한 줄 소개, `questions` 는 `[]`.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | DRAFT 기수인데 미로그인 |
| 403 | FORBIDDEN | DRAFT 기수인데 이 기수 캡틴이 아님 |
| 404 | NOT_FOUND | studyId 없음, 또는 OPEN 이 아닌데 캡틴도 아님, 또는 `IS_HIDDEN=true` 를 비캡틴이 조회 |

### 프론트엔드 사용처

- `frontend/apps/playground/src/proto/console/components/ApplicationFormTab.tsx`
- `frontend/apps/playground/src/proto/core/components/ApplyDialog.tsx`

---

## 신청 폼 저장

> 스토리: 캡틴은 스터디 신청용 폼을 작성할 수 있다

### 기본 정보

- **Method**: PUT
- **Path**: `/api/admin/studies/{studyId}/application-form`
- **인증**: 필요 — 캡틴
- **설명**: 기수 신청 폼을 통째로 교체한다. 질문 설명은 여러 줄·마크다운 원문을 그대로 저장한다.

### 정책

- 모집이 시작되기 **전**에만 수정한다. 이미 들어온 신청서와 질문이 어긋나지 않게 잠근다.
- 잠금 조건: 이 기수에 `STUDY_APPLICATION` 이 1건 이상 **또는** 열려 있는/`START_AT` 이 지난 `STUDY_RECRUITMENT` 가 있으면 `409 CONFLICT`.
- 디스코드 별명 문항은 이 API 로 지우거나 타입을 바꿀 수 없다 — `questions` 에 `id=discord` 를 넣으면 `400 INVALID_INPUT`.
- 미리보기 전용 엔드포인트는 없다. 저장한 JSON 이 곧 지원자 화면이다.

### Request Body

공통 스키마 `APPLICATION_FORM` 과 동일. `questions` 는 반드시 보낸다 (빈 배열 가능).

### Response — 200

GET 신청 폼 조회와 같은 shape.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 스키마 위반 (타입, 옵션 누락, 허용되지 않은 `allowOther`, 중복 id, 플랫폼 기본 문항 id 혼입). `fields` 에 위치 |
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | 이 기수 캡틴이 아님 |
| 404 | NOT_FOUND | studyId 없음 |
| 409 | CONFLICT | 모집 시작 이후 또는 신청이 이미 들어온 뒤 수정 |

### 프론트엔드 사용처

- `frontend/apps/playground/src/proto/console/components/ApplicationFormTab.tsx`

---

## 신청 제출

> 스토리: 크루는 스터디 신청 폼을 제출할 수 있다

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/studies/{studyId}/applications`
- **인증**: 필요 — 로그인 회원. `ACCOUNT.DISCORD_ID` 가 있어야 한다 (화면 게이트만으로 끝내지 않는다)
- **설명**: 열려 있는 모집 회차에 신청 1건을 만든다. 별명이 바뀌었으면 계정도 갱신한다. 같은 트랜잭션에서 기본 분반 명부에 편입한다.

### Request Body

```json
{
  "discordNickname": "홍길동/SWE/산호세/시스템디자인",
  "availableDays": ["mon", "wed", "sun"],
  "scheduleAgreed": true,
  "answers": {
    "reason": "논문을 같이 읽고 싶습니다."
  }
}
```

`FORM_ANSWER` 스키마와 같다. `recruitmentId` 는 클라이언트가 보내지 않는다 — 서버가 열려 있는 회차를 고른다.

### 처리

1. 로그인 · `DISCORD_ID` 존재 · 열려 있는 모집 회차 · 정원 · `UNIQUE(RECRUITMENT_ID, ACCOUNT_ID)` 검사
2. 유효값 표 검사. 한 필드라도 실패하면 저장하지 않는다. `fields` 에는 실패한 필드만 (화면은 검사 순서대로 하나 표시)
3. `STUDY_APPLICATION` insert. `FORM_ANSWER` 저장
4. `ACCOUNT.DISCORD_NICKNAME` 을 제출 별명으로 갱신
5. 이 기수의 기본 분반(`STUDY_GROUP` — 기수당 최소 1개)에 `STUDY_PARTICIPANT` (`STATUS=ACTIVE`, `PARTICIPANT_ROLE=MEMBER`) insert
6. 커밋. 이후 같은 회차 POST 는 `409`

덮어쓰기 없음. 승인·거절 상태값 없음. 신청을 없앨 때는 행 삭제 + 제출 때 만든 명부 행 삭제 (이 API 범위 밖).

### Response — 201 No Content

```
Location: /api/studies/{studyId}/applications/{applicationId}
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 유효값 표 위반. `fields` 에 사유 코드. 답 원문 없음 |
| 401 | UNAUTHORIZED | 미로그인 |
| 403 | FORBIDDEN | `DISCORD_ID` 없음. 화면은 연동 팝업을 연다 |
| 404 | NOT_FOUND | studyId 없음 또는 숨김 |
| 409 | CONFLICT | 이미 이 모집 회차에 신청함 · 모집 마감 · 정원 초과. `errorMessage` 로 구분 |

`errorMessage` (409):

| 조건 | errorMessage |
|------|----------------|
| 이미 신청 | `이미 신청한 스터디입니다.` |
| 모집 마감 | `모집이 마감되었습니다.` |
| 정원 초과 | `정원이 가득 찼습니다.` |

### 프론트엔드 사용처

- `frontend/apps/playground/src/proto/core/components/ApplyButton.tsx`
- `frontend/apps/playground/src/proto/core/components/ApplyDialog.tsx`
- `frontend/apps/playground/src/proto/core/components/ApplyDiscordGate.tsx`
- `frontend/apps/playground/src/proto/core/components/ApplyCompleteDialog.tsx`
- `frontend/apps/playground/src/proto/core/lib/apply-validation.ts`

신청하기는 상세에서만 연다(2026-09-22 변경 — 목록은 둘러보기 전용으로 신청하기·찜을 빼고, 이 API 는 상세의 신청하기 하나만 쓴다). `ApplyButton` 은 클릭 시 로그인 → 디스코드 연동 순으로 확인한 뒤 이 API 로 제출한다.

---

## 내 신청 여부

> 스토리: 크루는 스터디 신청 폼을 제출할 수 있다 — CTA `신청 완료`

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}/applications/me`
- **인증**: 필요
- **설명**: 이 기수의 **열려 있는 모집 회차**(없으면 가장 최근 회차)에 내 신청 행이 있는지 반환한다. 있으면 폼을 다시 열지 않는다.

### Response — 200

```json
{
  "applied": true,
  "applicationId": 42,
  "submittedAt": "2026-09-19T12:00:00Z"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| applied | Boolean | N | | 계산: 해당 회차에 내 `STUDY_APPLICATION` 존재 |
| applicationId | Long | Y | `applied=false` 이면 null | STUDY_APPLICATION.ID |
| submittedAt | String | Y | 행 생성 시각. 컬럼이 없으면 ID 순서의 대용을 쓰지 말고 null | 구현 시 created_at. ERD 에 생성시각 컬럼이 없으면 [NEEDS CLARIFICATION] |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 미로그인 |
| 404 | NOT_FOUND | studyId 없음 |

### 프론트엔드 사용처

- `frontend/apps/playground/src/proto/core/components/ApplyButton.tsx`

---

## 신청 결과 목록

> 스토리: 캡틴은 스터디 신청서 결과를 모아볼 수 있다

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/studies/{studyId}/applications`
- **인증**: 필요 — 캡틴
- **설명**: 이 기수 모집 회차의 신청 행을 반환한다. **집계 API 는 없다.** 질문별 막대·응답자별 표는 클라이언트가 이 목록으로 계산한다.

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| recruitmentId | Long | N | 특정 모집 회차만. 이 기수 소속이 아니면 422 |

### 화면 규칙 (서버가 미리 집계하지 않음)

클라이언트가 이 응답으로 그린다.

- 헤더 카피: `응답자 {n}명` — `n = applications.length`
- 보기 전환 라벨: `질문별` / `응답자별`. 기본은 `질문별`
- **질문별**: 질문마다 응답 수. 선택지는 옵션별 인원만. 단답·장문은 답 텍스트만. **누가 답했는지는 붙이지 않는다**
- **응답자별**: 행 = 신청 1건. 열 = 디스코드 별명 · 이메일 · 추가 질문. 체크박스 답은 쉼표로 나열
- 플랫폼 기본 문항(별명·요일·일정 확인)은 질문별 카드에 넣지 않는다. 별명은 응답자별 표의 식별 컬럼으로만 쓴다
- 추가 질문이 없으면(`questions` 가 `[]`) 탭은 두고 안내: `이 스터디는 신청 폼에 추가 질문이 없습니다.`

ERD 의 신청 행에는 거절 상태가 없다. 모든 행이 제출 완료다. 명부 `WITHDRAWN` 과의 관계는 [미확정](#미확정).

### Response — 200

```json
{
  "respondentCount": 16,
  "questions": [
    {
      "id": "reason",
      "label": "지원 사유",
      "type": "TEXT"
    }
  ],
  "applications": [
    {
      "id": 10,
      "recruitmentId": 3,
      "discordNickname": "홍길동/SWE/산호세/시스템디자인",
      "email": "gildong@example.com",
      "availableDays": ["mon", "wed"],
      "scheduleAgreed": true,
      "answers": {
        "reason": "논문을 같이 읽고 싶습니다."
      }
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| respondentCount | Integer | N | `applications.length` 와 같다 | 계산 |
| questions | Array | N | 캡틴 추가 질문. 집계 대상 | APPLICATION_FORM.questions (`id`/`label`/`type`/`options`/`allowOther`) |
| applications[].id | Long | N | | STUDY_APPLICATION.ID |
| applications[].recruitmentId | Long | N | | STUDY_APPLICATION.RECRUITMENT_ID |
| applications[].discordNickname | String | N | 계정 실명이 아니라 제출 별명 | FORM_ANSWER.discordNickname |
| applications[].email | String | N | | ACCOUNT.EMAIL |
| applications[].availableDays | String[] | N | | FORM_ANSWER.availableDays |
| applications[].scheduleAgreed | Boolean | Y | 일정 없는 기수는 null | FORM_ANSWER.scheduleAgreed |
| applications[].answers | Object | N | | FORM_ANSWER.answers |

정렬: 신청 행 ID 오름차순 (먼저 낸 순).

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | 이 기수 캡틴이 아님 |
| 404 | NOT_FOUND | studyId 없음 |
| 422 | INVALID_INPUT | `recruitmentId` 가 이 기수 모집 회차가 아님 |

### 프론트엔드 사용처

- `frontend/apps/playground/src/proto/console/components/ResultsTab.tsx`

---

## 디스코드 계정 연동

> 스토리: 크루는 스터디 신청 폼을 제출할 수 있다 — 폼을 열기 전 게이트

### 기본 정보

- **Method**: POST
- **Path**: `/api/me/discord/link`
- **인증**: 필요 — 로그인 본인
- **설명**: 인가 코드를 서버가 토큰으로 바꿔 `ACCOUNT.DISCORD_ID` · `DISCORD_HANDLE` 을 저장한다. 클라이언트가 보낸 식별자·핸들은 쓰지 않는다.

계정 도메인으로 옮길 수 있다. 신청 스토리가 이 값 없이 진행되지 않아 여기에 적는다.

### Request Body

```json
{
  "code": "oauth-authorization-code"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| code | String | Y | 디스코드 OAuth 인가 코드 |

`discordId` / `handle` 을 바디에 넣으면 무시하거나 `400`.

### Response — 204 No Content

핸들은 이후 계정 조회에서 읽는다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `code` 없음 |
| 401 | UNAUTHORIZED | 미로그인 |
| 409 | CONFLICT | 그 `DISCORD_ID` 가 다른 계정에 이미 있음 (`UNIQUE(DISCORD_ID)`) |
| 502 | BAD_GATEWAY | 디스코드 토큰 교환 실패·타임아웃. 폼을 열지 않는다. 연동 팝업에 잔류 |

프로토는 OAuth 없이 화면에서 바로 연결한다. 실패 화면은 미구현.

### 프론트엔드 사용처

- `frontend/apps/playground/src/proto/core/components/ApplyDiscordGate.tsx`

### 외부 연동 (SYS-02)

- 공급자: Discord OAuth
- 서버가 인가 코드 → 액세스 토큰 → 사용자 식별. 화면에 `DISCORD_ID` 를 돌려주지 않는다
- 실패·타임아웃 시 계정 컬럼을 부분 저장하지 않는다

---

## 권한 요약

| 동작 | 허용 | 검증 위치 |
|------|------|-----------|
| 신청 폼 조회 (OPEN) | 누구나 | 서버 (숨김·상태) |
| 신청 폼 저장 | 이 기수 캡틴 | 서버 |
| 신청 제출 | 로그인 + `DISCORD_ID` | 서버 |
| 내 신청 여부 | 로그인 본인 | 서버 |
| 신청 결과 조회 | 이 기수 캡틴 | 서버 |
| 디스코드 연동 | 로그인 본인 | 서버 |
| 미로그인 신청 | 거절 | 서버. 프로토는 로그인 가정 |

---

## 개인정보

| 항목 | 목적 | 수명 |
|------|------|------|
| `FORM_ANSWER` | 스터디 운영·연락 | 신청 행이 있는 동안 |
| `DISCORD_NICKNAME` | 서버에서 사람을 찾기 | 계정에 남김. 탈퇴 때 계정과 함께 파기 |
| `DISCORD_ID` · `DISCORD_HANDLE` | 연동 식별 | 연동 해제 또는 탈퇴 때 삭제 |

수집: 디스코드 식별·핸들, 서버 별명, 참여 가능 요일, 일정 참여 확인, 캡틴이 받은 추가 답변.

---

## 미확정

- [NEEDS CLARIFICATION] `FORM_ANSWER` JSON 유지 vs `STUDY_QUESTION` + `STUDY_APPLICATION_ANSWER` 정규화 — ERD README 와 같음. 이 스펙은 JSON 으로 구현한다
- [NEEDS CLARIFICATION] 신청 행 삭제·계정 탈퇴 이후 법정 최소 보관 기간
- [NEEDS CLARIFICATION] `STUDY_APPLICATION` 생성시각 컬럼. 없으면 `applications/me.submittedAt` 은 null
- [NEEDS CLARIFICATION] 열려 있는 모집 회차가 동시에 둘이면 어느 회차에 붙일지. 지금은 1건이라고 가정
- [NEEDS CLARIFICATION] 결과 목록에서 명부 `WITHDRAWN` 인 사람의 신청을 뺄지. ERD 는 신청 행에 거절 상태가 없음
- [NEEDS CLARIFICATION] `RECRUITMENT_CAPACITY` 와 `STUDY.CAPACITY` 가 둘 다 있을 때 어느 쪽을 먼저 볼지. 위 [정원](#정원) 은 둘 다 검사하는 제안
