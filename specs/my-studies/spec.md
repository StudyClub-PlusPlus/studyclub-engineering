# 내 스터디 API Spec

> ERD: [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY](../../docs/erd/STUDY.md) · [STUDY_GROUP](../../docs/erd/STUDY_GROUP.md) · [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) · [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md)
> 생성일: 2026-09-30
> 상태: 구현완료 (프론트 core-front `/my/joined` 구현 완료, 백엔드 담당 캡틴 확장 구현중)
>
> Story PRD:
> - [크루로서, 내가 참여 중인 스터디를 모아 볼 수 있다](../../01-planning/stories/crew-joined-studies/PRD.md)
>
> 기준 프로토타입: playground `/proto/core/ko/my/joined`
> 실제 경로: core-front `/[locale]/my/joined` 및 스터디 일정 `/[locale]/my/joined/[id]/schedule`

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/me/studies | 내 스터디 — 명부에 있는 스터디 전부 + 내가 담당 캡틴인 스터디 + 회차별 내 출석 | O | 구현완료 · 담당 캡틴 확장 구현중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

### 기존 목업과의 관계

`GET /api/me/studies` 는 원래 목업(`MockParticipantHubDataProvider`)이었고 부르는 화면이 없었다.
이 스펙이 그 응답 형태(`activeStudies`·`pastStudies`·`applications`·`upcomingMeetings`·`bookmarks`)을 **대체**했다.
같은 컨트롤러의 `GET /api/me/studies/{studyId}`(수강 상세)는 **아직 목업**이다 — 이 화면은 쓰지 않는다.
신청 목록·찜 목록은 이 화면 범위 밖이다(PRD §비고).

PRD 「API (예정)」의 `GET /api/me/studies/{id}/meetings` 는 두지 않는다.
주간 일정이 참여중·시작전 스터디 **전부의** 회차를 한꺼번에 필요로 해서, 카드마다 따로 부르면 첫 화면에서 N 번 호출이 된다. 회차는 목록 응답에 넣는다.

---

## 내 스터디 목록

### 기본 정보

