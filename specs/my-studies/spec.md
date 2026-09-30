# 내 스터디 API Spec

> ERD: [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY](../../docs/erd/STUDY.md) · [STUDY_GROUP](../../docs/erd/STUDY_GROUP.md) · [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) · [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md)
> 생성일: 2026-09-30
> 상태: 구현완료
>
> Story PRD:
> - [크루로서, 내가 참여 중인 스터디를 모아 볼 수 있다](../../planning/stories/crew-joined-studies/PRD.md)
>
> 기준 프로토타입: playground `/proto/core/ko/my/joined`

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/me/studies | 내 스터디 — 명부에 있는 스터디 전부 + 회차별 내 출석 | O | 구현완료 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

### 기존 목업과의 관계

`GET /api/me/studies` 는 원래 목업(`MockParticipantHubDataProvider`)이었고 부르는 화면이 없었다.
이 스펙이 그 응답 shape(`activeStudies`·`pastStudies`·`applications`·`upcomingMeetings`·`bookmarks`)을 **대체**했다.
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

### Query Parameters

없음. 탭 필터·10개 페이징은 화면이 한다 (PRD §2 · §5 — 주소에 남기지 않음).

> 응답 크기는 명부 행 수가 아니라 **누적 회차 수**가 정한다(스터디 × 회차). 8~10회차 스터디 수십 개면 회차 수백 개로 작다. 한 응답의 회차가 1,000개를 넘기면 서버 페이징이나 종료 스터디의 회차 생략을 검토한다.

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
| items | Array | N | 명부 행마다 하나. `startAt` 내림차순. 없으면 `[]` | STUDY_PARTICIPANT (`ACCOUNT_ID` = 나) |
| items[].studyId | Long | N | 상세 링크용 | STUDY.ID |
| items[].title | String | N | | STUDY.TITLE |
| items[].category | String | N | 카드 아이콘·주간 칸 색 | STUDY.CATEGORY |
| items[].studyKind | String | N | `STUDY` / `CLUB` | STUDY.STUDY_KIND |
| items[].startAt | String (ISO 8601 UTC) | Y | `relation` 판정 기준 | STUDY.START_AT |
| items[].endAt | String (ISO 8601 UTC) | Y | | STUDY.END_AT |
| items[].relation | String | N | 나와의 관계 — 탭·배지. 아래 표 | 계산: `participantStatus` + `startAt` |
| items[].participantStatus | String | N | `ACTIVE` / `PAUSED` / `WITHDRAWN` / `COMPLETED` | STUDY_PARTICIPANT.STATUS |
| items[].participantRole | String | N | `MEMBER` / `LEADER` / `CO_LEADER`. 네비게이터 배지·스터디 관리 버튼 | STUDY_PARTICIPANT.PARTICIPANT_ROLE |
| items[].discordChannelUrl | String | Y | `relation = WITHDRAWN` 이면 **항상 null** | STUDY.DISCORD_CHANNEL_URL |
| items[].driveUrl | String | Y | `relation = WITHDRAWN` 이면 **항상 null** | STUDY.DRIVE_URL |
| items[].attendanceRate | Double | Y | 0~1. 분모 0 이면 null → 화면은 숫자를 숨김 | 계산: [출석 스펙 「출석률 산식」](../attendance/spec.md#출석률-산식)과 같은 계산기 |
| items[].meetings | Array | N | 내 반 회차. `scheduledAt` 오름차순. 없으면 `[]` | STUDY_MEETING (`STUDY_GROUP_ID` = 내 명부의 반) |
| items[].meetings[].meetingId | Long | N | | STUDY_MEETING.ID |
| items[].meetings[].sequence | Integer | N | 회차 번호. 1부터 | 계산: 반 안에서 `scheduledAt` 순번 |
| items[].meetings[].scheduledAt | String (ISO 8601 UTC) | N | 예정 시각. 주간 칸·다음 회차·격자 머리 | STUDY_MEETING.SCHEDULED_AT |
| items[].meetings[].startAt | String (ISO 8601 UTC) | Y | 실제 시작 | STUDY_MEETING.START_AT |
| items[].meetings[].endAt | String (ISO 8601 UTC) | Y | 실제 종료 | STUDY_MEETING.END_AT |
| items[].meetings[].attendanceStatus | String | Y | `PRESENT` / `LATE` / `EXCUSED` / `ABSENT`. 출석 행이 없으면 null. **시작 전 회차**(`startAt` null 이고 `scheduledAt` > now)의 `ABSENT` 도 null — 회차 생성 때 깔린 기본값이라 화면에 결석으로 그리지 않는다. 시작 전이라도 `EXCUSED` 는 그대로 준다(사전 휴가 배지) | STUDY_ATTENDANCE.STATUS (내 계정) |
| items[].meetings[].countedInRate | Boolean | N | 이 회차가 `attendanceRate` 분모에 들어갔는지. `scheduledAt` ≤ now 이고 `scheduledAt` ≥ 편입 시각(`JOINED_AT`)이며 명부가 `WITHDRAWN` 이 아닐 때 true. 편입 전 회차는 격자에는 보이지만 false | 계산: `AttendanceRateCalculator` 와 같은 조건 |

#### relation — 나와의 관계

| 값 | 조건 | 탭 | 배지 |
|---|---|---|---|
| `UPCOMING` | 명부 `ACTIVE` 이고 now < `startAt` | 시작전 | 시작전 |
| `ONGOING` | 명부 `ACTIVE` 이고 now >= `startAt` (또는 `startAt` null) | 참여중 | 참여중 |
| `COMPLETED` | 명부 `COMPLETED` | 참여 종료 | 완주 |
| `WITHDRAWN` | 명부 `WITHDRAWN` | 참여 종료 | 참여 종료 |

`PAUSED` 는 아래 미확정. 확정 전까지 `ACTIVE` 와 같이 날짜로 `UPCOMING`/`ONGOING` 을 준다.

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
| 토큰 없음 | 401 |
| 온보딩 미완료 | 403 ONBOARDING_REQUIRED |

### 프론트엔드 사용처

- 프로토: `frontend/apps/playground/src/app/(proto)/proto/core/[locale]/my/joined/page.tsx`
- core-front 이관 시 `lib/api/` 에 `getMyStudies()`

### 미확정

- 휴가(`EXCUSED`) 산식은 **출석과 같이 1.0** — #146(2026-09-30 머지)이 계산기·출석 스펙·ERD 를 이 값으로 맞췄다. PRD §4-8 의 "분모에서 뺀다" 와 열린 #147 문서는 그 전 값이다. 휴가 신청 자체는 MVP 이후(디스코드 09-08)라 `EXCUSED` 는 반장 정정으로만 생긴다
- [NEEDS CLARIFICATION] 명부 `PAUSED` 의 탭·배지 (PRD §4 미확정과 같음)
- [NEEDS CLARIFICATION] 클럽 디스코드 초대(로비) URL 은 지금 프론트 mock `site.discord_invite`(`frontend/packages/mock/src/index.ts`)에 있다. 서버 설정으로 옮길지만 미정 — 옮기기 전까지 이 응답에 넣지 않는다
- [NEEDS CLARIFICATION] 회차 예정 길이. 컬럼이 없어 120분으로 본다(프로토 가정). 반·스터디마다 다르면 예정 종료 컬럼이 필요하다
- 공개 상세 `GET /api/studies/{id}` 도 같은 규칙으로 막았다 — 캡틴·네비게이터·참여 중단이 아닌 참여자에게만 `discordChannelUrl`·`driveUrl` 을 채운다 ([share/2026-09-30-study-detail-private-urls.md](../../share/2026-09-30-study-detail-private-urls.md))
- [NEEDS CLARIFICATION] 회차 번호 컬럼(`MEETING_NO`)이 생기면 `sequence` 소스를 바꾼다. 지금은 예정 시각 순번이라 회차를 중간에 추가하면 뒤 번호가 밀린다
