# 스터디 회차(미팅) API Spec

> ERD: [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) · [STUDY_GROUP](../../docs/erd/STUDY_GROUP.md) · [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md)
> 생성일: 2026-10-02
> 상태: 스펙작성중
>
> Story PRD:
> - [네비게이터로서, 스터디 회차를 등록할 수 있다](../../planning/stories/navigator-register-sessions/PRD.md)
>
> 관련 스펙: [명부·출석](../attendance/spec.md) — 출석 조회·upsert 만 다루고 범위를 닫아 둔 스펙이라 여기서 고치지 않는다. 이 스펙이 만들고 지운 회차·출석 행은 그 스펙의 `GET /api/studies/{studyId}/attendances` 와 [내 스터디](../my-studies/spec.md) 에 그대로 보인다.

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies/{studyId}/meetings | 분반 회차 목록 (발표자 · 규칙 포함) | O (그 분반 참여자 · 캡틴) | 스펙작성중 |
| POST | /api/studies/{studyId}/meetings | 회차 추가 (한 번 · 반복) | O (그 분반 네비게이터 · 캡틴) | 스펙작성중 |
| PUT | /api/studies/{studyId}/meetings/{meetingId} | 회차 수정 (시각 · 제목 · 발표자) | O (그 분반 네비게이터 · 캡틴) | 스펙작성중 |
| DELETE | /api/studies/{studyId}/meetings/{meetingId} | 회차 삭제 (한 회차씩, 킥오프 불가) | O (그 분반 네비게이터 · 캡틴) | 스펙작성중 |
| PUT | /api/studies/{studyId}/meetings/{meetingId}/presenters/{slot}/me | 발표 신청 (빈 칸에 나) | O (그 분반 참여자) | 스펙작성중 |
| DELETE | /api/studies/{studyId}/meetings/{meetingId}/presenters/{slot}/me | 발표 신청 취소 (내 이름 빼기) | O (그 분반 참여자) | 스펙작성중 |
| PUT | /api/studies/{studyId}/groups/{groupId}/rules | 스터디 규칙 저장 | O (그 분반 네비게이터 · 캡틴) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 결정 사항

PRD 「4. 미확정」 을 아래로 닫는다. 1~6 · 9~12 는 기획(세은님)과 합의(3 은 2026-10-02, 2 · 9~12 는 2026-10-05 답변), 7~8 은 이 스펙에서 정했다.

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| 1 | 제목 · 회차 번호 | `STUDY_MEETING.TITLE` VARCHAR(50) NULL 추가. 회차 번호는 저장하지 않고 분반 회차를 `SCHEDULED_AT` 오름차순으로 센 순번으로 계산 | 번호를 저장하면 추가·삭제·수정 때마다 뒤 회차를 전부 다시 써야 한다. PRD 계산 규칙과 같다 |
| 2 | 반복 | **반복 묶음 ID 를 저장한다** — `STUDY_MEETING.SERIES_ID` VARCHAR(36) NULL. 한 요청으로 회차를 2개 이상 만들면 서버가 UUID 하나를 만들어 그 회차 모두에 넣는다. 한 번만 만든 회차는 null. 요청 바디는 그대로다. **쓰는 기능은 아직 없다** — 삭제·수정은 한 회차씩이고(PRD 3-5 「이후 반복 모두」 없음), 목록의 반복 표시도 두지 않는다 | 기획 답변 (2026-10-05). 반복 단위 수정·삭제를 나중에 붙이려면 만들 때 묶음을 남겨야 한다 — 저장하지 않고 지나간 회차는 나중에 묶을 방법이 없다 |
| 3 | 권한 | 그 분반의 `STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER` 또는 **그 스터디를 만든 캡틴**(`STUDY.CREATED_BY = 나`). 다른 캡틴(ADMIN)은 이 사용자 사이트 API 에서 특별 대우하지 않는다 — 참여했으면 크루, 아니면 403. 서버에서 검증 | PRD 권한 절 + POL-0001 「회차 관리 — 담당 반에 한해 캡틴, 네비게이터」. 「담당 캡틴」을 스터디를 만든 캡틴으로 정했다 (기획 답변 2026-10-06). 운영자 전체 관리는 백오피스(`/api/admin`) 몫 |
| 4 | 회차 변경 알림 | 범위 밖 | 알림 스펙([notification](../notification/spec.md))에 이벤트가 생기면 따로 붙인다 |
| 5 | 첫 회차 등록 시 `STUDY.STATUS` | **`OPEN → ONGOING` 으로 바꾸지 않는다** | `Study.recruitStatus()` 가 `status == OPEN` 일 때만 값을 주고 그 밖엔 null 이라, 모집 중에 회차를 미리 깔면 모집이 닫힌다 (`phase()` 도 시작 전 ONGOING 을 「종료」 로 판정한다). 공개 여부는 #174 이후 `isPubliclyVisible()` 이 `status != DRAFT` 라 영향이 없다. 「진행 중」 은 지금처럼 `Study.phase()` 가 `STUDY.START_AT` 경과로 판정한다. [STUDY ERD 전이표](../../docs/erd/STUDY.md)와 어긋나 ERD 에 메모를 남겼다 |
| 6 | 클럽(모임형이 아닌 출석) | 범위 밖. 이 API 는 분반에 회차를 까는 스터디만 다룬다 | 클럽의 출석 단위가 회차인지부터 정해지지 않았다 |
| 7 | API 경로 | `/api/studies/{studyId}/meetings` (+ `/{meetingId}`) | 아래 「경로」 |
| 8 | 반복 전달 방식 | **날짜 목록**(`scheduledAts[]`, UTC)으로 보낸다. 규칙(매일·매주·요일·종료일)은 보내지 않는다 | 아래 「반복을 날짜 목록으로 보내는 이유」 |
| 9 | 누가 보나 | **그 분반 참여자 전원이 목록을 본다.** 고치기(추가·수정·삭제·규칙)는 네비게이터·캡틴 | 구글 시트 출석부를 참가자 모두가 보던 것을 옮긴다. 아래 「권한 판정」 |
| 10 | 발표자 | `STUDY_MEETING.PRESENTER1_PARTICIPANT_ID` · `PRESENTER2_PARTICIPANT_ID` (BIGINT NULL → `STUDY_PARTICIPANT.ID`). 네비게이터·캡틴은 누구든 지정. 크루는 빈 칸에 자기만 넣고 자기만 뺀다(선착순, 한 회차에 한 칸). 발표 여부는 따로 저장하지 않는다 — 출석부의 발표 표시·횟수는 이 두 칸에서 계산 | 시트의 「발표자1·2」 칸과 「발표 여부」 칸이 같은 사실을 두 번 적어 어긋났다. 하나만 둔다 |
| 11 | 킥오프 | `STUDY_MEETING.MEETING_TYPE` VARCHAR(16) NOT NULL DEFAULT `REGULAR` — `KICKOFF` · `REGULAR`. 분반마다 킥오프 하나, 번호 0. 지울 수 없고 발표자가 없다. 정규 회차는 킥오프 뒤로만 둔다. **출석은 찍고 출석률에서 뺀다** | 모든 스터디는 킥오프에서 규칙·일정·발표자를 정한다. 시트는 0회차로 적고 참석만 기록했다 |
| 12 | 스터디 규칙 | `STUDY_GROUP.RULES` VARCHAR(500) NULL — 500자 이하. 네비게이터·캡틴이 고치고 참여자 전원이 본다 | 시트의 규칙 칸. 반마다 진행 방식이 달라 분반에 둔다 |

