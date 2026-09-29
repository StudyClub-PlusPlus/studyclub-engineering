# 스터디 ↔ 디스코드 연결 Spec

> ERD: [STUDY_DISCORD_LINK](../../docs/erd/STUDY_DISCORD_LINK.md) · [STUDY](../../docs/erd/STUDY.md) · [ACCOUNT](../../docs/erd/ACCOUNT.md)
> 봇 계약: [create-study](../../docs/discord-development-guide/api/create-study.md) · [summary](../../docs/discord-development-guide/api/summary.md) · [common-header](../../docs/discord-development-guide/api/common-header.md)
> 관련 스펙: [discord-attendance/spec.md](../discord-attendance/spec.md) — 이 테이블을 읽는 쪽
> 생성일: 2026-09-29
> 상태: 구현완료
> 이슈: Notion 134 「[기능] Discord DB Table in BE」 남은 절반 (테이블은 #143 에서 생겼다)

## WHAT

스터디를 등록하면 백엔드가 봇의 `POST /api/v1/studies`(create-study)를 불러 디스코드에 카테고리·채널·역할을
만들고, 돌아온 `discordStudyId` · `discordRoleId` 를 `STUDY_DISCORD_LINK` 에 저장한다.
지금은 이 흐름이 없어서 테이블이 늘 비어 있고, 테이블을 읽는 디스코드 출석(`!출석체크`)이 전부 404 다.

새로 만드는 건 **봇 클라이언트 하나**, **스터디 등록 뒤에 붙는 호출 한 줄**, **실패했을 때 다시 붙이는 엔드포인트 하나**다.
스키마는 바꾸지 않는다 (V21 그대로).

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| POST | /api/studies | 스터디 등록 — **바뀐 점: 커밋 뒤 봇 호출** | ADMIN | 구현완료 |
| POST | /api/admin/studies/{studyId}/discord-link | 디스코드 연결 (재시도) | ADMIN | 구현완료 |

## 결정

정답이 하나가 아닌 것들이다. 전부 **가장 단순하고 되돌릴 수 있는 쪽**을 골랐다.

### 1. 호출 시점 — 스터디 등록 트랜잭션이 커밋된 **뒤에**, 같은 요청 안에서

`StudyController.create` 가 `studyService.create`(트랜잭션)를 끝낸 다음 봇을 부른다.

- **트랜잭션 안에 넣지 않는다.** 봇은 Discord 를 여섯 번 부르고 레이트 리밋에 걸리면 응답이 느려진다
  (429 가 밖으로 안 나온다 — create-study.md). 그동안 DB 커넥션을 잡고 있게 된다.
  더 나쁜 건 순서다: 봇이 성공했는데 우리 쪽이 롤백되면 디스코드에 고아 카테고리가 남고, 봇이 이름을
  `COMPLETED` 로 잡고 있어서 같은 이름으로 다시 만들 수도 없다.
- **커밋 뒤에 부르면** 반대 방향의 실패만 남는다: 스터디는 있는데 연결이 없다. 이건 정상 상태다 —
  ERD 가 이미 `1 : 0..1`(연결 없는 스터디가 정상)로 정해 두었다. 그리고 아래 재시도 엔드포인트로 복구된다.
- **비동기로 빼지 않는다.** 이벤트·큐가 이 프로젝트에 아직 없고, 봇 호출은 평소 수 초다. 등록 응답이
  그만큼 늦어지는 걸 받아들인다. 읽기 타임아웃 30초가 상한이다.
- 저장은 봇 응답을 받은 뒤의 짧은 트랜잭션 하나다. 그 안에서 `STUDY` 행을 잠그고(`SELECT … FOR UPDATE`)
  스터디가 아직 있는지, 다른 요청이 먼저 연결하지 않았는지 다시 본 뒤 저장한다. 스터디 삭제도 같은 행을 먼저 잠그므로,
  봇을 기다리는 사이 스터디가 지워져도 지운 스터디에 연결이 생기지 않는다 (그 경우 `404`, 디스코드 쪽은 ERROR 로그).

### 2. 실패 처리 — 스터디는 만들고, 연결만 비워 둔다

등록 경로에서는 봇 호출이 **어떻게 실패해도 201 은 그대로** 나간다. 실패는 WARN 로그로 남긴다.

- 디스코드는 스터디 운영 도구지 스터디의 존재 조건이 아니다. 봇이 죽었다고 스터디 등록이 막히면
  디스코드와 무관한 운영까지 멈춘다.
- **다시 붙이는 수단**은 `POST /api/admin/studies/{studyId}/discord-link` 다. 등록 경로와 같은 호출을 하되
  실패를 삼키지 않고 에러로 돌려준다. 이름을 바꿔 보낼 수 있다 (아래 3).

### 3. studyName — `STUDY.TITLE` 을 보낸다. 409 는 이름을 바꿔 재시도한다

- 봇은 이 이름을 카테고리·역할 이름으로 **그대로 사람에게 보여 준다.** 그러니 사람이 붙인 제목이 맞다.
  `STUDY.TITLE` 은 최대 60자라 봇 한도(96자)를 넘지 않는다.
- 같은 프로그램의 다음 기수가 같은 제목이면 봇이 **409** 를 준다. 이름에 ID·기수 번호를 자동으로 붙이는
  규칙은 만들지 않는다 — 디스코드에 보이는 이름 규칙은 운영이 정할 일이고, 한번 정하면 되돌리기 어렵다.
  대신 등록 경로에서는 연결을 비워 두고, 재시도 엔드포인트의 `studyName` 으로 다른 이름(예: `알고리즘 스터디 2기`)을
  보내게 한다.
- 봇의 409 가 전부 이름 중복은 아니다. `DISCORD_GUILD_ID`·`DISCORD_CAPTAIN_ROLE_ID` 설정이 없어도 409 이고
  `detail` 로만 구분된다. `detail` 에 `with this name` 이 있을 때만 이름 중복(`409 CONFLICT`, 이름을 바꾸라는 안내)으로 보고,
  나머지 409 는 봇 설정 문제(`503`)로 본다. 설정 문제에 이름을 바꾸라고 하면 고칠 수 없는 걸 고치라는 말이 된다.
- ⚠️ 이름 중복 409 는 다시 두 경우가 섞여 있다: (a) 진짜 다른 스터디가 그 이름을 쓰고 있음, (b) 우리 요청이 봇에서 성공했는데
  응답을 못 받음(타임아웃). (b) 에서 새 이름으로 재시도하면 디스코드에 한 벌이 더 생긴다. 봇 409 바디에 기존 ID 가
  없어서 백엔드는 둘을 구분할 수 없다 — 봇 계약의 미정 사항 그대로다 (create-study.md §미정 사항).

### 4. 이미 연결된 스터디를 다시 호출하면 — 봇을 부르지 않고 409

`STUDY_ID` 가 UNIQUE 라 두 번째 행은 어차피 못 들어간다. 봇을 먼저 부르고 저장에서 실패하면 디스코드에
고아 카테고리만 생긴다. 그래서 **봇 호출 전에** 연결이 있는지 보고 있으면 `409 CONFLICT` 로 끝낸다.
연결을 바꾸는(끊고 다시 붙이는) 기능은 만들지 않는다 — 봇에 스터디 삭제 API 가 없어서 끊어도 디스코드 쪽은 남는다.

### 5. 봇이 없는 환경 — 설정이 비어 있으면 부르지 않는다

`discord.bot-url`(env `DISCORD_BOT_URL`) 이나 `discord.api-key`(env `DISCORD_API_KEY`) 가 비어 있으면
등록 경로는 봇을 **부르지 않고** INFO 로그만 남긴다. 로컬·테스트·봇이 아직 없는 stage 에서 등록이 그대로 된다.
재시도 엔드포인트는 같은 상황에서 `503 EXTERNAL_SERVICE_ERROR` 를 준다 (`GoogleOAuthClient` 와 같은 결).

- API 키는 봇 → 백엔드 방향(`/api/discord/**`)에서 이미 쓰는 `discord.api-key` 를 그대로 쓴다.
  봇 계약이 "백엔드도 같은 값을 읽어 헤더에 싣는다" 고 정해 두었다 (common-header.md §X-API-Key).
- 둘 다 `application.yml` 에 넣지 않는다. `@Value` 기본값이 빈 문자열이고, 값은 배포 시 env 로 주입한다.

### 6. `X-Discord-User-ID` — 요청한 ADMIN 의 `ACCOUNT.DISCORD_ID`

봇은 create-study 에 captain 역할을 가진 길드 멤버를 요구한다. 시스템 계정 ID 를 설정값으로 따로 두지 않고,
스터디를 등록한 사람의 디스코드 ID 를 보낸다 — 누가 만들었는지가 봇 로그에 남는다.
그 계정에 `DISCORD_ID` 가 없으면 봇을 부르지 않는다 (등록 경로: WARN 로그 / 재시도: `409`).

## 스터디 등록 — `POST /api/studies` 의 바뀐 점

요청·응답·에러는 [study/spec.md](../study/spec.md) 그대로다. 201 을 돌려주기 직전에 봇을 한 번 부른다.

| 상황 | 스터디 | 연결 | 응답 | 로그 |
|------|--------|------|------|------|
| 봇 설정 없음 | 생성 | 없음 | 201 | INFO |
| 요청자 `DISCORD_ID` 없음 | 생성 | 없음 | 201 | WARN |
| 봇 201 | 생성 | **생성** | 201 | INFO |
| 봇 409 · 4xx · 5xx · 타임아웃 · 연결 거부 | 생성 | 없음 | 201 | WARN (재시도 경로 안내) |

## 디스코드 연결 (재시도)

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/studies/{studyId}/discord-link`
- **인증**: 필요 — ADMIN (`StudyCaptainGuard.assertCaptain`, 스터디 등록과 같은 게이트)
- **설명**: 연결이 없는 스터디에 봇 create-study 를 불러 연결을 만든다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Request Body (선택)

```json
{ "studyName": "알고리즘 스터디 2기" }
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| studyName | String | N | 공백 아님, 96자 이하 | 디스코드에 만들 이름. 없으면 `STUDY.TITLE`. 앞뒤 공백은 자른다 |

바디 자체를 생략해도 된다.

### Response — 201

```json
{ "discordStudyId": "1327394882193883136", "discordRoleId": "1327394882193883140" }
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| discordStudyId | String | N | 디스코드 카테고리 ID (snowflake) | STUDY_DISCORD_LINK.DISCORD_STUDY_ID |
| discordRoleId | String | N | 스터디 전용 역할 ID (snowflake) | STUDY_DISCORD_LINK.DISCORD_ROLE_ID |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `studyName` 이 공백이거나 96자 초과 |
| 401 | UNAUTHORIZED | 토큰 없음·무효 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 스터디 없음 |
| 409 | CONFLICT | 이미 연결됨 (봇을 부르지 않는다) |
| 409 | CONFLICT | 요청자 계정에 `DISCORD_ID` 없음 (봇을 부르지 않는다) |
| 404 | NOT_FOUND | 봇을 기다리는 사이 스터디가 삭제됨 (디스코드 쪽은 만들어졌고 ERROR 로그에 ID) |
| 409 | CONFLICT | 봇 409 이름 중복 — 디스코드에 같은 이름이 있거나 만드는 중. `studyName` 을 바꿔 재시도 |
| 409 | CONFLICT | 봇을 기다리는 사이 다른 요청이 먼저 연결함 (디스코드 쪽은 ERROR 로그에 ID) |
| 503 | EXTERNAL_SERVICE_ERROR | 백엔드 봇 설정 없음·API 키 형식 오류, 봇 설정 409, 그 밖의 봇 에러(400·401·403·404·502·503), 타임아웃, 응답 ID 가 snowflake 가 아님 |

봇의 에러 `detail` 은 응답에 싣지 않는다 (길드·역할 ID 같은 봇 내부 사정이다). 서버 로그에만 남긴다.
예상 밖 예외는 메시지를 로그에 남기지 않는다 — 키 끝에 개행이 붙으면 JDK 가 헤더 값(= API 키)을 통째로 예외 메시지에 싣는다.

## 봇 호출 — 백엔드가 보내는 것

```
POST {DISCORD_BOT_URL}/api/v1/studies
Content-Type: application/json
X-API-Key: {DISCORD_API_KEY}
X-Discord-User-ID: {요청자 ACCOUNT.DISCORD_ID}
Idempotency-Key: {호출마다 새 UUID v4}

{ "studyName": "..." }
```

- **자동 재시도는 하지 않는다.** 봇은 같은 이름의 두 번째 요청에 409 를 주므로 재시도해도 ID 를 받을 수 없다.
- 타임아웃: 연결 3초, 읽기 30초.
- 응답의 두 ID 는 `^[0-9]{17,20}$` 로 검증한 뒤 저장한다 (컬럼이 `VARCHAR(20)` 이고, 봇도 신뢰 경계 밖이다).

## 알려진 한계

- **봇 성공 뒤 저장 실패** (DB 장애, 두 재시도가 동시에 다른 이름으로 들어와 늦은 쪽, 기다리는 사이 스터디 삭제) → 디스코드에 카테고리가 남고
  연결은 없다. ERROR 로그에 두 ID 를 남긴다. 수동으로 행을 넣어 붙인다 — 기존 ID 로 연결만 만드는 엔드포인트는 아직 없다.
- **연결 실패를 화면이 모른다.** 등록 응답(201, 바디 없음)에 연결 여부가 없다. 백오피스가 알아야 하면 조회
  엔드포인트나 응답 필드를 따로 정한다.
- **스터디 삭제** 는 연결 행도 지우지만, 디스코드 카테고리·역할은 남는다 (봇에 삭제 API 가 없다).
