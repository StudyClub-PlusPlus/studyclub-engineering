---
상태: 질문
물어볼 사람: 기획 · 백엔드
반영: 결정 전
---

# 디스코드 자동화 다섯 가지 중 연결된 건 「스터디 생성」 하나 — 회원 디스코드 ID 가 없어 그것도 멈춰 있다

## 미리 알아야 할 것

- **디스코드 봇**(`discord/` 폴더): 우리 디스코드 서버(= **길드**)에서 채널을 만들고 역할을 붙였다 떼는 프로그램이다.
  스스로 움직이지 않는다. **백엔드가 "이거 해 줘" 하고 불러야** 일한다.
- **API**: 프로그램끼리 일을 부탁하는 창구. 그 창구의 주소를 **엔드포인트**라 한다. 봇은 창구를 아홉 개 열어 두었다 ([`summary.md`](../discord-development-guide/api/summary.md)).
- **role(역할)**: 디스코드에서 사람에게 붙이는 이름표. 이름표가 있어야 그 스터디 음성 채널에 들어갈 수 있다.
  - 스터디 role: 스터디마다 하나. 스터디를 만들 때 봇이 같이 만든다
  - 네비게이터 role: **길드 전체에 하나**. 여러 스터디가 같이 쓴다
- **디스코드 ID**: 디스코드가 사람마다 붙인 숫자 번호. 봇은 닉네임이 아니라 **이 번호로** 사람을 찾는다. 우리 DB 의 `ACCOUNT.DISCORD_ID` 칸에 들어간다.
- **명부**(`STUDY_PARTICIPANT`): 그 스터디에 실제로 참여하는 사람 목록. 신청서(`STUDY_APPLICATION`)와는 다른 표다.
  스펙상 **신청만으로는 명부에 들어가지 않는다** ([study-application 스펙 §신청 제출](../../specs/study-application/spec.md)).
- **커밋 후 호출**: DB 저장이 확정된 **다음에** 봇을 부르는 방식. 봇이 실패해도 우리 쪽 작업은 성공으로 남는다. 스터디 생성이 이미 이렇게 한다.
- 비유하면 봇은 **열쇠 담당 직원**이다. 열쇠(role)를 만들고 나눠 주고 거둘 준비는 끝났다.
  그런데 접수처(백엔드)가 직원을 부르는 건 "방을 새로 만들 때" 한 번뿐이다. 게다가 손님 명단에 **손님 번호(디스코드 ID)가 비어 있어서**
  그 한 번도 실제로는 못 부르고 있다.

## 한 줄 요약

