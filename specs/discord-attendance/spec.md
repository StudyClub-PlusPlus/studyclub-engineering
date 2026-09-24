# 디스코드 일괄 출석 체크 Spec

> ERD: [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md) · [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) · [ACCOUNT](../../docs/erd/ACCOUNT.md)
> 관련 스펙: [attendance/spec.md](../attendance/spec.md) — 화면에서 찍는 출석 (같은 테이블, 다른 진입점)
> 봇 계약: [discord-development-guide/api/summary.md](../../docs/discord-development-guide/api/summary.md)
> 생성일: 2026-09-21
> 상태: 구현완료 (봇 쪽 커맨드 Notion 136 은 범위 밖)
> 이슈: Notion 113 「[기능] Discord 일괄 출석 체크」 · Notion 134 「[기능] Discord DB Table in BE」

## WHAT

반장이 보이스 채널에서 `!출석체크` 를 치면, 봇이 **그 시점 보이스 채널 참가자 스냅샷**을
백엔드로 보내고 백엔드가 출석을 찍는다. 반장이 이름을 하나씩 부르지 않는 게 목적이다.

이미 있는 걸 두 개 쓴다. 출석 저장은 [attendance/spec.md](../attendance/spec.md) 가 만든
`STUDY_ATTENDANCE` 애그리거트 그대로고, 디스코드 유저 → 회원 변환은 `ACCOUNT.DISCORD_ID`
(V3 부터 있는 `VARCHAR(64) UNIQUE NULL`) 그대로다. 새로 만드는 건 **디스코드 진입점 하나**와
**스터디 ↔ 디스코드 식별자 매핑 테이블 하나**뿐이다.

## 봇은 회차를 모른다 — 백엔드가 정한다

봇이 보내는 건 커맨드를 친 사람과 보이스 채널 참가자 목록뿐이다. `studyMeetingId` 는 **받지 않는다.**

봇에 회차를 들려주려면 봇이 회차 목록을 먼저 조회해야 하고(왕복 2회), 어느 회차가 "지금"인지
판단하는 로직이 봇과 백엔드 양쪽에 생긴다. 그 판단의 근거인 `START_AT`/`END_AT` 은 전부
백엔드에 있으므로 백엔드가 정하는 게 맞다.

[STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) 이 이미 상태를 저장하지 않고 시각으로
계산하기 때문에 **"진행 중인 회차"는 이미 유일하게 정의돼 있다.** 그걸 그대로 쓴다.

### 회차 판정 규칙

**반마다** 따로 고른다. 그 반의 회차 중에서 아래 순서다.

```
1) 진행 중인 회차  (START_AT IS NOT NULL AND END_AT IS NULL)
2) 없으면, SCHEDULED_AT 이 now ± 2h 이내이고 아직 시작 안 한 회차 → START_AT 을 now 로 찍고 사용
3) 1·2 모두 0건  → 그 반은 건너뛴다. 사람들은 응답의 noMeeting[] 으로
4) 1 또는 2 가 2건 이상 → 409 CONFLICT
```

2번이 반장의 `!시작` 커맨드를 대신한다. 커맨드를 두 개로 나누면 반장이 `!시작` 을 빼먹었을 때
출석이 통째로 날아가는데, 실제 운영에서 그 실수가 더 흔하다.

3번을 에러로 만들지 않는 이유는 아래 "반은 요청이 정하지 않는다" 에 있다. 공부방을 여러 반이
같이 쓰므로, 지금 모이는 중이 아닌 반 사람이 방에 앉아 있는 건 흔한 일이다. 그것 때문에 요청
전체를 실패시키면 정작 모여 있는 반이 출석을 못 찍는다.

| 경계 | 결과 | 근거 |
|---|---|---|
| 예정 시각 1시간 전에 모여서 체크 | 2번으로 시작 | ±2h 안 |
| 예정 시각 3시간 뒤에 체크 | `noMeeting[]` | 여유를 넘겼다. 화면에서 회차를 만들고 다시 |
| 이미 `END_AT` 이 찍힌 회차뿐 | `noMeeting[]` | 끝난 회차에 소급 입력하지 않는다. 화면(`attendance/spec.md`)에서 수정 |
| 옆 반 사람이 공부방에 앉아 있음 | `noMeeting[]` | 그 반은 지금 모이는 중이 아니다 |
| 같은 반에 진행 중 회차가 2개 | 409 | 데이터가 깨진 상태다. 조용히 아무거나 고르지 않는다 |

## 반은 요청이 정하지 않는다 — 참가자 명부가 정한다