- **Method**: GET
- **Path**: `/api/me/studies`
- **인증**: 필요 (온보딩 완료 — `@RequireOnboarding`)
- **설명**: 로그인 회원의 명부(`STUDY_PARTICIPANT`) 행마다 스터디 하나. 각 스터디에 내 반의 회차와 회차별 내 출석을 붙인다
  - 여기에 **내가 담당 캡틴인 스터디**(`STUDY.CREATED_BY = 나` · `STATUS != DRAFT`)를 더한다. 담당 캡틴은 반 편성 때 명부에 들어가므로, 그 전에는 명부만 보면 카드가 생기지 않는다. 아래 [담당 캡틴 카드](#담당-캡틴-카드)
  - 같은 스터디가 두 경로로 다 잡히면(반 편성 뒤) 한 개만 주고 명부 쪽 값을 쓴다. `captain` 은 true

### Query Parameters

없음. 탭 필터·10개 페이징은 화면이 한다 (PRD §2 · §5 — 주소에 남기지 않음).

> 응답 크기는 참여한 스터디 수가 아니라 **누적 회차 수**가 정한다(스터디 × 회차). 8~10회차 스터디 수십 개면 회차 수백 개로 작다. 한 응답의 회차가 1,000개를 넘기면 서버 페이징이나 종료 스터디의 회차 생략을 검토한다.

### Response — 200

```json
{
  "items": [
    {
      "studyId": 12,
      "title": "DDIA 2판 수요일반",
      "category": "BACKEND",
      "studyKind": "STUDY",
      "startAt": "2026-09-01T00:00:00Z",
      "endAt": "2026-11-10T00:00:00Z",
      "relation": "ONGOING",
      "participantStatus": "ACTIVE",
      "participantRole": "LEADER",
      "discordChannelUrl": "https://discord.com/channels/…",
      "driveUrl": "https://drive.google.com/…",
      "attendanceRate": 0.83,
      "meetings": [
        {
          "meetingId": 301,
          "sequence": 1,
          "scheduledAt": "2026-09-02T11:00:00Z",
          "startAt": "2026-09-02T11:02:00Z",
          "endAt": "2026-09-02T12:30:00Z",
          "attendanceStatus": "PRESENT",
          "countedInRate": true
        },
        {
          "meetingId": 305,
          "sequence": 5,
          "scheduledAt": "2026-10-07T11:00:00Z",
          "startAt": null,
          "endAt": null,
          "attendanceStatus": null,
          "countedInRate": false
        }
      ]
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items | Array | N | 내가 참여한 스터디(명부) 하나당 한 개. `startAt` 내림차순. 없으면 `[]` | STUDY_PARTICIPANT (`ACCOUNT_ID` = 나) |
| items[].studyId | Long | N | 상세 링크용 | STUDY.ID |
| items[].title | String | N | | STUDY.TITLE |
| items[].category | String | N | 카드 아이콘·주간 칸 색 | STUDY.CATEGORY |
| items[].studyKind | String | N | `STUDY` / `CLUB` | STUDY.STUDY_KIND |
| items[].startAt | String (ISO 8601 UTC) | Y | `relation` 판정 기준 | STUDY.START_AT |
| items[].endAt | String (ISO 8601 UTC) | Y | | STUDY.END_AT |
| items[].relation | String | N | 나와의 관계 — 탭·배지. 아래 표 | 계산: `participantStatus` + `startAt` |
| items[].participantStatus | String | Y | `ACTIVE` / `PAUSED` / `WITHDRAWN` / `COMPLETED`. 반 편성 전 담당 캡틴 카드는 null | STUDY_PARTICIPANT.STATUS |
| items[].participantRole | String | Y | `MEMBER` / `LEADER`. 네비게이터 배지·스터디 관리 버튼. 반 편성 전 담당 캡틴 카드는 null | STUDY_PARTICIPANT.PARTICIPANT_ROLE |
| items[].captain | Boolean | N | 내가 이 스터디의 **담당 캡틴**(스터디를 생성한 캡틴)이면 true — 「캡틴」 배지. 스터디 관리 버튼을 받고, 누르면 백오피스 스터디 상세로 간다. 다른 캡틴(ADMIN)이 신청해 참여한 스터디는 false(크루) | 계산: `STUDY.CREATED_BY = 나` |
| items[].discordChannelUrl | String | Y | `relation = WITHDRAWN` 이면 **항상 null** | STUDY.DISCORD_CHANNEL_URL |
| items[].driveUrl | String | Y | `relation = WITHDRAWN` 이면 **항상 null** | STUDY.DRIVE_URL |
| items[].attendanceRate | Double | Y | 0~1. 분모 0 이면 null → 화면은 숫자를 숨김 | 계산: [출석 스펙 「출석률 산식」](../attendance/spec.md#출석률-산식)과 같은 계산기 |
| items[].meetings | Array | N | 내 반 회차. `scheduledAt` 오름차순. 없으면 `[]` | STUDY_MEETING (`STUDY_GROUP_ID` = 내 명부의 반) |
| items[].meetings[].meetingId | Long | N | | STUDY_MEETING.ID |
| items[].meetings[].sequence | Integer | N | 회차 번호. 1부터 | 계산: 반 안에서 `scheduledAt` 순번 |
| items[].meetings[].scheduledAt | String (ISO 8601 UTC) | N | 예정 시각. 주간 칸·다음 회차·격자 머리 | STUDY_MEETING.SCHEDULED_AT |
| items[].meetings[].startAt | String (ISO 8601 UTC) | Y | 실제 시작 | STUDY_MEETING.START_AT |
| items[].meetings[].endAt | String (ISO 8601 UTC) | Y | 실제 종료 | STUDY_MEETING.END_AT |
| items[].meetings[].attendanceStatus | String | Y | `PRESENT` / `LATE` / `EXCUSED` / `ABSENT`. 출석 행이 없으면 null. **시작 전 회차**(`startAt` null 이고 `scheduledAt` > now)의 `ABSENT` 도 null — 회차를 만들 때 참여자 전원에게 기본으로 들어가는 값이라 화면에 결석으로 그리지 않는다. 시작 전이라도 `EXCUSED` 는 그대로 준다(사전 휴가 배지) | STUDY_ATTENDANCE.STATUS (내 계정) |
| items[].meetings[].countedInRate | Boolean | N | 이 회차가 `attendanceRate` 분모에 들어갔는지. `scheduledAt` 이 편입 시각(`JOINED_AT`) 이상이고 상한(`ACTIVE`/`PAUSED`/`COMPLETED` 는 now, `WITHDRAWN`·`DELETED` 는 떠난 시각 `LEFT_AT`) 이하일 때 true — 하차 이전 회차는 그대로 집계에 남고 이후 회차만 제외한다([user-leave spec](../user-leave/spec.md) "WITHDRAWN·DELETED", 2026-10-01). 편입 전 회차는 격자에는 보이지만 false | 계산: `AttendanceRateCalculator.countsToward` 와 같은 조건 |

#### relation — 나와의 관계

| 값 | 조건 | 탭 | 배지 |
|---|---|---|---|
| `UPCOMING` | 명부 `ACTIVE` 이고 now < `startAt` | 시작전 | 시작전 |
| `ONGOING` | 명부 `ACTIVE` 이고 now >= `startAt` (또는 `startAt` null) | 참여중 | 참여중 |
| `COMPLETED` | 명부 `COMPLETED` | 참여 종료 | 완주 |
| `WITHDRAWN` | 명부 `WITHDRAWN` | 참여 종료 | 참여 종료 |

`PAUSED` 는 아래 미확정. 확정 전까지 `ACTIVE` 와 같이 날짜로 `UPCOMING`/`ONGOING` 을 준다.

#### 담당 캡틴 카드

담당 캡틴도 그 스터디에 참여한다. 다만 명부에는 **반 편성 때** 들어간다 ([POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md), 2026-10-07).

- **반 편성 뒤** — 명부 행이 있다. 크루 카드와 똑같이 채우고 `captain` 만 true 다. 출석률·완주도 크루와 같다 (끝까지 참여하면 「완주」)
- **반 편성 전** — 명부 행이 없고 `CREATED_BY = 나` 로만 잡힌다. 명부 값이 없으니 아래처럼 채운다

| 필드 | 값 (반 편성 전) |
|---|---|
| `captain` | true |
| `participantStatus` · `participantRole` | null |
| `relation` | `STUDY.STATUS ∈ {ENDED, CLOSED}` 면 `COMPLETED`. 아니면 now < `startAt` → `UPCOMING`, 그 밖 → `ONGOING`. `WITHDRAWN` 은 나오지 않는다 |
| `discordChannelUrl` · `driveUrl` | 그대로 준다 (캡틴은 링크를 본다 — [share 2026-09-30](../../docs/share/2026-09-30-study-detail-private-urls.md)) |
| `attendanceRate` | null — 아직 출석 대상이 아니다 |
| `meetings` | `[]` — 내 반이 없다 |

#### 화면이 응답에서 계산하는 것

서버가 따로 필드를 두지 않는다. 모두 `meetings` 하나에서 나온다.

- 회차 종료 기준: `endAt` 이 있으면 `endAt`, 없으면 `scheduledAt + 120분` (예정 종료. 프로토 `attendance.ts` `DURATION_MIN` 과 같음)
- 다음 회차: `ONGOING` 은 **회차 종료 기준 > now** 인 첫 회차 — 진행 중인 회차가 끝날 때까지 다음 회차로 남아 참석 버튼이 유지된다. `UPCOMING` 은 `sequence = 1`
- 주간 일정: `relation ∈ {UPCOMING, ONGOING}` 인 스터디의 `meetings[].scheduledAt`
- 스터디 기간(PRD §4-5): 첫·마지막 회차의 `scheduledAt`
- 완주 점수판 `n/m`: `countedInRate = true` 인 회차 중 `attendanceStatus ∈ {PRESENT, LATE}` 개수 / `EXCUSED` 가 아닌 개수. 출석률과 같은 회차 집합을 본다
- 참석 버튼 활성: `scheduledAt − 30분` ≤ now ≤ 회차 종료 기준
- 디스코드 아이콘: `COMPLETED` 면 채널 URL 과 무관하게 클럽 초대 링크(완주 뒤 채널은 닫힌다 — 프로토 `joined.ts` `discordUrl`). `UPCOMING`·`ONGOING` 은 `discordChannelUrl`, null 이면 클럽 초대 링크

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음·만료 |
| 403 | ONBOARDING_REQUIRED | 온보딩 미완료 계정 |

남의 명부를 고를 파라미터가 없으므로 403/404 경로는 없다.

### 테스트

| 경우 | 기대 |
|---|---|
| 명부 ACTIVE(시작 전)·ACTIVE(시작 후)·COMPLETED·WITHDRAWN 각 1건 | 200, `relation` 이 차례로 UPCOMING·ONGOING·COMPLETED·WITHDRAWN |
| WITHDRAWN 스터디에 채널·드라이브 URL 있음 | 두 URL null |
| 시작 전 회차에 ABSENT 행 있음 | 그 회차 `attendanceStatus` null, `countedInRate` false |
| 시작 전 회차에 EXCUSED 행 있음 | 그 회차 `attendanceStatus` EXCUSED, `countedInRate` false |
| 편입(`JOINED_AT`) 전 지난 회차 | 격자에 나오고 `countedInRate` false |
| 다른 회원의 명부·출석 | 응답에 안 나옴 |
| 내가 만든(`CREATED_BY = 나`) OPEN 스터디, 반 편성 전(명부 행 없음) | 1건. `captain` true, `participantStatus`·`participantRole`·`attendanceRate` null |
| 내가 만든 DRAFT 스터디 | 응답에 안 나옴 |
| 다른 캡틴이 만든 스터디에 내가 신청해 명부 MEMBER | `captain` false |
| 담당 캡틴, 반 편성 뒤(명부 MEMBER 행 있음) | 1건만. 명부 값(출석률·회차 포함) + `captain` true |
| 토큰 없음 | 401 |
| 온보딩 미완료 | 403 ONBOARDING_REQUIRED |

### 프론트엔드 사용처

- 프로토: `frontend/apps/playground/src/app/(proto)/proto/core/[locale]/my/joined/page.tsx`
- core-front 구현: `frontend/apps/core-front/src/app/[locale]/my/joined/page.tsx` (`/[locale]/my/joined`)
- 스터디 일정: `frontend/apps/core-front/src/app/[locale]/my/joined/[id]/schedule/page.tsx` (`/[locale]/my/joined/[id]/schedule`)
- E2E 카탈로그: `frontend/apps/core-front/screen-catalog/features/my/joinedStudies.feature` · `joinedStudies.meta.ts`
- E2E 스펙: `frontend/apps/core-front/e2e/specs/joined-studies.spec.ts`

### 미확정

- 출석률에서 휴가(`EXCUSED`)는 **출석과 똑같이 센다**(1회 = 1.0) — #146(2026-09-30 머지)이 계산기·출석 스펙·ERD 를 이렇게 맞췄다. PRD §4-8 의 "휴가 회차는 계산에서 뺀다" 와 열린 #147 문서는 바뀌기 전 기준이다. 휴가 신청 자체는 MVP 이후(디스코드 09-08)라 `EXCUSED` 는 반장 정정으로만 생긴다
- [NEEDS CLARIFICATION] 명부 `PAUSED` 의 탭·배지 (PRD §4 미확정과 같음)
- [NEEDS CLARIFICATION] 클럽 디스코드 초대(로비) URL 은 지금 프론트 mock `site.discord_invite`(`frontend/packages/mock/src/index.ts`)에 있다. 서버 설정으로 옮길지만 미정 — 옮기기 전까지 이 응답에 넣지 않는다
- [NEEDS CLARIFICATION] 회차 예정 길이. 컬럼이 없어 120분으로 본다(프로토 가정). 반·스터디마다 다르면 예정 종료 컬럼이 필요하다
- 공개 상세 `GET /api/studies/{id}` 도 같은 규칙으로 막았다 — 캡틴과 참여 중단이 아닌 참여자(네비게이터 포함)에게만 `discordChannelUrl`·`driveUrl` 을 채운다 ([docs/share/2026-09-30-study-detail-private-urls.md](../../docs/share/2026-09-30-study-detail-private-urls.md))
- [NEEDS CLARIFICATION] 회차 번호 컬럼(`MEETING_NO`)이 생기면 `sequence` 소스를 바꾼다. 지금은 예정 시각 순번이라 회차를 중간에 추가하면 뒤 번호가 밀린다