### 경로

- 사용자 사이트(내 스터디 → 스터디 일정)가 부르므로 `/api` 아래, `/api/admin` 이 아니다 ([endpoint-convention](../../docs/backend-development-guide/api/endpoint-convention.md#관객으로-경로를-가른다--apiadmin)). 캡틴(ADMIN)도 같은 경로로 통과한다. 백오피스 화면이 회차를 다루게 되면 그때 `/api/admin/...` 를 따로 만든다.
- 출석과 같은 모양을 따른다 — `/api/studies/{studyId}/attendances` 처럼 스터디 아래 하위 리소스, 분반은 `studyGroupId` 로 지정. 회차 ID 가 전역 고유라 `/study-groups/{groupId}` 를 경로에 끼우지 않는다.
- 수정은 `PUT` — 시각·제목은 늘 함께 보내 전체 교체한다. 발표자 두 칸만 예외로, **바꾼 칸만 보내고 빠진 칸은 그대로 둔다**(아래 회차 수정). 화면을 연 사이 크루가 신청한 칸을 옛 값으로 덮지 않기 위해서다.

### 반복을 날짜 목록으로 보내는 이유

서버는 어느 쪽이든 같은 날 중복 · 31일 상한 · 지난 시각을 다시 검증해야 한다(PRD 3. 처리). 차이는 **반복 전개를 누가 하느냐**다.

| | 규칙으로 보냄 | 날짜 목록으로 보냄 (채택) |
|---|---|---|
| 서버 | 매일·매주·요일 전개 + 시간대·서머타임 계산 + 겹치는 날 건너뛰기를 새로 구현 | 받은 시각 하나하나를 검증만 한다 |
| 미리보기(PRD 7-6) | 화면도 같은 전개를 해야 한다 → **같은 규칙을 두 곳에서 구현**, 어긋나면 미리보기와 실제 결과가 다르다 | 화면이 전개한 결과를 그대로 보낸다 → 미리보기 = 저장 결과 |
| 서머타임 | 서버가 분반 시간대로 계산 | 화면이 현지 시각 → UTC 로 바꿔 보낸다 (PRD 7-2 「서버에는 UTC 로 보낸다」 와 같다) |
| 검증 강도 | 같음 — 서버는 결과 날짜들로 판정한다 | 같음 |

전개 규칙(시작 날짜 이후 첫 해당 요일, 종료일 포함 등)은 화면의 일이고, 서버가 지켜야 할 불변식(중복·상한·과거)은 목록만으로 다 검사된다. 서버에 규칙 엔진을 둘 이유가 없다.

**31일 상한은 두 겹이다.** PRD 7-4 의 「시작 날짜 ~ 종료일 31일」 은 화면이 **고른 기간**을 막는다. 서버는 고른 기간을 받지 않으므로 **만들어지는 회차들**이 31일 안에 드는지만 다시 본다 (아래 회차 추가 검증). 고른 기간이 31일 안이면 결과도 반드시 그 안이라 서버 검사가 화면 검사보다 느슨할 뿐 어긋나지 않는다.

### 권한 판정

**고치기**(추가 · 수정 · 삭제 · 규칙 저장):

1. 그 스터디를 만든 캡틴(`STUDY.CREATED_BY = 나`) → 통과. **다른 ADMIN 은 통과하지 않는다** — 참여했으면 아래 크루 판정을 따른다
2. `STUDY_PARTICIPANT` 에 `(STUDY_GROUP_ID = 대상 분반, ACCOUNT_ID = 나, PARTICIPANT_ROLE = LEADER)` 행이 있으면 통과
3. 그 밖 → 403

**보기**(목록 GET): 위 1·2 이거나, 그 분반에 내 활성 명부 행(`STATUS IN (ACTIVE, PAUSED)`)이 있으면 통과. 그 밖 → 403

**발표 신청·취소**: 그 분반에 내 활성 명부 행이 있어야 한다. **캡틴 우회 없음** — 발표자 칸에 넣을 명부 행이 없으면 신청할 수 없다. 명부에 없는 (만든) 캡틴은 회차 수정(PUT)으로 지정한다.

> 기존 `@RequireCaptainOrNavigator` · `StudyCaptainGuard` 는 `SYSTEM_ROLE = ADMIN` 이면 누구나 통과시킨다. 이 스펙의 사용자 사이트 API 에서는 「그 스터디를 만든 캡틴」으로 좁혀야 한다 (구현 메모).

> 기존 `StudyCaptainGuard.assertCaptainOrNavigator` 는 **스터디** 범위로 본다. 회차는 **분반** 범위라 같은 스터디의 다른 분반 네비게이터는 통과하면 안 된다 — 분반 범위 판정이 따로 필요하다.
>
> [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md) 스터디 단위 표에 「회차 관리」 행을 더했다 — 「담당 반에 한해 캡틴, 네비게이터」 (기획 답변 2026-10-02).

### 「시작한 회차」 판정

`now >= SCHEDULED_AT` **또는** `START_AT IS NOT NULL` 이면 시작한 회차다. 수정·삭제를 거절한다(409 `MEETING_ALREADY_STARTED`). 스터디 일정 화면은 이 회차를 흐린 줄로 보이고 칸을 잠근다 (PRD 3-2).

PRD 는 `SCHEDULED_AT` 경과만 말하지만, 디스코드 출석 체크가 예정 시각 전에 회차를 열 수 있다(`StudyMeeting.start`, [discord-attendance](../discord-attendance/spec.md)). 그때는 출석이 이미 찍혀 있어 PRD 3-2 의 「시작한 회차는 고치거나 지울 수 없다 — 출석이 기록돼 있다」 와 같은 이유로 막는다.

### 「같은 날」 판정

분반 시간대(`STUDY_GROUP.TIMEZONE`)의 현지 날짜(`LocalDate`)로 본다. `TIMEZONE` 이 비어 있으면 `Asia/Seoul`. 31일 상한도 같은 현지 날짜로 잰다 — `max(날짜) − min(날짜) ≤ 30일`. 배열 순서는 상관없고, UTC 경과 시간으로 재지 않는다 (서머타임이 낀 30일이 30일 1시간이 되어 정상 요청이 걸린다).

### 잠금

추가·수정·삭제는 한 트랜잭션에서 아래 순서로 잠근 뒤 검증한다.

1. `STUDY_GROUP` 행 `FOR UPDATE` — 회차가 하나도 없는 분반에서도 동시 추가를 줄 세운다. 회차 행만 잠그면 잠글 행이 없어 두 요청이 함께 INSERT 까지 가다 교착할 수 있다.
2. **수정·삭제만** 분반 회차 `FOR UPDATE` (`StudyMeetingRepository.findByStudyGroupIdForUpdate`) — 디스코드 출석이 같은 잠금으로 회차를 자동 시작한다. 이 잠금을 쥔 뒤에 「시작한 회차」 를 판정해야, 판정 직후 디스코드가 그 회차를 여는 일이 없다. 추가는 회차 행을 잠그지 않는다 — 시작 판정이 없고, 회차 범위를 `FOR UPDATE` 로 잡으면 회차 없는 두 분반이 인덱스 끝 gap 을 함께 잡고 서로의 INSERT 를 기다리다 교착한다. 대신 분반 잠금을 트랜잭션의 첫 조회로 둬서, 그 뒤의 일반 조회가 먼저 끝난 같은 분반 추가를 보게 한다 (REPEATABLE READ 스냅샷은 첫 일반 조회 때 잡힌다).
3. 추가는 회차를 **예정 시각 오름차순**으로 INSERT 한다. 디스코드 출석은 한 트랜잭션에서 여러 분반의 회차를 차례로 잠그는데, 그 잠금이 이 분반 앞 gap 을 쥔 상태에서 뒤쪽 회차를 먼저 넣으면 디스코드는 그 미커밋 행을, 추가는 앞쪽 gap 을 서로 기다려 교착한다. 앞에서부터 넣으면 아무 행도 넣기 전에 기다린다.
4. 「시작한 회차」·「지난 시각」 은 잠금을 얻은 **뒤** 의 시각으로 잰다 — 잠금을 기다리는 동안 예정 시각이 지날 수 있다.
5. 예정 시각은 초로 잘라 검증·저장한다. `SCHEDULED_AT` 은 소수초 없는 `DATETIME` 이라 MySQL 이 반올림하면 검증한 날짜와 저장된 날짜가 갈린다.

**출석 upsert 도 회차를 잠그고 읽는다.** 쓰기 자체도 한 문장 upsert 로 바꿨다 ([명부·출석 스펙](../attendance/spec.md) 서버 동작). `POST /api/studies/{studyId}/attendances` 는 스터디 단위 권한이라 다른 분반 네비게이터도 이 분반 출석을 쓸 수 있다. 회차 검증을 잠금 없이 하면, 검증과 저장 사이에 회차가 지워져 지운 회차의 출석 행이 다시 생긴다 (`STUDY_ATTENDANCE → STUDY_MEETING` 외래키는 없다). upsert 가 대상 회차를 잠그고 읽게 바꾸면 삭제가 먼저 커밋된 경우 회차를 못 찾아 기존 계약대로 400 이 나간다 — [명부·출석 스펙](../attendance/spec.md)의 계약은 그대로다.

---

## 분반 회차 목록

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}/meetings`
- **인증**: 필요 — 그 분반 참여자 · 캡틴 (위 「권한 판정」 보기)
- **설명**: 한 분반의 회차를 킥오프부터 지난 회차까지 일정순으로 돌려준다. 화면 머리(분반 이름 · 시간대 · 정규 시작 시각 · 네비게이터 · 규칙)와 내 권한도 함께.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| studyGroupId | Long | N | 분반 ID. 없으면 이 스터디에서 내 명부 행(`STUDY_PARTICIPANT`, 역할 무관)이 속한 분반 — 한 기수 안 여러 반 동시 소속은 금지라 하나로 정해진다. 명부에 없는 캡틴은 필수 → 없으면 400. 정한 분반에 대해 권한 판정은 그대로 한다 |

### Request Body

없음

### Response — 200

```json
{
  "studyGroup": {
    "id": 3,
    "name": "목요일반",
    "timezone": "Asia/Seoul",
    "startTime": "20:00",
    "navigatorName": "jamiekim80",
    "rules": "1. 각 주차에 최대 2명이 발표합니다.\n2. ..."
  },
  "me": { "participantId": 77, "canEdit": false },
  "participants": [
    { "participantId": 77, "name": "홍길동" },
    { "participantId": 78, "name": "건우" }
  ],
  "meetings": [
    {
      "id": 40,
      "type": "KICKOFF",
      "number": 0,
      "scheduledAt": "2026-09-24T11:00:00Z",
      "title": "킥오프",
      "presenter1": null,
      "presenter2": null,
      "started": true
    },
    {
      "id": 41,
      "type": "REGULAR",
      "number": 1,
      "scheduledAt": "2026-10-01T11:00:00Z",
      "title": "오리엔테이션",
      "presenter1": { "participantId": 78, "name": "건우" },
      "presenter2": null,
      "started": true
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| studyGroup.id | Long | N | 분반 ID. 추가 요청에 그대로 쓴다 | STUDY_GROUP.ID |
| studyGroup.name | String | N | | STUDY_GROUP.NAME |
| studyGroup.timezone | String | N | IANA. 화면 시각 기준. 비어 있으면 `Asia/Seoul` | STUDY_GROUP.TIMEZONE |
| studyGroup.startTime | String | Y | 분반 정규 시작 시각, 분반 시간대의 현지 `HH:mm`. 추가 창 시작 시각 기본값(PRD 7-2). `START_AT` 이 비어 있으면 null | 계산: `STUDY_GROUP.START_AT` 을 분반 시간대로 바꾼 시각 |
| meetings | Array | N | `scheduledAt` 오름차순. 없으면 `[]` | STUDY_MEETING (`STUDY_GROUP_ID` = 분반) |
| studyGroup.navigatorName | String | Y | 시트 머리의 「네비게이터」. 없으면 null | STUDY_PARTICIPANT(LEADER) → ACCOUNT 닉네임 |
| studyGroup.rules | String | Y | 스터디 규칙. 없으면 null | STUDY_GROUP.RULES |
| study.discordChannelUrl | String | Y | 정보 카드 「디스코드」 버튼. 완주한 참여자는 클럽 로비 초대. 없으면 null — 버튼을 두지 않는다 | STUDY.DISCORD_CHANNEL_URL |
| study.driveUrl | String | Y | 정보 카드 「자료실」 버튼. 없으면 null | STUDY.DRIVE_URL |
| me.participantId | Long | Y | 내 명부 행. 명부에 없는 캡틴은 null | STUDY_PARTICIPANT.ID |
| me.canEdit | Boolean | N | true 면 네비게이터·캡틴 — 화면이 표를 고칠 수 있게 연다 | 계산: 위 「권한 판정」 고치기 |
| participants | Array | N | 발표자 드롭다운 후보. 그 분반 활성 참여자, 이름순 | STUDY_PARTICIPANT `STATUS IN (ACTIVE, PAUSED)` |
| meetings[].id | Long | N | | STUDY_MEETING.ID |
| meetings[].type | String | N | `KICKOFF` · `REGULAR` | STUDY_MEETING.MEETING_TYPE |
| meetings[].number | Int | N | 회차 번호. 킥오프는 0 | 계산: 정규 회차를 `SCHEDULED_AT` 오름차순으로 센 순번 (1부터) |
| meetings[].presenter1 · presenter2 | Object | Y | `{ participantId, name }`. 비었으면 null. 킥오프는 늘 null | STUDY_MEETING.PRESENTER1·2_PARTICIPANT_ID → STUDY_PARTICIPANT |
| meetings[].scheduledAt | String | N | UTC ISO 8601 | STUDY_MEETING.SCHEDULED_AT |
| meetings[].title | String | Y | 없으면 null — 화면은 「—」 | STUDY_MEETING.TITLE |
| meetings[].started | Boolean | N | true 면 시작한 회차 — 화면은 흐린 줄, 수정·삭제·발표 신청 불가 | 계산: `now >= SCHEDULED_AT OR START_AT IS NOT NULL` |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 400 | INVALID_INPUT | `studyGroupId` 가 없는데 이 스터디 명부에 내가 없음 (캡틴 등) |
| 400 | INVALID_INPUT | `studyGroupId` 가 이 스터디 소속이 아님 |
| 403 | FORBIDDEN | 그 분반 참여자도 캡틴도 아님 |
| 404 | NOT_FOUND | 없는 `studyId` · 없는 `studyGroupId` |

### 프론트엔드 사용처

- 프로토타입: `frontend/apps/playground/src/app/(proto)/proto/core/[locale]/my/joined/[id]/schedule/page.tsx` (지금은 브라우저 저장)
- core-front 스터디 일정 → 일정 탭 (미구현)

---

## 회차 추가

### 기본 정보

- **Method**: POST
- **Path**: `/api/studies/{studyId}/meetings`
- **인증**: 필요 — 그 분반 네비게이터 · 캡틴
- **설명**: 한 분반에 회차를 하나 또는 여럿 만든다. 반복은 화면이 날짜로 펼쳐 보낸다. 새 회차마다 분반 참여자 출석을 `ABSENT` 로 만든다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Query Parameters

없음

### Request Body

```json
{
  "studyGroupId": 3,
  "scheduledAts": ["2026-10-15T11:00:00Z", "2026-10-22T11:00:00Z", "2026-10-29T11:00:00Z"],
  "title": "논문 읽기"
}
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| studyGroupId | Long | Y | 이 스터디 소속 분반 → 아니면 400 |
| scheduledAts | String[] (UTC ISO 8601) | Y | 1~31개. 모두 `now` 이후 (지난 시각 → 400). 분반 현지 날짜가 서로 겹치면 400. 현지 날짜 `max − min ≤ 30일` (위 「같은 날」 판정) → 넘으면 400. 킥오프 현지 날짜 이하가 섞이면 400 (결정 11). 순서 무관 |
| title | String | N | 입력 그대로 50자 이하 → 넘으면 400 (공백도 센다). 공백뿐이면 null 로 저장. 반복이면 모든 회차에 같은 제목 |

- 반복 중 이미 회차가 있는 날은 **화면이 미리보기에서 빼고 보낸다**(PRD 7-6). 서버로 온 목록에 기존 회차와 같은 날이 있으면 건너뛰지 않고 409 로 거절한다 — 미리보기 뒤 다른 사람이 그 날에 회차를 만든 경우라, 조용히 빼면 화면이 보여 준 개수와 결과가 달라진다.

### 서버 동작

한 트랜잭션:

1. 분반을 잠근다 — 트랜잭션의 첫 조회 (위 「잠금」).
2. 권한 판정 (위 「권한 판정」) → 분반 회차를 읽는다.
3. 위 검증 + 기존 회차와 같은 날 → 409 `MEETING_DATE_CONFLICT`.
4. `STUDY_MEETING` INSERT (`MEETING_TYPE = REGULAR`, `START_AT`·`END_AT` 은 비운다 — 보이스룸·디스코드가 기록). `scheduledAts` 가 2개 이상이면 UUID 하나를 만들어 모든 행의 `SERIES_ID` 에 넣고, 1개면 null (결정 2).
5. 분반 참여자 중 `STATUS IN (ACTIVE, PAUSED)` 인 사람마다 새 회차 × 참여자 `STUDY_ATTENDANCE(STATUS = ABSENT)` INSERT. `STUDY_ID`·`STUDY_GROUP_ID` 는 비정규화 값으로 채운다.
6. `STUDY.STATUS` 는 건드리지 않는다 (결정 5).

> 시작 전 회차의 `ABSENT` 는 결석이 아니다 — 내 스터디는 시작 전 `ABSENT` 를 빈칸으로 보여 주고(`MyStudyQueryService.visibleStatus`), 출석률 분모는 `scheduled_at <= now()` 회차만 센다.
>
> 회차를 만든 **뒤** 합류한 참여자의 출석 행은 이 API 가 만들지 않는다. 명부 GET 은 행이 없으면 `status: null` 로 보여 준다.

### Response — 204 No Content

응답 바디 없음. 회차 번호가 앞뒤로 다시 매겨지므로 화면은 목록을 다시 조회한다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 400 | INVALID_INPUT | `scheduledAts` 가 비었거나 31개 초과 |
| 400 | INVALID_INPUT | 지난 시각이 섞임 |
| 400 | INVALID_INPUT | 요청 안에서 같은 날이 둘 이상 |
| 400 | INVALID_INPUT | 첫 날 ~ 마지막 날이 31일을 넘음 |
| 400 | INVALID_INPUT | `title` 50자 초과 |
| 400 | INVALID_INPUT | `studyGroupId` 가 이 스터디 소속이 아님 |
| 403 | FORBIDDEN | 그 분반 네비게이터도 캡틴도 아님 |
| 404 | NOT_FOUND | 없는 `studyId` · 없는 `studyGroupId` |
| 409 | MEETING_DATE_CONFLICT | 기존 회차와 같은 날 |

### 프론트엔드 사용처

- 프로토타입: 위와 같음 (회차 추가 창)
- core-front 스터디 일정 → 일정 탭 → 회차 추가 (미구현)

---

## 회차 수정

### 기본 정보

- **Method**: PUT
- **Path**: `/api/studies/{studyId}/meetings/{meetingId}`
- **인증**: 필요 — 그 분반 네비게이터 · 캡틴
- **설명**: 시작 전 회차 하나의 시각·제목·발표자를 고친다. 회차 ID 는 그대로라 그 회차의 출석(휴가 포함)이 따라온다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |
| meetingId | Long | 회차 ID |

### Query Parameters

없음

### Request Body

```json
{
  "scheduledAt": "2026-10-16T11:00:00Z",
  "title": null,
  "presenter1ParticipantId": 78,
  "presenter2ParticipantId": null
}
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| scheduledAt | String (UTC ISO 8601) | Y | `now` 이후 → 아니면 400. 이 회차를 뺀 분반 회차와 같은 날 → 409 `MEETING_DATE_CONFLICT`. 정규 회차를 킥오프 현지 날짜 이하로 → 400. 킥오프를 1회차 현지 날짜 이상으로 → 400 |
| title | String | N | 50자 이하 → 넘으면 400. null·공백이면 제목을 지운다 |
| presenter1ParticipantId · presenter2ParticipantId | Long | N | **필드가 없으면 그 칸은 그대로**, `null` 이면 비운다. 그 분반 활성 참여자 → 아니면 400. 결과적으로 둘이 같으면 400. 킥오프에 값이 있으면 400 |

### 서버 동작

1. 분반 잠금 → 권한 판정 → 분반 회차 잠금 순서로 읽는다 (위 「잠금」).
2. 대상 회차가 시작했으면 409.
3. 검증 후 `SCHEDULED_AT`·`TITLE`·`PRESENTER1·2_PARTICIPANT_ID` 갱신. `SERIES_ID`·`MEETING_TYPE` 은 건드리지 않는다 — 시각을 옮겨도 같은 묶음이다.

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 400 | INVALID_INPUT | `scheduledAt` 이 지난 시각 |
| 400 | INVALID_INPUT | `title` 50자 초과 |
| 403 | FORBIDDEN | 그 분반 네비게이터도 캡틴도 아님 |
| 404 | NOT_FOUND | 없는 `studyId` · `meetingId` 가 이 스터디 소속이 아님 |
| 409 | MEETING_ALREADY_STARTED | 이미 시작한 회차 |
| 409 | MEETING_DATE_CONFLICT | 다른 회차와 같은 날 |

### 프론트엔드 사용처

- core-front 스터디 일정 → 일정 탭 → 표의 칸 · 저장 바 (미구현)

---

## 회차 삭제

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/studies/{studyId}/meetings/{meetingId}`
- **인증**: 필요 — 그 분반 네비게이터 · 캡틴
- **설명**: 시작 전 정규 회차 하나를 지운다. 반복으로 만든 회차도 한 회차씩 지운다 — 같은 `SERIES_ID` 의 다른 회차는 그대로 둔다. 지운 회차의 출석·휴가 행도 함께 지운다. 킥오프는 지울 수 없다(409 `KICKOFF_NOT_DELETABLE`).

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |
| meetingId | Long | 회차 ID |

### Query Parameters

없음

### Request Body

없음

### 서버 동작

1. 분반 잠금 → 권한 판정 → 분반 회차 잠금 순서로 읽는다 (위 「잠금」).
2. 대상 회차가 시작했으면 409.
3. 그 회차의 `STUDY_ATTENDANCE` 와 `STUDY_MEETING` 을 지운다. 둘 사이 외래키는 없어 DB 가 지워 주지 않는다 — 출석 행을 빠뜨리면 고아로 남는다.

> **휴가 신청** — 별도 테이블이 없다. 크루가 낸 휴가는 출석 행 `STATUS = EXCUSED` 다(명부 스펙 「EXCUSED 는 POST 로 직접 세팅」, `MyStudyQueryService` 「사전 휴가(EXCUSED)」). 출석 행을 지우면 휴가도 함께 사라진다. 휴가 신청 테이블이 생기면 이 절에 삭제 대상을 더한다.

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | 그 분반 네비게이터도 캡틴도 아님 |
| 404 | NOT_FOUND | 없는 `studyId` · `meetingId` 가 이 스터디 소속이 아님 |
| 409 | MEETING_ALREADY_STARTED | 이미 시작한 회차 |
| 409 | KICKOFF_NOT_DELETABLE | 킥오프 |

### 프론트엔드 사용처

- core-front 스터디 일정 → 일정 탭 → 삭제 확인 (미구현)

---

## 발표 신청 · 취소

### 기본 정보

- **Method**: PUT (신청) · DELETE (취소)
- **Path**: `/api/studies/{studyId}/meetings/{meetingId}/presenters/{slot}/me`
- **인증**: 필요 — 그 분반 참여자 (위 「권한 판정」 보기)
- **설명**: 크루가 빈 발표자 칸에 자기를 넣거나, 자기가 들어간 칸에서 빠진다. 선착순이다. 네비게이터·캡틴의 지정은 회차 수정(PUT)으로 한다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |
| meetingId | Long | 회차 ID |
| slot | Int | `1` 또는 `2` — 발표자1 · 발표자2 |

### Request Body

없음

### 서버 동작

1. 분반 잠금 → 권한 판정 → 대상 회차 잠금. 같은 칸에 동시에 신청하면 먼저 잠근 쪽이 이긴다.
2. 시작한 회차 → 409 `MEETING_ALREADY_STARTED`. 킥오프 → 400.
3. PUT: 그 칸이 비어 있지 않으면 409 `PRESENTER_SLOT_TAKEN`. 같은 회차의 다른 칸에 내가 있으면 409 `PRESENTER_ALREADY_ASSIGNED`. 통과하면 그 칸에 내 명부 행 ID 를 넣는다.
4. DELETE: 그 칸이 내가 아니면 409 `PRESENTER_NOT_ME`. 통과하면 비운다.

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 400 | INVALID_INPUT | `slot` 이 1·2 가 아님 · 킥오프 |
| 403 | FORBIDDEN | 그 분반 참여자가 아님 (명부에 없는 캡틴 포함) |
| 404 | NOT_FOUND | 없는 `studyId` · `meetingId` 가 이 스터디 소속이 아님 |
| 409 | MEETING_ALREADY_STARTED | 이미 시작한 회차 |
| 409 | PRESENTER_SLOT_TAKEN | 신청한 칸이 이미 찼다 — 화면은 목록을 다시 불러 「방금 다른 사람이 신청했습니다」 |
| 409 | PRESENTER_ALREADY_ASSIGNED | 같은 회차 다른 칸에 이미 내가 있다 |
| 409 | PRESENTER_NOT_ME | 취소하려는 칸이 내가 아니다 |

### 프론트엔드 사용처

- core-front 스터디 일정 → 일정 탭 → 발표자 칸 「신청」·「취소」 (미구현)

---

## 스터디 규칙 저장

### 기본 정보

- **Method**: PUT
- **Path**: `/api/studies/{studyId}/groups/{groupId}/rules`
- **인증**: 필요 — 그 분반 네비게이터 · 캡틴

### Request Body

```json
{ "rules": "1. 각 주차에 최대 2명이 발표합니다.\n..." }
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| rules | String | N | 500자(코드포인트) 이하 → 넘으면 400. 줄바꿈은 `\n` 으로 맞춰 저장하고, 탭·줄바꿈 밖의 제어문자는 400. null·공백이면 지운다 |

> 규칙·제목은 원문 그대로 저장하고, 화면은 **글자로만** 그린다(HTML·마크다운 해석 금지). 제목은 줄바꿈을 받지 않는다(400).

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 400 | INVALID_INPUT | 500자 초과 · `groupId` 가 이 스터디 소속이 아님 |
| 403 | FORBIDDEN | 그 분반 네비게이터도 캡틴도 아님 |
| 404 | NOT_FOUND | 없는 `studyId` · `groupId` |

### 프론트엔드 사용처

- core-front 스터디 일정 → 일정 탭 → 스터디 규칙 카드 (미구현)

---

## 구현 메모

- 마이그레이션은 `V23__add_study_meeting_title.sql` — beta(V22) 다음 번호로 먼저 머지한다 (2026-10-02). #174 처럼 V23 이후를 쓰던 열린 PR 은 번호를 하나씩 민다.
- `ErrorCode` 에 `MEETING_ALREADY_STARTED(409)` · `MEETING_DATE_CONFLICT(409)` 를 더한다. 화면은 이 코드로 어느 칸 아래 이유를 적을지 가른다 — 디스코드 조기 시작이나 다른 사람의 추가는 화면 사전 검증으로 알 수 없다.
- 결정 9~12 의 컬럼(`STUDY_MEETING.MEETING_TYPE` · `PRESENTER1_PARTICIPANT_ID` · `PRESENTER2_PARTICIPANT_ID`, `STUDY_GROUP.RULES`)은 한 마이그레이션 `V{n}__study_schedule_board.sql` 로 더한다. 기존 회차는 `MEETING_TYPE = REGULAR` 로 채운다.
- 분반을 만드는 곳(캡틴의 반 만들기)에서 킥오프 회차를 함께 INSERT 한다. 일자는 분반 첫 회차 한 주 전, 정해지지 않았으면 스터디 시작일 — 네비게이터가 나중에 고친다.
- 참여자가 분반을 떠나면(하차·탈퇴) 그가 맡은 **예정** 회차의 발표자 칸을 비운다. 지난 회차는 기록이라 둔다.
- 캡틴 판정을 `SYSTEM_ROLE = ADMIN` 에서 「그 스터디를 만든 캡틴(`STUDY.CREATED_BY`, V29)」으로 좁힌다 — 회차 API 와 출석 API(GET·POST) 모두. 다른 ADMIN 의 운영은 백오피스 API 로.
- 출석부 GET(`/api/studies/{studyId}/attendances`)도 위 「권한 판정」 보기를 따른다 — 크루는 내 분반 전원의 출석(휴가 표시 포함)을 본다. 다른 분반은 403.
- 출석률 계산에서 킥오프를 뺀다 — [명부·출석 스펙](../attendance/spec.md) 「출석률 산식」 의 `countable_meetings` 에 `MEETING_TYPE = REGULAR` 조건을 더한다.
- `ErrorCode` 에 `KICKOFF_NOT_DELETABLE(409)` · `PRESENTER_SLOT_TAKEN(409)` · `PRESENTER_ALREADY_ASSIGNED(409)` · `PRESENTER_NOT_ME(409)` 를 더한다.
- `SERIES_ID` 컬럼은 새 마이그레이션 `V{n}__add_study_meeting_series_id.sql` 로 더한다. `n` 은 머지 시점 beta 최신 번호의 다음이다 — 열린 PR 여럿이 V26 을 쓰고 있어 번호를 미리 박지 않는다. 기존 행은 null 로 둔다 — 이미 만든 반복 회차는 묶을 근거가 없다. 응답에는 아직 내보내지 않는다(쓰는 화면이 없다).
- #174 가 `Study` 에서 `slug`·`capacity`·`isHidden`·`studyDeliveryFormat` 을 지우고 `phase()`·`recruitStatus()` 에 `recruitmentCapacity` 인자를 더한다. 구현 전에 머지 여부를 확인하고 rebase 한 뒤 테스트 픽스처를 맞춘다.

## 범위 밖

- 회차 변경 알림 (결정 4)
- 클럽(비모임형 출석) 회차 (결정 6)
- 묶음 단위 삭제·수정 · 목록의 반복 표시 (결정 2 — 묶음 ID 는 저장해 둔다)
- 출석부 편집 — [명부·출석](../attendance/spec.md)
- 회차 취소 표현(`CANCELED_AT`) — 지금은 삭제만 있다
- 백오피스 회차 관리 (`/api/admin/...`)

## 미확정

- [NEEDS CLARIFICATION] 이미 운영 중인 분반에 킥오프 회차를 소급해 만들지 — 시트에는 0회차가 있지만 DB 에는 없다. 지금은 새로 만드는 분반에만 만든다.
- [NEEDS CLARIFICATION] 한 사람이 맡을 수 있는 발표 수에 상한을 둘지 — 지금은 두지 않는다.
- [NEEDS CLARIFICATION] 발표자1이 빠진 날 발표자2가 대신한 것을 따로 기록할지 — 지금은 일정의 발표자를 고쳐서 남긴다.


