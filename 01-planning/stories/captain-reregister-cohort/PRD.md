# 캡틴은 기존 스터디를 재등록할 수 있다(기수제).

story_id: ST-021 · IA: IA-043

기준 프로토타입: 운영 콘솔 › 클럽 › 기수 — https://playground.studyclub.life/proto/console/clubs

## 1. 기본설명

· **배경** — 클럽은 매달 같은 내용으로 다음 기수를 연다. 캡틴이 매달 새로 등록하지 않도록 다음 달 기수 초안은 시스템이 만들고, 캡틴은 확인한 뒤 모집만 연다. 기수 규칙은 [POL-0012](../../_registry/policies/POL-0012-club-cohort.md).

### 진입·사용 흐름

```mermaid
flowchart LR
  A["콘솔 사이드바 「클럽」"] --> B["클럽 고르기"]
  S["스터디 상세 머리 「다음 기수 · 클럽 운영」"] --> B
  B --> C{"다음 기수가 있나?"}
  C -->|아니오| D["「{날짜}에 초안이 자동으로 만들어집니다.」"]
  D --> E["지금 초안 만들기"] --> F
  C -->|예 · 초안| F["초안 내용 확인"]
  F --> G["모집 시작"] --> H{"확인"}
  H -->|취소| F
  H -->|모집 시작| I["공개 · 모집중"]
  C -->|예 · 모집중| I
```

### 완료 기준

1. 이번 기수의 제목 · 진행 기간 · 참여 중 인원 확인
2. 매월 정한 날 다음 달 기수 초안 자동 생성 — 미공개
3. 초안 내용 확인 — 진행 기간 · 모집 기간 · 정원과 남은 자리 · 신청 폼 · 이어서 참여 인원
4. 「모집 시작」 확인 뒤 공개 — 누른 날이 모집 시작일, 마감은 이번 달 말일
5. 다음 기수가 아직 없을 때 자동 생성 예정일 안내와 「지금 초안 만들기」
6. 클럽별 자동 초안 켜고 끄기 · 만드는 날(1~28일) 변경
7. 스터디 상세(클럽)에서 클럽 운영으로 이동

---

## 2. 화면명세

> **화면**: 운영 콘솔 › 클럽 › 기수 — https://playground.studyclub.life/proto/console/clubs
>
> 아래 번호별 명세는 프로토의 **설명 보기**에서 그대로 가져온다. 손으로 고치지 않는다 —
> 고치려면 화면 옆 `spec.ts` 를 고치고 `pnpm --filter playground export-specs` 를 돌린다.

![다음 기수 — 15일에 만들어진 초안](screens/club-next-draft.png)

![다음 기수 — 초안 만들기 전](screens/club-next-none.png)

![모집 시작 확인](screens/club-next-confirm.png)

<!-- spec:start cohort -->

> 클럽 기수는 달 하나다 — 1일 시작, 말일 종료 (POL-0012)
>
> 화면 위 클럽 고르기(얼리버드 · WEEKLY X · Daily LeetCode)와 「기수 · 출석부」 탭은 이 지면의 공통 틀이다

### 1 — 이번 기수

- **내용**: 지금 진행 중인 기수의 제목
- **데이터**: `GET /api/admin/clubs/{programId}` — `currentCohort`

#### 1-1 — 진행 상태

- **내용**: 이번 기수가 진행 중임을 알린다

#### 1-2 — 진행 기간

- **내용**: 그 달 1일 ~ 말일. 요일을 함께 적는다

#### 1-3 — 참여 중

- **내용**: 참여 중단하지 않은 참여자 수
- **데이터**: `STUDY_PARTICIPANT.STATUS = ACTIVE` 수

### 2 — 다음 기수

- **내용**: 다음 달 기수의 제목 — 「{클럽} {YYYY}년 {M}월」
- **정책**: 한 클럽에 같은 달 기수는 하나뿐이다 — 이미 있으면 초안을 다시 만들지 않는다

#### 2-1 — 다음 기수 상태

- **내용**: 아직 없음 · 초안(사이트 미공개) · 모집중(마감까지 남은 날) 셋을 구분해 알린다

#### 2-2 — 초안 내용

- **내용**
  - 진행: 다음 달 1일 ~ 말일
  - 모집: 모집 시작한 날 ~ 이번 달 말일. 모집 중이면 실제 시작일
  - 정원: 이번 기수 값과 남은 자리 (정원 − 이어서 참여 − 신청). 정원이 없으면 「제한 없음」
  - 신청 폼: 이번 기수 폼을 그대로 쓴다. 클럽이 받는 값(기상 목표 · LeetCode ID)은 필수
  - 이어서 참여: 다음 기수로 넘어갈 예정 인원
  - 신청: 모집 중일 때 들어온 신청 수