봇 쪽 기능은 다 있다. 하지만 백엔드가 봇을 부르는 건 **스터디 생성** 때뿐이다.
회원의 디스코드 ID 를 저장하는 기능이 없어서, 생성도 실제로는 건너뛰고 있다. **스터디 신청은 아무도 못 하는 상태다.**
백엔드가 만들 것은 [개발 범위](#백엔드-개발-범위)의 B1~B6 이다. **B1(디스코드 계정 연동)이 먼저다.**

## 왜 — 지금 뭐가 문제인가

기획에서 정한 자동화 다섯 가지를 코드·스펙과 맞춰 봤다 (2026-10-18, `beta` 기준).

| 언제 | 봇이 할 일 | 봇 창구 | 그 시점의 백엔드 API | 봇 호출 |
|---|---|---|---|---|
| 회원가입 | 디스코드 가입 여부 확인 | **없음** | `POST /api/me/discord/link` — 스펙작성중, 코드 없음 | ❌ |
| 캡틴이 스터디 생성 | 채널·스터디 role 생성 | `POST /api/v1/studies` ✅ | `POST /api/admin/studies` — 구현완료 | ⚠️ 부르지만 디스코드 ID 가 없어 건너뜀 |
| 크루가 신청서 제출 | 크루에게 스터디 role 부여 | `POST /api/v1/roles/{roleId}/users` ✅ | `POST /api/studies/{id}/applications` — 구현완료 | ❌ |
| 캡틴이 네비게이터 선정 | 네비게이터 role 부여 | `POST /api/v1/roles/navigator/users` ✅ | `PATCH /api/admin/studies/{id}/participants/{pid}/role` — 스펙작성중, 코드 없음 | ❌ |
| 참여 중단 | 스터디 role 회수 | `DELETE /api/v1/roles/{roleId}/users` ✅ | `POST /api/studies/{id}/attendances` 의 `withdrawals[]` — 스펙작성중, 코드 없음 | ❌ |

### 1. 디스코드 ID 가 저장되지 않는다 — 다른 문제는 전부 여기서 시작된다

- `ACCOUNT.DISCORD_ID` 칸은 있다. 그런데 **값을 넣는 코드가 없다** (`Account.java` 에 읽는 메서드만 있음).
- 연동 API `POST /api/me/discord/link` 는 스펙만 있다 ([study-application 스펙 §디스코드 계정 연동](../../specs/study-application/spec.md)).
- 사용자 사이트의 「디스코드 연동」 버튼은 **가짜다.** 0.4초 기다렸다가 성공한 척한다
  (`frontend/apps/core-front/src/components/ApplyDiscordGate.tsx` — `TODO(api)`).
- 그래서 벌어지는 일:
  - **스터디 생성**: 캡틴 계정에 디스코드 ID 가 없다. 봇을 부르지 않고 경고 로그만 남긴다. 스터디는 정상으로 만들어진다.
  - **스터디 신청**: 디스코드 ID 가 없으면 「디스코드 연동이 필요합니다」(403)로 막힌다.
    연동할 방법이 없으니 **실제 서버에서는 누구도 신청할 수 없다.**

### 2. 스터디 생성 — 유일하게 연결된 곳

- 백오피스에서 스터디를 등록하면 봇이 카테고리, 텍스트 채널 `로비-이름`, 음성 채널 `공부방-이름`, 스터디 role 을 만든다.
  만들어진 번호는 `STUDY_DISCORD_LINK` 에 저장된다 ([스펙](../../specs/discord-study-link/spec.md)).
- 봇이 실패해도 스터디 등록은 성공한다. 다시 붙이는 창구 `POST /api/admin/studies/{id}/discord-link` 가 있다.
- 다만 **실패했는지 화면에서 알 수 없다.** 등록 응답에 결과가 없어서 로그를 봐야 안다.

### 3. 신청서 제출 → 스터디 role — 언제 줄지가 안 정해졌다

- 신청 API 는 저장하고 운영 알림을 보내는 데서 끝난다. 봇을 부르지 않는다.
- 자동화 목록은 「제출 시」다. 그런데 스펙상 제출만으로는 **명부에 들어가지 않는다.**
  명부에 넣는 시점도 아직 미정이다 — 반 지정 때인지, 모집 마감 때 한꺼번에인지 ([study-group 스펙 미결 사항](../../specs/study-group/spec.md)).
- 제출 때 role 을 주면 **명부에 없는 사람이 음성 채널에 들어올 수 있다.** 명부에 들어갈 때 주면 「제출 시」와 다르다. → [질문 3](#물어볼-것)

### 4. 네비게이터 선정 → 네비게이터 role

- 지정 API 는 스펙만 있다 (`PATCH .../participants/{pid}/role`, [study-group 스펙](../../specs/study-group/spec.md)). 그 스펙에 디스코드 이야기는 없다.
- 봇은 이 창구를 **디스코드에서 captain role 을 가진 사람**의 요청으로만 받는다. 시스템 호출은 안 된다.
  그래서 지정하는 캡틴 본인 계정에도 디스코드 ID 가 있어야 한다.
- 네비게이터 role 은 길드에 하나다. 스터디 A 에서 해제됐다고 떼면 스터디 B 의 네비게이터 권한도 같이 사라진다.

### 5. 참여 중단 → role 회수

- 중단은 출석 저장 API 의 `withdrawals[]` 로 하기로 스펙이 잡혀 있다 ([study-participant 스펙](../../specs/study-participant/spec.md)). 코드는 없다.
  이 스펙에도 디스코드 이야기는 없다.
- 하차 표시 메서드(`StudyParticipant.markWithdrawn`)는 있지만 부르는 곳이 없다.
- 중단은 **네비게이터도** 할 수 있다. 그런데 네비게이터 role 회수는 캡틴만 부를 수 있다. 네비게이터인 크루가 중단되면 스터디 role 은 회수되지만 **네비게이터 role 은 남는다.** → [질문 5](#물어볼-것)

### 공통: 백엔드가 「시스템」으로 봇을 부르는 설정이 없다

- 스터디 role 부여·회수는 사람이 아니라 백엔드가 알아서 하는 일이다. 봇 규칙상 이때는 요청자 칸(`X-Discord-User-ID`)에 **봇 자신의 번호**(`DISCORD_BOT_ID`)를 넣는다.
- 백엔드의 봇 호출 부품(`DiscordBotClient`)에는 이 설정이 없다. 스터디 생성 말고는 부르는 메서드도 없다.

## 디스코드 API 현황

창구는 세 갈래다. **봇이 연 창구**(백엔드가 봇을 부름), **백엔드가 연 창구**(봇이나 화면이 백엔드를 부름), **앞으로 만들 창구**.

### 봇이 연 창구 — `discord/app/api/routes/` (9개 모두 구현)

| 창구 | 하는 일 | 지금 부르는 곳 | 불러야 하는 곳 |
|---|---|---|---|
| `POST /api/v1/studies` | 카테고리·채널 2개·스터디 role 생성 | ✅ 백엔드 스터디 등록 (`StudyDiscordLinkService`) | — |
| `GET /api/v1/studies/{discordStudyId}/channels` | 스터디 채널 목록 | ❌ 없음 | 정해진 곳 없음. 스터디 상세의 디스코드 링크를 자동으로 채울 때 쓸 수 있다 |
| `POST /api/v1/roles/{discordRoleId}/users` | 스터디 role 부여 | ❌ 없음 | B3 크루 편입 |
| `DELETE /api/v1/roles/{discordRoleId}/users` | 스터디 role 회수 | ❌ 없음 | B5 참여 중단 |
| `POST /api/v1/roles/navigator/users` | 네비게이터 role 부여 | ❌ 없음 | B4 네비게이터 지정 |
| `DELETE /api/v1/roles/navigator/users` | 네비게이터 role 회수 | ❌ 없음 | B4 네비게이터 해제 |
| `POST /api/v1/channels/{discordChannelId}/msg` | 스터디 채널에 메시지 | ❌ 없음 | 정해진 곳 없음 (회차 안내 등 후보) |
| `POST /api/v1/channels/alert/msg` | 운영 alert 채널에 메시지 | ❌ 없음 | 정해진 곳 없음. Grafana 알림은 이 창구가 아니라 봇 토큰으로 직접 올리고, 백엔드 운영 알림(`OpsAlertNotifier`)은 webhook 을 쓴다 |
| `POST /api/v1/channels/announcement/msg` | 길드 전체 공지 | ❌ 없음 | 정해진 곳 없음 |

### 백엔드가 연 창구

| 창구 | 하는 일 | 상태 | 부르는 곳 |
|---|---|---|---|
| `POST /api/discord/studies/{discordStudyId}/attendances` | 봇이 음성 채널 출석을 백엔드에 기록 | ✅ 구현완료 ([discord-attendance](../../specs/discord-attendance/spec.md)) | ✅ 봇 `/attendance` 명령 (`discord/app/backend_client.py`) |
| `POST /api/admin/studies/{studyId}/discord-link` | 자동 생성이 실패한 스터디에 디스코드 다시 붙이기 | ✅ 구현완료 ([discord-study-link](../../specs/discord-study-link/spec.md)) | ❌ **백오피스 화면에 버튼이 없다.** 지금은 API 를 직접 불러야 한다 |
| `POST /api/me/discord/link` | 디스코드 계정 연동 (`DISCORD_ID` 저장) | ❌ 스펙작성중, 코드 없음 | ❌ 사이트 연동 창이 불러야 하는데 가짜로 성공한다 |

### 앞으로 만들 창구

| 창구 | 누가 | 왜 | 언제 |
|---|---|---|---|
| `POST /api/me/discord/link` (위 표) | 디스코드 스쿼드 | 모든 자동화의 출발점 | **지금** (B1) |
| `GET /auth/me` 에 `discordLinked` 필드 추가 | 디스코드 스쿼드 | 화면이 연동 여부를 서버 값으로 알게 (아래 「화면·기능」 ①) | B1 과 같이 |
| 봇 「길드 멤버인가」 창구 | 디스코드 스쿼드 | 가입 여부 확인 | 질문 2 가 (나)일 때 (B6) |
| 네비게이터 지정·해제, 참여 중단, 명부 편입 API | 스터디 스쿼드 | 이벤트를 발행할 자리 | 각 스펙대로 (B4 · B5 · B3) |

## 화면·기능별 호출 현황

API 를 불러야 하는데 안 부르거나, 다른 것을 보고 있는 곳이다.

| # | 화면·기능 | 파일 | 지금 | 해야 할 것 | 담당 |
|---|---|---|---|---|---|
| ① | 사이트 「신청하기」 버튼 | `core-front/src/components/ApplyButton.tsx` | 연동 여부를 **브라우저 저장소**(`localStorage` 의 `sc_discord`)로 판단한다. 서버의 `DISCORD_ID` 와 상관없다 | `GET /auth/me` 의 `discordLinked` 로 판단. 서버가 403 을 주면 연동 창을 여는 처리는 이미 있다 (`ApplyDialog` 의 `onRequireDiscord`) | 프론트 (B1 이후) |
| ② | 사이트 「디스코드 연동」 창 | `core-front/src/components/ApplyDiscordGate.tsx` | 0.4초 뒤 성공한 척하고 브라우저 저장소에 가짜 핸들(`jiwon_dev`)을 쓴다 | Discord 로그인 창 → 돌아온 `code` 로 `POST /api/me/discord/link` | 프론트 (B1 이후) |
| ③ | 신청서의 디스코드 별명 칸 | `core-front/src/components/ApplyDialog.tsx` | 기본값을 브라우저 저장소에서 읽는다. 제출은 서버로 간다 ✅ | 스펙대로 `GET /auth/me` 의 `discordNickname` 에서 읽기 | 프론트 |
| ④ | 백오피스 스터디 등록 | `back-office-front/src/components/StudyForm.tsx` | 등록은 된다. 디스코드 생성이 성공했는지 **알 수 없다** | 상세에 연결 여부 표시 + 실패 시 「디스코드 다시 연결」 버튼(`POST .../discord-link`) | 디스코드 스쿼드 (응답 필드) · 프론트 |
| ⑤ | 스터디의 디스코드 링크 | 백오피스 `StudyForm` 입력 → 사이트 상세·내 스터디 표시 | 캡틴이 링크(`STUDY.DISCORD_CHANNEL_URL`)를 **손으로** 넣는다. 봇이 만든 채널과 따로 논다 | 봇이 만든 채널로 자동으로 채울지 정한다 (이번 범위 밖) | 기획 |
| ⑥ | 신청 제출 (백엔드) | `StudyApplicationService.submit` | 봇을 안 부른다 | 질문 3 이 「제출 시」면 B3 구독자가 `study_application.submitted` 를 듣는다 | 디스코드 스쿼드 |
| ⑦ | 네비게이터 지정·해제 (백엔드) | 없음 | API 자체가 없다 | API + `role_changed` 발행 → B4 구독자 | 스터디 → 디스코드 |
| ⑧ | 참여 중단 (백엔드) | 없음 | API 자체가 없다 | API + `withdrawn` 발행 → B5 구독자 | 스터디 → 디스코드 |
| ⑨ | 회원 탈퇴 (백엔드) | `AccountDeletionService` | 디스코드 role 이 그대로 남는다 | 이번 범위 밖 — [user-leave 스펙](../../specs/user-leave/spec.md)이 「디스코드 스쿼드와 별도로 맞춘다」고 적어 두었다 | 디스코드 스쿼드 |
| ⑩ | 백오피스 회원 권한 변경 | `back-office-front/src/features/users/` | 「디스코드 설정은 운영자에게 문의」 안내만 띄운다 | **바꾸지 않는다** — 10-04 에 손으로 하기로 정했다 ([admin-users 스펙](../../specs/admin-users/spec.md)) | — |

## 백엔드 개발 범위

**공통 규칙** — B3~B5 는 전부 이 규칙을 따른다. 스터디 생성(`StudyDiscordLinkService.linkAfterCreate`)이 이미 쓰는 방식이다.

- **커밋 후에 부른다.** 봇 호출을 DB 트랜잭션 안에 넣지 않는다. 봇은 최대 30초 걸릴 수 있다.
- **이벤트로 붙인다.** 스터디 서비스가 봇을 직접 부르지 않는다. 서비스는 「무슨 일이 일어났다」는 **도메인 이벤트**만 발행하고, 디스코드 쪽이 그 이벤트를 **구독**해서 봇을 부른다.
  레포의 규칙이 이미 그렇다 — 「부수효과(외부 연동)는 구독자로 붙인다」 ([domain-events 스펙](../../specs/domain-events/spec.md)). 이 경계로 [두 스쿼드의 일을 나눈다](#스쿼드별-작업).
- **봇이 실패해도 본 작업은 성공이다.** 신청·지정·중단 응답은 봇 결과와 상관없이 그대로 나간다. 실패는 WARN 로그로 남긴다.
- **건너뛰는 경우**: 봇 설정이 없을 때(로컬·테스트), 스터디에 `STUDY_DISCORD_LINK` 가 없을 때, 대상의 `DISCORD_ID` 가 없을 때. 모두 INFO/WARN 로그만 남긴다.
- **응답 200 이어도 실패가 섞여 있다.** 봇은 사람별 결과를 `failed[]` 에 담는다(`NOT_IN_GUILD`, `DISCORD_REJECTED`). 이것도 WARN 로그로 남긴다.
- **스펙 먼저**: 각 항목은 해당 스펙에 「디스코드 연동」 절을 먼저 추가한다 (아래 표의 「스펙」 칸).

| # | 무엇 | 언제 부르나 | 봇 창구 · 요청자 | 스펙 | 막는 것 |
|---|---|---|---|---|---|
| **B1** | 디스코드 계정 연동 API | 사용자가 연동 버튼을 누를 때 | 봇 아님 — Discord OAuth | [study-application §디스코드 계정 연동](../../specs/study-application/spec.md) (작성중 → 확정) | 없음. **제일 먼저** |
| **B2** | `DiscordBotClient` 확장 | — | 4개 창구 메서드 + 시스템 호출 설정 | [discord-study-link](../../specs/discord-study-link/spec.md) 에 추가 | B1 무관. B3~B5 의 바탕 |
| **B3** | 크루 스터디 role 부여 | 질문 3 의 답 (제출 후 또는 명부 편입 후) | `POST /roles/{roleId}/users` · 시스템 | study-application 또는 study-group | B1 · B2 · 질문 3 |
| **B4** | 네비게이터 role 부여·회수 | 네비게이터 지정·해제 API 커밋 후 | `POST`·`DELETE /roles/navigator/users` · **지정한 캡틴** | [study-group](../../specs/study-group/spec.md) | B1 · B2 · 지정 API |
| **B5** | 참여 중단 시 스터디 role 회수 | `withdrawals[]` 커밋 후 | `DELETE /roles/{roleId}/users` · 시스템 | [study-participant](../../specs/study-participant/spec.md) | B1 · B2 · 중단 API · 질문 5 |
| **B6** | 가입·연동 때 길드 가입 확인 | 질문 1·2 의 답 | **봇에 새 창구 필요** | 질문 답 이후 | 질문 1 · 2 |

### B1. 디스코드 계정 연동 — `POST /api/me/discord/link`

- 화면이 Discord OAuth 인가 코드(`code`)를 보낸다. 서버가 그 코드를 Discord 에 보내 토큰으로 바꾸고, 사용자 정보를 받아 `ACCOUNT.DISCORD_ID` · `DISCORD_HANDLE` 에 저장한다.
- 클라이언트가 보낸 ID·핸들은 쓰지 않는다. 응답에 `DISCORD_ID` 를 싣지 않는다.
- 에러: `code` 없음 400 · 다른 계정이 이미 쓰는 ID 409 · Discord 실패·타임아웃 502 (부분 저장 없음).
- **새 설정값**: Discord OAuth 앱의 client id · client secret · redirect URI. 값은 내부 시크릿 저장소에만 두고 코드에는 `env` 이름만 쓴다.
- 끝나면 풀리는 것: 신청 403, 스터디 생성 때 디스코드 건너뜀.
- 같이 할 것: `GET /auth/me` 응답에 `discordLinked`(Boolean) 를 더한다. 화면은 지금 연동 여부를 브라우저 저장소로 판단한다 — 「판정은 서버가 내려준다」 규칙대로 서버 값을 주어야 한다. `DISCORD_ID` 자체는 싣지 않는다.
- 프론트는 `ApplyDiscordGate` 의 가짜 연동을 이 API 로, `ApplyButton` 의 판단을 `discordLinked` 로 바꾼다 ([화면·기능 ①②](#화면기능별-호출-현황)).

### B2. `DiscordBotClient` 확장

- 메서드 4개: `assignRole(roleId, studyId, userIds)` · `removeRole(...)` · `assignNavigatorRole(studyId, userIds, captainDiscordId)` · `removeNavigatorRole(...)`.
  `studyId` 는 디스코드 카테고리 ID 다 (봇 로그용).
- 응답 `{succeededCount, failed[]}` 를 그대로 돌려준다. 요청 한 번에 최대 100명.
- **새 설정값** `discord.bot-id` (env `DISCORD_BOT_ID`). 스터디 role 은 이 값을 `X-Discord-User-ID` 로 보내 시스템으로 부른다. 비어 있으면 `isConfigured()` 와 같은 식으로 호출하지 않는다.
- role 창구는 같은 요청을 다시 보내도 결과가 같다(멱등). 그래서 생성과 달리 **재시도해도 안전하다.**
- 에러를 로그에 남길 때는 생성과 같은 규칙을 지킨다: 봇 `detail` 은 로그에만, API 키가 실릴 수 있는 예외 메시지는 버린다.

### B3. 크루 스터디 role 부여

- 질문 3 이 「제출 시」면: 신청 커밋 뒤 이미 나가는 `StudyApplicationSubmitted` 이벤트를 받아 부른다.
- 질문 3 이 「명부 편입 시」면: 명부 행을 만드는 API(아직 미정) 커밋 뒤에 부른다.
- 대상 스터디의 `STUDY_DISCORD_LINK.DISCORD_ROLE_ID` 로, 신청자의 `DISCORD_ID` 한 명을 보낸다.

### B4. 네비게이터 role 부여·회수

- `LEADER` 로 바꾸면 `assign-navigator-role`, `MEMBER` 로 바꾸면 `remove-navigator-role`.
- 요청자는 **지정 API 를 부른 ADMIN 의 `DISCORD_ID`** 다. 없으면 봇을 부르지 않고 WARN (질문 4).
- 회수는 그 사람이 **남은 어떤 스터디에서도 활성 `LEADER` 가 아닐 때만** 부른다. 명부를 세는 조회가 하나 필요하다.

### B5. 참여 중단 시 스터디 role 회수

- `withdrawals[]` 로 중단된 명부 행들의 `DISCORD_ID` 를 모아 `remove-role` 을 한 번 부른다 (100명 이하).
- 중단된 사람이 `LEADER` 였으면 네비게이터 role 처리는 질문 5 를 따른다.
- 길드를 이미 떠난 사람은 봇이 성공으로 센다. 따로 처리하지 않아도 된다.

### B6. 길드 가입 확인 — 질문 1·2 이후

- 질문 2 가 「길드 멤버여야 한다」면 **봇 쪽에** 「이 사람이 길드 멤버인가」 창구를 새로 만들어야 한다 (지금 없음). 백엔드는 B1 연동 직후 그 창구를 부른다.
- 「계정 연동만」이면 B1 으로 끝난다. B6 는 없다.

### 이번 범위 밖 (알고만 있을 것)

- **회원 탈퇴**: 명부 행은 `DELETED` 가 되지만 디스코드 role 은 그대로 남는다. 넣을지는 따로 정한다.
- **스터디 삭제**: 디스코드 카테고리·role 을 지우는 봇 창구가 없다.
- **스터디 이름 변경**: 디스코드 채널·role 이름을 바꾸는 봇 창구가 없다. 웹에서 제목을 바꿔도 디스코드는 옛 이름으로 남는다.

## 스쿼드별 작업

**나누는 기준은 하나다.** 스터디 스쿼드는 **「무슨 일이 일어났다」를 알린다.** 디스코드 스쿼드는 **그걸 듣고 디스코드에 반영한다.**
식당에 비유하면 스터디 스쿼드는 주문을 받아 **주문서를 꽂는** 홀이다. 디스코드 스쿼드는 주문서를 보고 **요리하는** 주방이다.
홀은 요리법을 몰라도 되고, 주방은 손님과 말하지 않아도 된다. 둘이 맞춰야 하는 건 **주문서 양식(이벤트)** 하나다.

### 먼저 같이 정할 것 — 이벤트 3개 (주문서 양식)

두 스쿼드가 이것부터 합의하면 그다음은 **따로, 동시에** 개발할 수 있다. 이름·모양은 [domain-events 스펙](../../specs/domain-events/spec.md) 규칙을 따른다.

| 이벤트 (name) | 언제 발행 | 페이로드 | actor | 듣는 쪽이 하는 일 |
|---|---|---|---|---|
| `study_participant.joined` | 명부 행이 생겼을 때 (질문 3 이 「제출 시」면 이 이벤트 대신 기존 `study_application.submitted` 를 듣는다) | `studyId` · `participantId` · `accountId` | 명부에 넣은 사람 | B3 스터디 role 부여 |
| `study_participant.role_changed` | 네비게이터 지정·해제 | `studyId` · `participantId` · `accountId` · `from` · `to` (`LEADER`/`MEMBER`) | **지정한 캡틴** — 디스코드 쪽이 이 사람 이름으로 봇을 부른다 | B4 네비게이터 role 부여·회수 |
| `study_participant.withdrawn` | 참여 중단 (`withdrawals[]` 의 행마다 1개) | `studyId` · `participantId` · `accountId` · `participantRole` | 중단시킨 사람 | B5 스터디 role 회수 (+ 질문 5) |

- 같은 값이면 발행하지 않는다 (예: 이미 `LEADER` 인데 다시 `LEADER`).
- 페이로드에 디스코드 ID 를 싣지 않는다. 듣는 쪽이 `accountId` 로 찾는다.

### 스터디 스쿼드 — 주문서를 꽂는다

| 할 일 | 스펙 | 비고 |
|---|---|---|
| 명부 편입 시점을 기획과 정한다 (질문 3) | [study-group 미결 사항](../../specs/study-group/spec.md) | B3 이 이 답을 기다린다 |
| 명부 편입 API 를 만들고 `study_participant.joined` 발행 | study-group | 질문 3 이 「제출 시」면 발행할 것 없음 — 이미 `study_application.submitted` 가 나간다 |
| 네비게이터 지정·해제 API (`PATCH .../participants/{pid}/role`) + `study_participant.role_changed` 발행 | [study-group](../../specs/study-group/spec.md) | 이미 스펙작성중인 API 에 발행 한 줄을 더한다 |
| 참여 중단 (`withdrawals[]`) + `study_participant.withdrawn` 발행 | [study-participant](../../specs/study-participant/spec.md) | 같음 |
| 위 이벤트 3개를 domain-events 스펙 표에 올린다 | [domain-events](../../specs/domain-events/spec.md) | 「구독자」 칸은 디스코드 스쿼드가 채운다 |

**스터디 스쿼드가 하지 않는 것**: 봇 호출, 디스코드 ID 조회, 디스코드 실패 처리. 이벤트를 발행하면 끝이다. 구독자가 없어도 기능은 정상이다.

### 디스코드 스쿼드 — 주문서를 보고 반영한다

| 할 일 | 범위 | 비고 |
|---|---|---|
| **B1** 디스코드 계정 연동 API + Discord OAuth 앱 설정 | `POST /api/me/discord/link` | **가장 먼저.** 신청 403 · 생성 건너뜀이 이걸로 풀린다. 스펙 확정도 같이 |
| B1 짝 — `GET /auth/me` 에 `discordLinked` | `AuthDtos.AccountSelfView` | user-onboarding 스펙에 필드 추가 |
| B1 짝 — 사이트 연동 창·신청 버튼을 실제 호출로 | `ApplyDiscordGate.tsx` · `ApplyButton.tsx` | 프론트 담당에게 넘겨도 된다 |
| 백오피스 상세에 디스코드 연결 여부 필드 + 「다시 연결」 버튼 | 상세 응답 · `POST .../discord-link` | [화면·기능 ④](#화면기능별-호출-현황). 화면은 프론트 담당 |
| **B2** `DiscordBotClient` 에 role 메서드 4개 + `DISCORD_BOT_ID` 설정 | `backend/api/.../discord/` | 이벤트 합의 없이도 시작할 수 있다 |
| **B3~B5** 이벤트 구독자 — 위 표의 「듣는 쪽이 하는 일」 | `@TransactionalEventListener(AFTER_COMMIT)` + `@Async` | [공통 규칙](#백엔드-개발-범위)을 지킨다. 네비게이터 회수 전 「다른 스터디에서도 `LEADER` 인가」 조회는 이쪽이 만든다 |
| **B6** 봇에 「길드 멤버인가」 창구 (질문 2 가 (나)일 때) | `discord/` | 백엔드는 B1 직후 부른다 |
| 질문 5 가 (가)면 봇의 네비게이터 회수 권한 변경 | `discord/app/api/routes/roles.py` | |
| [discord-study-link 스펙](../../specs/discord-study-link/spec.md)에 role 연동 절 추가 + domain-events 표 「구독자」 칸 | | |

**디스코드 스쿼드가 하지 않는 것**: 명부·네비게이터·중단 API 와 그 판정. 이벤트가 오면 반영만 한다.

### 순서

```
            지금 시작                           이벤트 3개 합의 후 (동시에)
디스코드    B1 연동 → B2 봇 클라이언트  ─────────→  B3~B5 구독자
스터디      질문 3 기획과 정리          ─────────→  지정·중단·명부 API + 이벤트 발행
```

**끝났는지 확인하는 법**: 스테이지에서 크루가 연동 → 신청(또는 명부 편입) → 네비게이터 지정 → 해제 → 중단까지 한 번 돌린다.
디스코드에서 그 사람의 role 이 매 단계 맞게 붙었다 떨어지면 끝이다.

## 물어볼 것

1. **디스코드 연동은 언제 받나?** (기획)
   - 지금 화면과 스펙: 신청할 때 연동 창을 띄운다 (`ApplyDiscordGate`)
   - 자동화 목록: 「회원가입 시 확인」
   - 가입 때 받으면 신청이 단순해진다. 대신 디스코드를 안 쓰는 사람은 가입할 수 없다.
2. **「디스코드 가입 여부 확인」은 무엇까지인가?** (기획)
   - (가) 디스코드 계정만 연동했으면 된다 → B1 으로 끝
   - (나) 우리 길드에 들어와 있어야 한다 → B6 필요. 길드에 없으면 role 을 줄 수 없다 (봇이 `NOT_IN_GUILD` 로 돌려준다)
3. **스터디 role 은 언제 주나?** (기획)
   - (가) 신청서 제출 즉시 — 자동화 목록 그대로. 명부에 안 들어간 사람도 음성 채널에 들어온다
   - (나) 명부에 들어갈 때 — 그 시점(반 지정 때 / 모집 마감 때)도 같이 정해야 한다 ([study-group 미결 사항](../../specs/study-group/spec.md))
4. **디스코드를 연동하지 않은 캡틴의 네비게이터 지정을 막나?** (기획)
   - 네비게이터 role 은 캡틴 이름으로만 줄 수 있다. 연동 안 한 캡틴이 지정하면 웹에서만 네비게이터가 되고 디스코드에서는 아니다.
5. **네비게이터가 참여 중단되면 네비게이터 role 은?** (기획 · 백엔드)
   - 중단은 네비게이터도 할 수 있다. 그런데 네비게이터 role 회수는 캡틴만 할 수 있다 (봇 규칙).
   - (가) 봇 규칙을 바꿔 시스템 호출을 허용한다 (봇 수정) · (나) 남겨 두고 alert 채널로 캡틴에게 알린다 · (다) 담당 캡틴 이름으로 부른다

## 영향 — 누가 무엇을 해야 하나

- **기획**: 질문 1~5 에 답한다. 답이 나오면 디스코드 연동 Story(PRD)를 하나 만든다. 지금 `stories.md` 에는 디스코드 연동 Story 가 없다.
- **두 스쿼드 공통**: [이벤트 3개](#먼저-같이-정할-것--이벤트-3개-주문서-양식)의 이름·페이로드를 먼저 합의한다.
- **디스코드 스쿼드**: B1 · B2 는 질문과 상관없이 **지금 시작할 수 있다.** 그다음 B3~B5 구독자, 질문 답에 따라 B6·봇 권한 변경. → [디스코드 스쿼드 표](#디스코드-스쿼드--주문서를-보고-반영한다)
- **스터디 스쿼드**: 질문 3(명부 편입 시점)을 기획과 정한다. 지정·중단·명부 API 를 만들 때 이벤트 발행을 같이 넣는다. → [스터디 스쿼드 표](#스터디-스쿼드--주문서를-꽂는다)
- **운영**: 스테이지에서 스터디를 만들어도 디스코드 채널이 안 생기는 게 지금은 정상이다. 버그로 올리지 않아도 된다.