출석은 `STUDY_MEETING` → `STUDY_GROUP`(반) 단위인데, 봇은 카테고리 ID 하나만 보낸다.
그리고 **반이 여러 개여도 공부방(보이스 채널)은 보통 하나다.** 보이스가 여러 개로 나뉘어도
어느 채널에서 치든 같은 카테고리 ID 가 올라오므로, 보이스 채널 ↔ 반 매핑으로는 반을 가를 수 없다.
(2026-09-21 #111 리뷰, 황준희)

그래서 반은 스냅샷에 찍힌 **사람 각자의 명부 소속**(`STUDY_PARTICIPANT.STUDY_GROUP_ID`)으로
가른다. 한 사람은 기수 안에서 반 하나에만 속한다 — DB 제약은 아니고 앱 레벨 규칙이다
([STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) § 제약).

반이 여러 개인 건 정상이므로 **409 로 거절하지 않는다.** `STUDY_DISCORD_LINK` 에 보이스 채널
매핑 컬럼도 두지 않는다 — 애초에 성립하지 않는 설계다.

**home group 에만 찍는다.** [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md) 는
`STUDY_GROUP_ID` 를 "실제 참석한 반(cross-group 출석 시 home group 이 아닐 수 있음)" 이라고
적어 두었지만, 출석률을 계산하는 `AttendanceRateCalculator` 는 참가자의 home group 회차만 본다
([attendance/spec.md](../attendance/spec.md) § 조회 로직 — "항상 그룹 전체 기준").
옆 반 회차에 찍으면 그 행이 출석률 조회에 안 잡혀 **오히려 결석으로 계산된다.** 그래서 여기서는
cross-group 출석을 만들지 않고, 자기 반이 모이는 중이 아니면 `noMeeting[]` 으로 돌려준다.

## 유저 매핑 — 새 테이블 없음

`discordUserId` → `ACCOUNT.DISCORD_ID` → `ACCOUNT.ID` → 그 반의 `STUDY_PARTICIPANT`.

`ACCOUNT.DISCORD_ID` 는 `UNIQUE` 라 조회가 한 번이다. 별도 매핑 테이블도, `ACCOUNT_IDENTITY`
행도 만들지 않는다.

이 컬럼을 **채우는 쪽은 Notion 44 「[기능] Discord 계정 연결」** 이고 아직 시작 전이다.
그래서 이 스펙은 44 를 기다리지 않는다 — 매칭 안 된 유저를 에러로 만들지 않고 응답에 담아
돌려준다. 44 가 붙기 전에는 전원이 `unmatched` 로 나올 뿐, 엔드포인트는 그대로 동작한다.

| 상황 | 처리 | 응답 |
|---|---|---|
| `DISCORD_ID` 매칭 없음 | 건너뛴다 | `unmatched[]` |
| 매칭됐지만 그 반 참가자가 아님 | 건너뛴다 | `notParticipant[]` |
| 참가자지만 `STATUS` 가 `WITHDRAWN` | 건너뛴다 | `notParticipant[]` |
| 참가자지만 그 반이 지금 모이는 중이 아님 | 건너뛴다 | `noMeeting[]` |
| 참가자 (`ACTIVE` · `PAUSED`) | 그 사람의 반 회차에 출석 | `groups[].marked[]` |

구경 온 운영진이 보이스에 있어도 출석이 생기지 않는다. 봇은 응답을 받아 채널에
"N명 체크, M명 미연동" 을 찍으면 된다.

## 출석 기록

대상 회차 × 계정으로 `PRESENT` 를 **upsert** 한다.

- `UNIQUE(STUDY_MEETING_ID, ACCOUNT_ID)` 가 이미 있어 같은 스냅샷이 여러 번 와도 결과가 같다.
  봇이 재시도해도 안전하고, 그래서 `Idempotency-Key` 를 저장하지 않는다.
- **겹쳐 들어오는 요청도 안전하다.** 회차를 고르는 조회가 `SELECT ... FOR UPDATE` 라 "회차 선택 →
  필요하면 시작 → 출석 쓰기" 가 반 단위로 직렬화된다. 이게 없으면 두 요청이 같은 예정 회차를 동시에
  시작시키거나 같은 (회차, 계정) 행을 동시에 INSERT 해서 한쪽이 500 이 된다.
- 이미 `LATE` · `EXCUSED` 인 사람은 **덮어쓰지 않는다.** 반장이 화면에서 손으로 고쳐 둔 값이
  스냅샷 한 번에 날아가면 안 된다. `ABSENT` 와 없는 행만 `PRESENT` 로 간다.
- 보이스에 없는 나머지 참가자는 건드리지 않는다. 회차 종료 시 미체크 인원을 `ABSENT` 로
  만드는 건 [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md) 의 별도 항목이다.

`STUDY_ID` · `STUDY_GROUP_ID` 는 비정규화 컬럼이므로 회차에서 끌어와 같이 채운다.

## 새 테이블 — STUDY_DISCORD_LINK (이슈 134)

봇이 아는 식별자는 `discordStudyId`(카테고리) 뿐이다. 그걸 `STUDY.ID` 로 바꿀 자리가 필요하다.

```sql
CREATE TABLE STUDY_DISCORD_LINK (
    ID               BIGINT       NOT NULL AUTO_INCREMENT,
    STUDY_ID         BIGINT       NOT NULL,
    DISCORD_STUDY_ID VARCHAR(20)  NOT NULL,
    DISCORD_ROLE_ID  VARCHAR(20)  NOT NULL,
    CREATED_AT       DATETIME     NOT NULL,
    UPDATED_AT       DATETIME     NOT NULL,
    PRIMARY KEY (ID),
    CONSTRAINT uk_study_discord_link_study   UNIQUE (STUDY_ID),
    CONSTRAINT uk_study_discord_link_discord UNIQUE (DISCORD_STUDY_ID)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
```

- snowflake 는 봇 계약대로 **문자열**이다 (`^[0-9]{17,20}$`). `BIGINT` 로 받으면 JS 정밀도에서
  깨진다.
- 스터디 하나에 디스코드 카테고리 하나. 양쪽 다 `UNIQUE` 다.
- `create-study` 응답의 `discordStudyId` · `discordRoleId` 쌍을 그대로 저장한다.
- **채널 목록(`discordChannelId`/`Name`/`Type`)은 저장하지 않는다.**
  [get-study-channels](../../docs/discord-development-guide/api/get-study-channels.md) 로
  언제든 조회되고, 저장하면 디스코드에서 채널을 지웠을 때 백엔드만 옛 값을 들고 있게 된다.
- `STUDY.DISCORD_CHANNEL_URL`(V2 부터 있음)과 역할이 겹친다. 그건 사람이 누르는 링크 한 개고
  이 테이블은 API 호출용 식별자다. **이 스펙에서 `DISCORD_CHANNEL_URL` 은 건드리지 않는다.**

## API — 출석 일괄 등록

### 기본 정보

- **Method**: POST
- **Path**: `/api/discord/studies/{discordStudyId}/attendances`
- **인증**: `X-API-Key` (서비스 간). 사용자 JWT 아님
- **호출자**: 디스코드 봇

경로는 `/api/...` 다. 봇 문서의 `/api/v1/...` 은 봇(FastAPI) 쪽 경로고, 이 레포 백엔드는
버전 세그먼트를 쓰지 않는다 (`/api/studies/{studyId}/attendances` 등).
`discord` 접두사를 두는 이유는 인증 필터를 경로로 가를 수 있어서다.

### 요청

```json
{
  "callerDiscordUserId": "1327394882193880001",
  "discordUserIds": ["1327394882193883136", "1327394882193883999"]
}
```

| 필드 | 타입 | 필수 | 검증 |
|---|---|---|---|
| `callerDiscordUserId` | `string` | Y | `^[0-9]{17,20}$`. 커맨드를 친 사람 |
| `discordUserIds` | `string[]` | Y | 1개 이상 100개 이하, 각 항목 `^[0-9]{17,20}$` |

**호출자는 그 스터디의 `LEADER` · `CO_LEADER` 이면서 명부에 살아 있어야(`ACTIVE`·`PAUSED`) 한다.**
아니면 403. 반 단위가 아니라 스터디 단위인 건 공부방을 같이 쓰기 때문이고, 화면 경로
(`AttendanceUpsertService.validateCallerIsCaptain`)가 이미 스터디 단위로 보고 있어 기준이 같다.

하차·완주는 행을 지우지 않고 `STATUS` 만 바꿔서 `PARTICIPANT_ROLE` 이 `LEADER` 로 남기 때문에,
역할만 보면 지난 기수 반장이 계속 출석을 찍을 수 있다. 그래서 상태를 같이 본다. 봇의 captain · navigator 역할은
길드 전체에 하나뿐이라 "그 스터디의 반장인지" 를 구분하지 못한다 — 봇 계약 § 역할이 스터디 단위 권한은
백엔드가 확인한다고 못 박은 그대로다.

경로의 `discordStudyId` 는 따로 형식 검증을 하지 않는다. 형식이 틀리면 매핑 조회가 비어 404 가 되고,
그게 맞는 답이다.

### 응답 — 200

```json
{
  "groups": [
    {
      "studyGroupId": 70,
      "studyMeetingId": 41,
      "meetingStarted": true,
      "marked": ["1327394882193883136"]
    }
  ],
  "unmatched": ["1327394882193883999"],
  "notParticipant": [],
  "noMeeting": ["1327394882193884000"]
}
```

| 필드 | 뜻 |
|---|---|
| `groups[].studyGroupId` | 출석이 찍힌 반 |
| `groups[].studyMeetingId` | 그 반에서 실제로 찍힌 회차 |
| `groups[].meetingStarted` | 이 호출이 그 회차를 시작시켰으면 `true` (판정 2번) |
| `groups[].marked` | 그 반에서 출석 처리된 디스코드 유저 |
| `unmatched` | 계정 연동이 안 된 유저 |
| `notParticipant` | 연동은 됐지만 이 스터디 명부에 없는 유저 |
| `noMeeting` | 명부에는 있지만 그 반이 지금 모이는 중이 아닌 유저 |

전원이 `unmatched` 여도, `groups` 가 비어도 **200** 이다. 호출은 정상이고 찍을 대상이 없을 뿐이다.
봇은 `groups[].marked` 를 합쳐 "N명 체크" 를 찍고, 나머지 세 목록은 이유별로 안내하면 된다.

### 에러

| 상태 | ErrorCode | 언제 |
|---|---|---|
| 400 | `INVALID_INPUT` | 배열이 비었거나 snowflake 형식 위반 |
| 401 | `UNAUTHORIZED` | `X-API-Key` 없음·불일치 |
| 403 | `FORBIDDEN` | 호출자가 그 반의 반장이 아님 |
| 404 | `NOT_FOUND` | `discordStudyId` 에 연결된 스터디 없음 |
| 409 | `CONFLICT` | 한 반의 후보 회차가 2개 이상 (데이터가 깨진 상태) |

## 테스트

- 통합(`DiscordAttendanceIntegrationTest`, TestRestTemplate): 성공 1건 · 같은 스냅샷 2회 멱등 ·
  401(키 없음/틀림) · 400(빈 배열·형식 위반) · 403(반장 아님) · 404(매핑 없음)
- 통합(`DiscordApiKeyMissingTest`): 키를 설정하지 않은 배포에서는 헤더가 있든 없든 401
- 단위(`DiscordAttendanceServiceTest`): 회차 선택 경계 — 진행 중 우선, ±2h 안/밖, 종료된 회차만,
  후보 2건, 분반 2개, 403 일 때 회차를 시작시키지 않는지, 하차한 전 반장 403
- 단위: `LATE`·`EXCUSED` 를 덮어쓰지 않고 `ABSENT` 만 올리는지, 미연동 유저가 `unmatched` 인지
- **봇 없이 전부 돌아간다.** 마이그레이션은 빈 MySQL 8 + `ddl-auto=validate` 부팅으로 따로 확인했다
  (`backend-migration-check` 와 같은 절차)

## 미확정

- **`STUDY_DISCORD_LINK` 행을 누가 만드는가.** 스터디 등록 시 백엔드가 봇의 `create-study` 를
  호출하고 응답을 저장하는 흐름인데, 그 등록 API(Notion 110) 는 아직 없다. 이 스펙 범위는
  테이블과 조회까지고, 쓰기는 110 과 같이 붙인다.
- **회차의 주기 경계** (토 시작이면 토→금이 한 회차인지 등, #111 리뷰 Q3). 이 스펙은 회차를 주 단위로
  계산하지 않고 `STUDY_MEETING` 행의 `SCHEDULED_AT` 만 본다. 그 행을 어떤 주기로 만들지는
  [STUDY_GROUP](../../docs/erd/STUDY_GROUP.md) § 미확정 의 `WEEKDAY` 컬럼과 Notion 52
  「스터디 미팅(회차) 등록」 소관이다.
- **봇 쪽 `!출석체크` 커맨드(Notion 136)** 는 담당자가 비어 있다. 이 엔드포인트는 봇 없이도
  완성·검증되지만, 실제로 쓰이려면 136 이 붙어야 한다.

## 백엔드가 정하고 알리는 것

봇 구현 전에 합의가 필요한 건 아래 세 개고, 근거가 전부 백엔드 쪽에 있어 여기서 정했다.
바꿔야 할 이유가 있으면 알려주시면 된다.

| 정한 것 | 값 | 왜 백엔드가 정하나 |
|---|---|---|
| 회차 선택 | 진행 중 > `now ±2h` 예정 회차 자동 시작 | 근거인 `START_AT`/`END_AT` 이 백엔드에만 있다 |
| 호출자 검증 | 요청에 `callerDiscordUserId` 포함, 백엔드가 반장 여부 확인 | 봇 역할은 길드 전체 하나라 스터디를 구분 못 한다 |
| 서비스 인증 | `X-API-Key` 단일 키, `discord.api-key` 프로퍼티로 주입 | 키가 비면 **아무도 통과시키지 않는다** — 설정 누락이 공개 엔드포인트가 되지 않게 |

`±2h` 는 운영 정책이라 상수 하나(`DiscordAttendanceService.MEETING_PICK_WINDOW`)로 뒀다.
스키마와 무관하니 쓰다가 좁히거나 넓히면 된다.