- **정책**
  - 소개 · 상세 설명 · 카테고리 · 디스코드 채널 · 드라이브 · 정원 · 신청 폼은 이번 기수 값을 복사한다
  - 복사한 값을 고쳐도 이번 기수는 그대로다
  - 모집 마감은 이번 달 말일 23:59 (캡틴 시간대)
- **데이터**: 새 `STUDY`(`STATUS = DRAFT`) · `STUDY_RECRUITMENT` 1행 · 기본 반 1개

#### 2-3 — 모집 시작

- **조건**: 다음 기수가 초안일 때
- **동작**: 누르면 확인 창(2-4)이 열린다

#### 2-4 — 모집 시작 확인

- **조건**: 「모집 시작」을 눌렀을 때
- **내용**: 「‘{기수 제목}’ 모집을 시작하시겠습니까?」 · 「사용자 사이트에 공개되고 오늘부터 {말일}까지 신청을 받습니다.」
- **동작**
  - 「모집 시작」 — 기수를 공개하고 오늘을 모집 시작일로 적는다. 다음 기수 상태가 모집중으로 바뀐다
  - 「취소」(기본 포커스) — 아무것도 바꾸지 않고 닫는다
- **정책**: 공개 조건은 스터디 공개와 같다 — 신청 폼이 연결되어 있어야 한다 (POL-0003)
- **데이터**: `POST /api/admin/studies/{studyId}/publish`

#### 2-5 — 초안 예정 안내

- **조건**: 다음 기수가 아직 없을 때
- **내용**
  - 자동 초안이 켜져 있으면 「{날짜}에 초안이 자동으로 만들어집니다.」
  - 꺼져 있으면 「자동 초안이 꺼져 있습니다. 직접 만들어 주세요.」

#### 2-6 — 지금 초안 만들기

- **조건**: 다음 기수가 아직 없을 때
- **동작**: 누르면 자동 초안과 같은 내용으로 다음 기수 초안을 바로 만든다
- **데이터**: `POST /api/admin/clubs/{programId}/next-cohort`

### 3 — 자동 초안 설정

- **내용**: 클럽마다 따로 정한다
- **데이터**: `PATCH /api/admin/clubs/{programId}` — `autoDraftEnabled` · `autoDraftDay`

#### 3-1 — 자동 만들기 켜고 끄기

- **동작**: 켜면 매월 정한 날 0시(캡틴 시간대)에 다음 달 기수 초안이 미공개로 만들어진다
- **정책**: 기본값은 켜짐

#### 3-2 — 초안 만드는 날

- **내용**: 매월 1~28일 중 하루. 기본 15일
- **정책**
  - 꺼져 있으면 고를 수 없다
  - 정한 날이 이미 지났으면 다음 달부터 적용된다

<!-- spec:end cohort -->

### 상태별 화면

| 상태 | 화면 | 카피 |
| --- | --- | --- |
| 다음 기수 없음 · 자동 켜짐 | 예정일 안내 · 지금 초안 만들기 | 「12/15(화)에 초안이 자동으로 만들어집니다.」 |
| 다음 기수 없음 · 자동 꺼짐 | 안내 · 지금 초안 만들기 | 「자동 초안이 꺼져 있습니다. 직접 만들어 주세요.」 |
| 초안 | 초안 내용 · 모집 시작 | 「초안 · 미공개」 |
| 모집 시작 확인 | 확인 창 | 「‘얼리버드 2027년 1월’ 모집을 시작하시겠습니까?」 · 「사용자 사이트에 공개되고 오늘부터 12/31(목)까지 신청을 받습니다.」 |
| 모집중 | 신청 수 포함 초안 내용 | 「모집중 · D-15」 |

### 데이터 관계

```mermaid
erDiagram
  STUDY_PROGRAM ||--o{ STUDY : "기수 (달마다 하나)"
  STUDY ||--|| STUDY_RECRUITMENT : "모집"
  STUDY_PROGRAM {
    varchar STUDY_KIND "CLUB"
    boolean AUTO_DRAFT_ENABLED "기본 true"
    tinyint AUTO_DRAFT_DAY "1~28, 기본 15"
  }
  STUDY {
    bigint PROGRAM_ID
    date COHORT_MONTH "그 달 1일. 프로그램 안에서 유일"
    varchar STATUS "초안은 DRAFT"
  }
```

### 비고

- 범위 밖: 초안 내용 고치기(스터디 상세 정보 탭 — ST-004) · 신청 폼 고치기(ST-023) · 이어서 참여(ST-042)
- 구현 지시: 스터디 등록 창의 「기존 클럽의 새 기수」는 그대로 둔다. 클럽 운영 화면과 같은 프로그램 · 같은 달 기수 유일 규칙을 따른다

## 3. 시스템 요건

### 개발 범위

> 2026-11-24 `beta` 기준.

| 구분 | 대상 | 지금 | 할 일 |
|---|---|---|---|
| FE | back-office-front 클럽 운영 화면 (`/clubs`) — 기수 탭 | 없음 | 프로토대로 만든다 |
| FE | 스터디 상세(클럽) 머리 「다음 기수 · 클럽 운영」 | 「다음 기수 만들기」 창 | 클럽 운영으로 가는 링크로 바꾼다 |
| BE | `GET /api/admin/clubs` · `GET /api/admin/clubs/{programId}` | 스펙 없음 → 스펙작성중 | 구현 |
| BE | `PATCH /api/admin/clubs/{programId}` (자동 초안 설정) | 스펙작성중 | 구현 |
| BE | `POST /api/admin/clubs/{programId}/next-cohort` · 자동 초안 스케줄러 | 스펙작성중 | 구현 |
| BE | `POST /api/admin/studies/{studyId}/publish` | 구현완료 | 없음 |
| BE | `STUDY_PROGRAM.AUTO_DRAFT_*` · `STUDY.COHORT_MONTH` 컬럼 | 없음 | 마이그레이션 |

### 데이터

- `STUDY_PROGRAM.AUTO_DRAFT_ENABLED` BOOLEAN NOT NULL DEFAULT TRUE — `CLUB` 만 쓴다
- `STUDY_PROGRAM.AUTO_DRAFT_DAY` TINYINT NOT NULL DEFAULT 15 — 1~28
- `STUDY.COHORT_MONTH` DATE NULL — 클럽 기수의 달(그 달 1일). `UNIQUE(PROGRAM_ID, COHORT_MONTH)`. 스터디는 NULL

### 처리

- 자동 초안: 매일 0시(캡틴 시간대)에 `AUTO_DRAFT_ENABLED` 이고 오늘이 `AUTO_DRAFT_DAY` 인 클럽마다 다음 달 기수를 만든다. 이미 있으면 건너뛴다
- 초안 내용
  - `TITLE` = 「{프로그램 제목} {YYYY}년 {M}월」
  - `START_AT` = 다음 달 1일 0시 · `END_AT` = 다음 달 말일 24시 (기수 시간대)
  - `RECRUIT_DEADLINE_AT` = 이번 달 말일 23:59
  - 소개 · 상세 설명 · 카테고리 · 시간대 · 디스코드 채널 · 드라이브 · 정원 · 신청 폼은 이번 기수(같은 프로그램에서 `COHORT_MONTH` 가 가장 늦은 기수)에서 복사
  - `STATUS = DRAFT` · 기본 반 1개 · `STUDY_RECRUITMENT` 1행
- 「지금 초안 만들기」는 같은 처리를 즉시 한다. 이미 있으면 409
- 「모집 시작」은 기존 공개 처리와 같다 — 공개한 날이 `STUDY_RECRUITMENT.START_AT`

### API

| 메서드 | 경로 | 권한 |
| --- | --- | --- |
| GET | `/api/admin/clubs` — 클럽 목록 | 캡틴 |
| GET | `/api/admin/clubs/{programId}` — 이번 기수 · 다음 기수 · 자동 초안 설정 | 캡틴 |
| PATCH | `/api/admin/clubs/{programId}` — `autoDraftEnabled` · `autoDraftDay` | 캡틴 |
| POST | `/api/admin/clubs/{programId}/next-cohort` — 지금 초안 만들기 | 캡틴 |
| POST | `/api/admin/studies/{studyId}/publish` — 모집 시작 | 캡틴 |

계약은 [club-cohort/spec.md](../../../specs/club-cohort/spec.md).

### 권한

- 캡틴만. 서버에서 검증한다 ([POL-0001](../../_registry/policies/POL-0001-roles.md))

### 퍼널·계측

- 퍼널 단계: 유입 · 가입 — 클럽 모집이 매달 빠짐없이 열린다
- 추가 이벤트 없음. 모집 시작은 기존 공개 기록으로 본다
