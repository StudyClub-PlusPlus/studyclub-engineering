---
상태: 질문 · 1 · 3 · 4 · 5 결정됨 (10-20 · 10-23 · 10-24)
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
  신청하면 **같은 트랜잭션에서 명부의 기본 반에 들어간다** (#296, 10-20 결정 — [질문 3](#물어볼-것)).
- **커밋 후 호출**: DB 저장이 확정된 **다음에** 봇을 부르는 방식. 봇이 실패해도 우리 쪽 작업은 성공으로 남는다. 스터디 생성이 이미 이렇게 한다.
- 비유하면 봇은 **열쇠 담당 직원**이다. 열쇠(role)를 만들고 나눠 주고 거둘 준비는 끝났다.
  그런데 접수처(백엔드)가 직원을 부르는 건 "방을 새로 만들 때" 한 번뿐이다. 게다가 손님 명단에 **손님 번호(디스코드 ID)가 비어 있어서**
  그 한 번도 실제로는 못 부르고 있다.

## 한 줄 요약

봇 쪽 기능은 다 있다. 하지만 백엔드가 봇을 부르는 건 **스터디 생성** 때뿐이다.
회원의 디스코드 ID 를 저장하는 기능이 없어서, 생성도 실제로는 건너뛰고 있다. **스터디 신청은 아무도 못 하는 상태다.**
백엔드가 만들 것은 [개발 범위](#백엔드-개발-범위)의 B1~B6 이다. **B1(디스코드 계정 연동)이 먼저다.** 나눠 줄 작업명은 [작업 목록](#작업-목록--작업명)(`COM-` · `DSC-` · `STD-`)에 있다.

## 왜 — 지금 뭐가 문제인가

기획에서 정한 자동화 다섯 가지를 코드·스펙과 맞춰 봤다 (2026-10-18, `beta` 기준).

| 언제 | 봇이 할 일 | 봇 창구 | 그 시점의 백엔드 API | 봇 호출 |
|---|---|---|---|---|
| 회원가입 | 디스코드 가입 여부 확인 | **없음** | `POST /api/me/discord/link` — 구현완료 (#298) | ❌ |
| 캡틴이 스터디 생성 | 채널·스터디 role 생성 | `POST /api/v1/studies` ✅ | `POST /api/admin/studies` — 구현완료 | ⚠️ 부르지만 디스코드 ID 가 없어 건너뜀 |
| 크루가 신청서 제출 | 크루에게 스터디 role 부여 | `POST /api/v1/roles/{roleId}/users` ✅ | `POST /api/studies/{id}/applications` — 구현완료 | ✅ 10-23: 명부 편입 때 `joined` 발행(#310) → `StudyRoleSyncListener`(#316) |
| 캡틴이 네비게이터 선정 | 네비게이터 role 부여 | `POST /api/v1/roles/navigator/users` ✅ | `PATCH /api/admin/studies/{id}/participants` (반 · 역할 일괄, 10-21) — 구현완료 (#303) | ❌ `role_changed` 는 나간다. 구독자(DSC-08)는 질문 5 · 6 뒤 |
| 참여 중단 | 스터디 role 회수 | `DELETE /api/v1/roles/{roleId}/users` ✅ | `POST /api/me/studies/{id}/attendances` 의 `withdrawals[]` — 구현완료 (#297) | ✅ 10-23: 스터디 role 회수 (#315). 네비게이터 role 은 DSC-06 뒤 |

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
- 자동화 목록은 「제출 시」다. 그런데 **제출하면 명부에 들어가는지부터 문서가 갈린다.**
  - [신청 PRD](../../01-planning/stories/crew-submit-application/PRD.md) §처리: 「저장 … **같은 트랜잭션에서 명부 편입**」. 정원도 명부 인원으로 센다
  - [신청 스펙](../../specs/study-application/spec.md) §신청 제출: 「신청 제출 시 **명부를 만들지 않는다**」 (커밋 「신청 시 분반 배정 제거」에서 바뀜). 코드도 이쪽이다
- 갈린 이유: 명부 행에는 **반이 꼭 있어야 한다**(`STUDY_PARTICIPANT.STUDY_GROUP_ID` NOT NULL). 그런데 반은 신청자를 보고 나서 캡틴이 만든다 ([반 편성 PRD](../../01-planning/stories/captain-assign-classes/PRD.md) 「반은 모집 전에 만들 수 없다」). 신청하는 순간에는 넣을 반이 없다.
- 그래서 10-18 당시에는 **신청해도 명부에 아무도 안 들어갔다.** 정원 검사도 명부 인원을 세므로 **정원이 영영 차지 않았다.** → [질문 3](#물어볼-것)
- **결정됨 (10-20, #296)**: 신청 즉시 명부의 **기본 반**에 넣는다. 반을 나누면 캡틴이 옮긴다. role 은 제출 때 `study_participant.joined` 로 준다 (#310).

### 4. 네비게이터 선정 → 네비게이터 role

- 지정 API 는 스펙만 있다 (`PATCH .../participants` — 반 · 역할 일괄, [study-group 스펙](../../specs/study-group/spec.md)). 그 스펙에 디스코드 이야기는 없다.
  - **10-23: 구현됨 (#303).** 역할이 바뀐 행마다 `study_participant.role_changed`(`previousRole` · `newRole`)를 내고, 감사 로그 `PARTICIPANT_ROLE` 을 남긴다. 듣는 쪽(DSC-08)은 아직 없다.
- 봇은 이 창구를 **디스코드에서 captain role 을 가진 사람**의 요청으로만 받는다. 시스템 호출은 안 된다.
  그래서 지정하는 캡틴 본인 계정에도 디스코드 ID 가 있어야 한다.
  - **10-24: 봇이 권한 체크를 지우기로 했다** (DSC-13). 백엔드가 시스템 아이디로 부를 수 있다 — [share 10-24](2026-10-24-discord-squad-agreement.md)
- 네비게이터 role 은 길드에 하나다. 스터디 A 에서 해제됐다고 떼면 스터디 B 의 네비게이터 권한도 같이 사라진다.

### 5. 참여 중단 → role 회수

- 중단은 출석 저장 API 의 `withdrawals[]` 로 하기로 스펙이 잡혀 있다 ([study-participant 스펙](../../specs/study-participant/spec.md)). 코드는 없다.
  - **10-23: 구현됨 (#297)** — `study_participant.withdrawn` 발행. 스터디 role 회수 구독자도 머지됨 (#315, DSC-09).
  이 스펙에도 디스코드 이야기는 없다.
- 하차 표시 메서드(`StudyParticipant.markWithdrawn`)는 있지만 부르는 곳이 없다.
- 중단은 **네비게이터도** 할 수 있다. 그런데 네비게이터 role 회수는 캡틴만 부를 수 있다. 네비게이터인 크루가 중단되면 스터디 role 은 회수되지만 **네비게이터 role 은 남는다.** → [질문 5](#물어볼-것)
  - **10-24: 질문 5 결정됨** — 봇 권한 체크를 지우므로(DSC-13) 백엔드가 시스템 아이디로 회수한다. 백오피스 출석부의 담당 캡틴 중단(#325)도 같다.

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
| `POST /api/me/discord/link` | 디스코드 계정 연동 (`DISCORD_ID` 저장) | ✅ 구현완료 (#298) | 🔶 사이트 연동 창이 부르게 바꿨다 (#292). OAuth 팝업(DSC-04)이 붙기 전 운영·stage 는 부르지 않고 「준비 중」을 보인다 |

### 앞으로 만들 창구

| 창구 | 누가 | 왜 | 언제 |
|---|---|---|---|
| `POST /api/me/discord/link` (위 표) | 디스코드 스쿼드 | 모든 자동화의 출발점 | **지금** (B1) |
| `GET /api/me` 에 `discordLinked` 필드 추가 | 디스코드 스쿼드 | 화면이 연동 여부를 서버 값으로 알게 (아래 「화면·기능」 ①) | B1 과 같이 |
| ~~봇 「길드 멤버인가」 창구~~ | — | 필요 없어졌다 — 연동 때 OAuth 권한으로 확인한다 ([질문 2](#물어볼-것)) | — |
| 봇 네비게이터 role 창구에 시스템 호출 허용 | 디스코드 스쿼드 | 네비게이터가 중단시킨 경우에도 회수 ([질문 5](#물어볼-것)) | DSC-06 — 10-24: 봇 API 권한 체크를 모두 지우는 것으로 (DSC-13) |
| 🆕 디스코드 → 웹: captain · navigator role 변경 알림 · 하루 한 번 전체 명단 | 봇: 디스코드 스쿼드 · 받는 창구: 스터디 스쿼드 (제안) | 디스코드에서 손으로 바꾼 role 을 웹이 알게 ([share 10-24](2026-10-24-discord-squad-agreement.md)) | DSC-14 · DSC-15 · DSC-16 — 받은 뒤 웹이 무엇을 할지 먼저 정한다 |
| 네비게이터 지정·해제, 참여 중단, 명부 편입 API | 스터디 스쿼드 | 이벤트를 발행할 자리 | **됨** — STD-02 #310 · STD-03 #303 · STD-04 #297 |

## 화면·기능별 호출 현황

API 를 불러야 하는데 안 부르거나, 다른 것을 보고 있는 곳이다.

| # | 화면·기능 | 파일 | 지금 | 해야 할 것 | 담당 |
|---|---|---|---|---|---|
| ① | 사이트 「신청하기」 버튼 | `core-front/src/components/ApplyButton.tsx` | ✅ #292 · #327 — `GET /api/me` 의 `discordLinked` 로 판단한다 (미연동이면 폼 대신 연동 창) | `GET /api/me` 의 `discordLinked` 로 판단. 서버가 403 을 주면 연동 창을 여는 처리는 이미 있다 (`ApplyDialog` 의 `onRequireDiscord`) | 프론트 (B1 이후) |
| ② | 사이트 「디스코드 연동」 창 | `core-front/src/components/ApplyDiscordGate.tsx` | ✅ #292 · DSC-04 — 디스코드 OAuth 팝업으로 받은 코드로 `POST /api/me/discord/link` 를 부른다. 빌드에 `NEXT_PUBLIC_DISCORD_CLIENT_ID` 가 없는 환경은 「준비 중」만 보인다. 403 길드 미가입이면 서버 가입 안내 | Discord 로그인 창 → 돌아온 `code` 로 `POST /api/me/discord/link` | 프론트 (B1 이후) |
| ③ | 신청서의 디스코드 별명 칸 | `core-front/src/components/ApplyDialog.tsx` | 기본값을 브라우저 저장소에서 읽는다. 제출은 서버로 간다 ✅ | 스펙대로 `GET /api/me` 의 `discordNickname` 에서 읽기 | 프론트 |
| ④ | 백오피스 스터디 등록 | `back-office-front/src/components/StudyForm.tsx` | 등록은 된다. 디스코드 생성이 성공했는지 **알 수 없다** | 상세에 연결 여부 표시 + 실패 시 「디스코드 다시 연결」 버튼(`POST .../discord-link`) | 디스코드 스쿼드 (응답 필드) · 프론트 |
| ⑤ | 스터디의 디스코드 링크 | 백오피스 `StudyForm` 입력 → 사이트 상세·내 스터디 표시 | 캡틴이 링크(`STUDY.DISCORD_CHANNEL_URL`)를 **손으로** 넣는다. 봇이 만든 채널과 따로 논다 | 봇이 만든 채널로 자동으로 채울지 정한다 (이번 범위 밖) | 기획 |
| ⑥ | 신청 제출 (백엔드) | `StudyApplicationService.submit` | ✅ 10-23 — 명부 편입 때 `study_participant.joined` 발행(#310), `StudyRoleSyncListener` 가 스터디 role 을 붙인다(#316) | 없음 | 디스코드 스쿼드 |
| ⑦ | 네비게이터 지정·해제 (백엔드) | `PATCH /api/admin/studies/{id}/participants` | 🔶 API · `role_changed` 발행은 됨 (#303). 구독자 없음 | B4 구독자 (DSC-08) — 질문 5 · 6 뒤 | 디스코드 스쿼드 |
| ⑧ | 참여 중단 (백엔드) | 출석 저장 `withdrawals[]` | 🔶 API · `withdrawn` 발행 (#297) · 스터디 role 회수 (#315) 됨. 네비게이터였던 사람의 네비게이터 role 은 남는다 | 네비게이터 role 회수 — DSC-06 결정 뒤. 백오피스 출석부 중단(진행 중)도 같은 이벤트를 낸다 | 디스코드 스쿼드 |
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
| **B4** | 네비게이터 role 부여·회수 | 네비게이터 지정·해제 API 커밋 후 | `POST`·`DELETE /roles/navigator/users` · 시스템 (DSC-06 전에는 지정한 캡틴) | [study-group](../../specs/study-group/spec.md) | B1 · B2 · 지정 API |
| **B5** | 참여 중단 시 스터디 role 회수 | `withdrawals[]` 커밋 후 | `DELETE /roles/{roleId}/users` · 시스템 | [study-participant](../../specs/study-participant/spec.md) | B1 · B2 · 중단 API · 질문 5 |
| **B6** | 연동 때 길드 가입 확인 | 연동 API 안에서 | 봇 아님 — OAuth `guilds.members.read` | B1 과 같음 | B1 에 합친다 (DSC-01) |

### B1. 디스코드 계정 연동 — `POST /api/me/discord/link`

- 화면이 Discord OAuth 인가 코드(`code`)를 보낸다. 서버가 그 코드를 Discord 에 보내 토큰으로 바꾸고, 사용자 정보를 받아 `ACCOUNT.DISCORD_ID` · `DISCORD_HANDLE` 에 저장한다.
- 클라이언트가 보낸 ID·핸들은 쓰지 않는다. 응답에 `DISCORD_ID` 를 싣지 않는다.
- 에러: `code` 없음 400 · 다른 계정이 이미 쓰는 ID 409 · Discord 실패·타임아웃 502 (부분 저장 없음).
- **새 설정값**: Discord OAuth 앱의 client id · client secret · redirect URI. 값은 내부 시크릿 저장소에만 두고 코드에는 `env` 이름만 쓴다.
- 끝나면 풀리는 것: 신청 403, 스터디 생성 때 디스코드 건너뜀.
- 같이 할 것: `GET /api/me` 응답에 `discordLinked`(Boolean) 를 더한다. 화면은 지금 연동 여부를 브라우저 저장소로 판단한다 — 「판정은 서버가 내려준다」 규칙대로 서버 값을 주어야 한다. `DISCORD_ID` 자체는 싣지 않는다.
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
- 요청자는 **시스템**(`DISCORD_BOT_ID`)이다 — DSC-06 으로 봇이 허용한 뒤. 그 전에는 지정 API 를 부른 ADMIN 의 `DISCORD_ID` 로 부르고, 없으면 WARN.
- 회수는 그 사람이 **남은 어떤 스터디에서도 활성 `LEADER` 가 아닐 때만** 부른다. 명부를 세는 조회가 하나 필요하다.

### B5. 참여 중단 시 스터디 role 회수

- `withdrawals[]` 로 중단된 명부 행들의 `DISCORD_ID` 를 모아 `remove-role` 을 한 번 부른다 (100명 이하).
- 중단된 사람이 `LEADER` 였으면 B4 와 같은 규칙으로 네비게이터 role 도 회수한다 (시스템 호출, DSC-06 필요).
- 길드를 이미 떠난 사람은 봇이 성공으로 센다. 따로 처리하지 않아도 된다.

### B6. 길드 가입 확인 — B1 에 합친다

- 제안대로 「길드 멤버여야 한다」면, 연동할 때 OAuth 권한 `guilds.members.read` 를 같이 받아 서버가 디스코드에 직접 묻는다. **봇 새 창구는 필요 없다** ([질문 2](#물어볼-것)).
- 멤버가 아니면 저장하지 않고 「서버에 먼저 들어와 주세요」 + 초대 링크를 돌려준다. 에러 코드는 스펙에 추가한다.

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
| `study_participant.joined` | 명부에 참여로 들어왔을 때 — 새 행·되살린 행 모두. 지금은 신청 제출 때다 (10-22, `submitted` 가 아니라 이 이벤트를 듣는다 — role 은 신청서가 아니라 명부를 따른다) | `studyId` · `participantId` · `accountId` · `participantRole` | 명부에 넣은 사람 (신청이면 본인) | B3 스터디 role 부여 |
| `study_participant.role_changed` | 네비게이터 지정·해제 | `studyId` · `participantId` · `accountId` · `from` · `to` (`LEADER`/`MEMBER`) | 지정한 캡틴 (DSC-06 이 안 되면 이 사람 이름으로 봇을 부른다) | B4 네비게이터 role 부여·회수 |
| `study_participant.withdrawn` | 참여 중단 (`withdrawals[]` 의 행마다 1개) | `studyId` · `participantId` · `accountId` · `participantRole` | 중단시킨 사람 | B5 스터디 role 회수 (+ 네비게이터였으면 네비게이터 role) |

- 같은 값이면 발행하지 않는다 (예: 이미 `LEADER` 인데 다시 `LEADER`).
- 페이로드에 디스코드 ID 를 싣지 않는다. 듣는 쪽이 `accountId` 로 찾는다.

### 작업 목록 — 작업명

작업을 나눠 줄 때 아래 **ID 와 작업명**을 그대로 이슈 제목으로 쓴다. 「담당 (제안)」은 2026-10-20 에 그 영역 코드를 만든 사람 기준으로 부탁드린 값이다 — 본인이 수락하면 확정한다. 예: `[DSC-01] 디스코드 계정 연동 API`.
머리말 `[BE]` 백엔드 · `[FE]` 프론트 · `[BOT]` 디스코드 봇(`discord/`) · `[기획]` · `[스펙]`. 앞 절의 B1~B6 이 어느 작업인지는 「범위」 칸에 적었다.

**공통 — 두 스쿼드가 같이**

| ID | 작업명 | 범위 | 선행 | 담당 (제안) |
|---|---|---|---|---|
| COM-01 | [스펙] 디스코드 연동 이벤트 3개 계약 합의 | [위 표](#먼저-같이-정할-것--이벤트-3개-주문서-양식)의 이름·페이로드를 domain-events 스펙에 올린다. 「구독자」 칸은 디스코드 스쿼드가 채운다 | — | seeunrosypark |
| COM-02 | [기획] 디스코드 연동 Story(PRD) 작성 | 질문 1~5 의 답을 PRD 로. `stories.md` 에 한 줄 | 질문 답 | seeunrosypark |
| COM-03 | [기획] 디스코드 연동 화면 — 자동 가입 안내 · 프로토 | 연동 버튼 → 동의 → 「서버에 들어갔어요 / 이미 들어와 있어요」 안내. playground 프로토까지 | 자동 가입 결정 (질문 2) | seeunrosypark |
| COM-04 | [BE] 🆕 디스코드 알림 발송 기록 | 10-24 회의. 커뮤니티 스쿼드 몫. 같은 `DiscordBotClient` 를 쓰므로 STD-06 과 한 번에 만든다 | 기록 형태 ([share 10-24](2026-10-24-discord-squad-agreement.md) 물어볼 것 2) | 커뮤니티 스쿼드 |

**디스코드 스쿼드 — 주문서를 보고 반영한다**

| ID | 작업명 | 범위 | 선행 | 담당 (제안) |
|---|---|---|---|---|
| DSC-01 | [BE] 디스코드 계정 연동 API (`POST /api/me/discord/link`) | B1. Discord OAuth 앱 설정 · `DISCORD_ID`/`DISCORD_HANDLE` 저장 · **길드 멤버 확인**(질문 2, B6) · 스펙 확정. **머지됨 (#298)** | — **가장 먼저** | j7hwang (OAuth 앱 등록) · doxxx93 (API) |
| DSC-02 | [BE] `GET /api/me` 에 `discordLinked` 추가 | user-onboarding 스펙 필드 추가. 내 정보 조회는 #262 로 `/auth/me` → `/api/me` 로 옮겨졌다. **머지됨 (#327)** (ID 는 내리지 않고 연동 여부만. 신청 403 과 같은 `Account.isDiscordLinked()`) | — `DISCORD_ID` 칸만 읽으므로 DSC-01 없이 할 수 있다 | hereokay |
| DSC-03 | [BE·FE] 가입 화면에 **선택** 디스코드 연동 단계 추가 | 질문 1 결정(10-23): 가입 때 연동을 받을 수 있게 하되 **건너뛸 수 있다.** 온보딩 완료 조건에는 넣지 않는다. 신청 때 연동 필수는 그대로. **결정됨(기획) — 온보딩 담당과 맞출 것** | DSC-01 | Jeongyounghyeon (BE) · LeenaKim (FE) |
| DSC-04 | [FE] 가입·신청 화면의 디스코드 연동 창 실제 연결 | 화면·기능 ①②③ — `ApplyDiscordGate` · `ApplyButton` · `ApplyDialog` 별명 기본값 + (DSC-03) 가입 화면의 선택 연동. 프론트 담당에게 넘겨도 된다. **신청 연동 창 연결은 머지됨 (#292)** · OAuth 팝업은 10-27 PR — 가입 화면(DSC-03)은 남음. 운영·stage 에 client id · 시크릿 · Redirects 를 넣어야 켜진다 | DSC-01 · DSC-02 | CLEO525 (#292) |
| DSC-05 | [BE] `DiscordBotClient` 에 role 부여·회수 메서드 추가 | B2. 메서드 4개 + `DISCORD_BOT_ID` 설정. **머지됨 ([PR #276](https://github.com/StudyClub-PlusPlus/studyclub-engineering/pull/276))** (채널 목록·메시지 메서드까지 들어 있다) | — | j7hwang (#276) · 리뷰 doxxx93 |
| DSC-06 | [BOT] 네비게이터 role 창구에 시스템 호출 허용 | 질문 5. **10-24 결정됨 — DSC-13 에 합친다** (봇 API 권한 체크를 모두 지운다). 백오피스 출석부의 담당 캡틴 중단(#325)도 이걸로 navigator role 을 회수한다 | — | j7hwang |
| DSC-07 | [BE] 크루 편입 시 스터디 role 부여 | B3. `study_participant.joined` 구독자. **머지됨 (#316)** — `StudyRoleSyncListener` (DSC-09 와 같은 구독자, 명부에 있으면 붙이고 없으면 뗀다) | DSC-05 · STD-02 | doxxx93 · j7hwang |
| DSC-08 | [BE] 네비게이터 지정·해제 시 네비게이터 role 부여·회수 | B4. `study_participant.role_changed`(`previousRole` · `newRole`, #303) 구독자. **완료 조건: 회수는 그 사람이 다른 진행 중 스터디 어디에서도 활성 `LEADER` 가 아닐 때만** (네비게이터 role 은 길드에 하나). 발행 쪽(STD-03)은 됨 | DSC-05 ✅ · DSC-13 · STD-03 ✅ — 10-24: 회수 조건은 백엔드가 따진다, 봇은 시스템 아이디로 부르면 뗀다 | doxxx93 · j7hwang |
| DSC-09 | [BE] 참여 중단 시 스터디 role 회수 | B5. `study_participant.withdrawn` 구독자 · 네비게이터였으면 **DSC-08 과 같은 완료 조건**으로 네비게이터 role 도 (그 부분만 DSC-13 뒤). **스터디 role 회수는 머지됨 (#315)** — 백오피스 출석부 중단(#325)도 같은 이벤트라 따로 할 것 없다 | DSC-05 · STD-04 | doxxx93 · j7hwang |
| DSC-11 | [BE·BOT] 연동 때 길드 자동 가입 (`guilds.join`) | 자동 가입을 하기로 하면. 봇 토큰을 백엔드에 줄지 / 봇에 창구를 만들지 먼저 정한다 | DSC-01 · 질문 2 | j7hwang |
| DSC-12 | [인프라] stage·운영에 `DISCORD_BOT_ID` 시크릿 추가 | #276 이 읽는 `discord.bot-id`. 값은 내부 시크릿 저장소에만 | #276 | 인프라 담당 (민정님 · 준희님) |
| DSC-13 | [BOT] 🆕 봇 API 권한 체크 제거 · 「시스템 아이디」 용어 | 10-24 회의. 권한은 백엔드가 본다(SSOT). `X-Discord-User-ID` 는 그대로 받되 디스코드 메시지 보낸 사람 용도로만 쓴다. DSC-06 을 포함한다. 봇 문서 `common-header.md` 「시스템 호출」도 고친다 | — | 디스코드 스쿼드 |
| DSC-14 | [BOT] 🆕 captain · navigator role 변경을 웹에 알림 | 10-24 회의. 이 두 role 의 인원이 바뀔 때만 보낸다 | 받는 창구 모양 · 웹이 할 일 ([share 10-24](2026-10-24-discord-squad-agreement.md) 물어볼 것 1 · 5) | 디스코드 스쿼드 |
| DSC-15 | [BOT] 🆕 하루 한 번 captain · navigator 전체 명단 보내기 | 10-24 회의. 이미 하루 한 번 도는 모니터링 작업에 얹는다. 하루 늦게 맞는 건 감수한다 | DSC-14 와 같음 | 디스코드 스쿼드 |
| DSC-16 | [BE] 🆕 디스코드 → 웹 role 알림 받는 창구 | DSC-14 · DSC-15 를 받는다. 출석 창구처럼 API 키로 인증. 같은 알림이 두 번 와도 안전하게. **10-26 구현** — `POST /api/discord/role-changes` · `PUT /api/discord/role-members` ([discord-role-sync](../../specs/discord-role-sync/spec.md)). 맞추기는 `DISCORD_ROLE_SYNC_ENFORCE` 를 켜야 한다 (기본 기록만) | 물어볼 것 1 · 5 — 10-26 결정. navigator 되돌리기는 DSC-13(#343) 뒤 | doxxx93 |
| DSC-10 | [BE·FE] 백오피스 스터디 상세에 디스코드 연결 상태 · 「다시 연결」 버튼 | 화면·기능 ④. 상세 응답 필드 + `POST .../discord-link` 버튼. 화면은 프론트 담당 | — | seeunrosypark |

**스터디 스쿼드 — 주문서를 꽂는다**

| ID | 작업명 | 범위 | 선행 | 담당 (제안) |
|---|---|---|---|---|
| STD-01 | [기획] 명부 편입 시점 확정 — 신청 PRD 와 스펙 불일치 해소 | 질문 3. (가)면 신청 스펙 · `STUDY_GROUP_ID` NULL 허용 · [study-group 미결 사항](../../specs/study-group/spec.md)을 같이 고친다 | — | seeunrosypark — 정함 (#296) |
| STD-02 | [BE] 명부 편입 + `study_participant.joined` 발행 | STD-01 에서 정한 시점에 명부 행을 만든다. (가)면 신청 제출 트랜잭션 안에서. **명부 편입은 #296, `joined` 발행은 머지됨 (#310)** | STD-01 · COM-01 | seeunrosypark (#296 · #310) |
| STD-03 | [BE] 반 · 역할 일괄 변경 API + `study_participant.role_changed` 발행 | `PATCH /api/admin/studies/{id}/participants` — 신청자 탭 「저장」 한 번, 하나라도 거절되면 전부 취소. 10-21 에 한 사람씩 API 를 합쳤다 ([study-group](../../specs/study-group/spec.md), [share](2026-10-21-participant-bulk-change.md)). **머지됨 (#303)** — 페이로드 `previousRole` · `newRole`, 감사 로그 `PARTICIPANT_ROLE` | COM-01 | kimjiy9607 (#303) |
| STD-04 | [BE] 참여 중단(`withdrawals[]`) + `study_participant.withdrawn` 발행 | `POST /api/me/studies/{id}/attendances` ([study-participant](../../specs/study-participant/spec.md)). **머지됨 (#297)**. 백오피스 출석부에서 담당 캡틴이 중단시키는 길도 머지됨 (#325, 10-23 제품 결정) | COM-01 | seeunrosypark (#297 · #325) |
| STD-05 | [BE] 🆕 디스코드 연동한 사람만 캡틴으로 올린다 | 10-24 회의. `PATCH /api/admin/users/{accountId}/system-role` 이 캡틴으로 올릴 때 미연동이면 거절. 백오피스 회원 목록 배지 잠금 이유에도 같은 값. [admin-users](../../specs/admin-users/spec.md) 스펙. **10-26 구현 (`DISCORD_LINK_REQUIRED`) — 캡틴은 연결 해제도 막는다** · **10-27 번복 — 연동 없이도 캡틴, 캡틴도 해제 가능 ([share 10-27](2026-10-27-captain-discord-optional.md))** | — | doxxx93 (세은님 대신, 10-26 분배 스레드) |
| STD-06 | [BE] 🆕 디스코드 API 호출 기록 — 스터디 생성 · navigator role 부여 · 회수 | 10-24 회의. COM-04 와 같은 부품에 한 번에 | 기록 형태 ([share 10-24](2026-10-24-discord-squad-agreement.md) 물어볼 것 2) | 스터디 스쿼드 |

**스터디 스쿼드가 하지 않는 것**: 봇 호출, 디스코드 ID 조회, 디스코드 실패 처리. 이벤트를 발행하면 끝이다. 구독자가 없어도 기능은 정상이다.
**디스코드 스쿼드가 하지 않는 것**: 명부·네비게이터·중단 API 와 그 판정. 이벤트가 오면 반영만 한다.

### 순서

```
            지금 시작                         COM-01 합의 후 (동시에)
디스코드    DSC-01 → DSC-02 → DSC-04          DSC-07 · DSC-08 · DSC-09
            DSC-05 · DSC-10                   (질문 답 뒤) DSC-03 · DSC-06
스터디      STD-01 (기획과)                   STD-02 · STD-03 · STD-04
```

**끝났는지 확인하는 법**: 스테이지에서 크루가 연동 → 신청(또는 명부 편입) → 네비게이터 지정 → 해제 → 중단까지 한 번 돌린다.
디스코드에서 그 사람의 role 이 매 단계 맞게 붙었다 떨어지면 끝이다.

## 물어볼 것

각 질문 아래 **제안**은 2026-10-18 기획 쪽 의견이다. 확인할 것은 코드·스펙을 보고 답을 달았다. 팀이 받아들이면 `결정됨` 으로 바꾼다.

1. **디스코드 연동은 언제 받나?** (기획)
   - 지금 화면과 스펙: 신청할 때 연동 창을 띄운다 (`ApplyDiscordGate`). 자동화 목록: 「회원가입 시 확인」
   - **제안: 회원가입 때 받는다.** → DSC-03
   - 함께 정할 것: **이미 가입한 회원**은 연동 없이 가입했다. 그래서 신청할 때의 연동 창(`ApplyDiscordGate`)은 지우지 않고 남겨 둔다. 디스코드를 안 쓰는 사람은 가입할 수 없게 된다.
   - **상태: 신청 때 연동 필수는 결정됨** — 미연동이면 신청 API 가 403 (#298 연동 API · #292 화면). 가입 때도 받을지(DSC-03)는 아직 열려 있다.
   - **결정됨 (기획, 10-23 seeunrosypark)**: 회원가입 때도 연동을 받을 수 있게 한다. 단 **선택**이다 — 건너뛸 수 있다. 신청 때 연동 필수는 그대로다. 그래서 「디스코드를 안 쓰는 사람은 가입할 수 없다」는 위 걱정은 사라진다. → DSC-03 은 「가입 화면에 선택 연동 단계」. **온보딩 담당과 맞출 것** ([share 10-23](2026-10-23-planning-decisions.md))
2. **연동은 어떻게 하고, 연동 확인은 어떻게 하나?** (기획 · 디스코드 스쿼드)
   - **제안: (나) 우리 서버(길드)에 들어와 있어야 한다.**
   - 연동하는 법: 「디스코드로 연결」 버튼 → 디스코드 로그인·동의 화면 → 돌아온 인가 코드를 서버가 받아 디스코드 ID 를 저장한다 (DSC-01).
   - 길드 확인하는 법: **봇을 고치지 않아도 된다.** 동의 화면에서 `guilds.members.read` 권한을 같이 받으면, 서버가 그 사람의 토큰으로 「이 길드의 멤버인가」를 디스코드에 직접 묻는다. 아니면 「서버에 먼저 들어와 주세요」 + 초대 링크를 보여 주고 저장하지 않는다. → 앞에서 B6 으로 적은 봇 새 창구는 **필요 없고** DSC-01 에 들어간다
   - 더 편하게 하려면 `guilds.join` 권한으로 연동하는 순간 길드에 **자동으로 넣을** 수도 있다. 이건 따로 정한다.
   - **답 (디스코드 봇 담당, 10-20)**: 위 확인 방식이 맞다. 봇을 거치지 않고 scope 와 redirect URI 만 맞게 등록하면 된다. **자동 가입도 찬성** — 사이트엔 연동됐는데 길드에서는 못 찾는 일이 없어진다. 단:
     - 자동 가입은 화면 뒤에서 조용히 일어난다. 동의 화면을 안 읽고 누르는 사람도 있으니 **「디스코드 서버에 들어갔어요」를 화면에서 알려 줘야 한다** → COM-03
     - 이미 길드에 있는 사람은 디스코드 응답 코드가 다르다 (새로 들어감 `201` · 이미 있음 `204`). 화면 문구를 둘로 나눈다
   - **추가로 알아둘 것**: 남을 길드에 넣는 디스코드 요청은 **봇 토큰**으로만 보낼 수 있다. 봇 토큰은 지금 봇(`discord/`)에만 있다. 자동 가입을 하면 ① 백엔드에도 봇 토큰을 주거나 ② 봇에 「길드에 넣어 줘」 창구를 하나 만든다. 어느 쪽인지 정해야 한다 → DSC-11
   - **상태: 확인 방식은 결정됨. 자동 가입 여부와 위 ①②는 회의에서 정한다.** (10-23 기획: 아직 회의에서 협의 필요 — 회의 안건 그대로)
   - 연동한 뒤 길드를 나가면 그때는 모른다. role 을 붙일 때 봇이 `NOT_IN_GUILD` 를 돌려주므로 그 로그로 안다.
   - 연동 여부 확인: 화면은 `GET /api/me` 의 `discordLinked` 로 본다 (DSC-02).
3. **신청하면 명부에 바로 들어가나? 스터디 role 은 언제 주나?** (기획 · 스터디 스쿼드)
   - 제안: 신청서 제출하면 명부에 들어가지 않는지 확인
   - **확인 결과: 기획(PRD)은 「들어간다」, 스펙·코드는 「안 들어간다」로 갈려 있다.** [왜 3번](#3-신청서-제출--스터디-role--언제-줄지가-안-정해졌다) 참고. 명부 행에 반이 꼭 있어야 하는데, 반은 신청 뒤에 만들기 때문이다.
   - 반은 이렇게 만든다: 모집 중·후에 캡틴이 **백오피스 신청자 탭 「반 추가」**로 제목만 넣어 만든다 → 신청자를 반에 나눈다 → 일정 탭에서 반의 요일·시각을 정한다 ([반 편성 PRD](../../01-planning/stories/captain-assign-classes/PRD.md)).
   - 고르는 길은 둘이다:
     - **(가) PRD 대로 — 신청 즉시 명부에 넣고, 반은 비워 둔다** (`STUDY_GROUP_ID` 를 NULL 허용으로). 반은 캡틴이 나중에 채운다. 정원 검사가 그대로 맞고, role 도 **제출 때** 줄 수 있다 (자동화 목록과 같다). 반 편성 스펙의 「크루의 반 지정」 API 도 이미 명부 행이 있다고 가정하고 있다
     - (나) 스펙대로 — 반에 배정할 때 명부에 넣는다. 정원을 신청 수로 세도록 바꿔야 하고, role 은 **반 배정 때** 준다
   - **권하는 쪽: (가).** PRD · 정원 규칙 · 반 지정 API · 자동화 목록이 모두 이쪽을 가정하고 있어서 고칠 곳이 가장 적다. 대신 신청 스펙과 `STUDY_PARTICIPANT` 테이블(마이그레이션), 반이 없는 명부 행을 읽는 화면(출석부 등)을 고쳐야 한다. → STD-01
   - **상태: 결정됨 (10-20, #296)** — (가)로 하되 반을 비우지 않고 **기본 반**에 넣는다 (기본 반이 없으면 그때 만든다). `STUDY_GROUP_ID` 는 NOT NULL 그대로. 반을 나누면 캡틴이 옮긴다 ([신청 스펙](../../specs/study-application/spec.md) 신청 제출 · [share 10-18](2026-10-18-roster-on-apply.md)). role 은 제출 때 `study_participant.joined` 로 준다 (#310).
4. **디스코드를 연동하지 않은 캡틴의 네비게이터 지정을 막나?** (기획)
   - 제안: 회원가입 때 연동하면 문제 없지 않나?
   - **답: 새로 가입하는 사람은 그렇다. 하지만 이미 가입한 캡틴은 연동이 없을 수 있다.**
   - **질문 5 를 (가)로 하면 이 질문 자체가 사라진다.** 백엔드가 캡틴 대신 시스템으로 부르므로 캡틴의 디스코드 ID 가 필요 없다.
   - **결정됨 (10-24 회의)**: 질문 5 가 풀려 이 질문은 사라졌다. 게다가 **캡틴은 디스코드 연동이 필수**가 됐다 — 연동한 사람만 캡틴으로 올린다 (STD-05). 이미 캡틴인 미연동자는 [share 10-24](2026-10-24-discord-squad-agreement.md) 물어볼 것 3
5. **네비게이터도 role 을 회수할 수 있게 고칠까?** (기획 · 디스코드 스쿼드)
   - 제안: 기획상 네비게이터가 크루 참여를 중단시킬 수 있는데, 디스코드 쪽은 캡틴만 role 을 회수할 수 있다.
   - **확인 결과: 절반만 맞다.**
     - 스터디 role 회수(`DELETE /roles/{스터디role}/users`)는 지금도 **시스템 호출이 된다.** 네비게이터가 중단시켜도 백엔드가 시스템으로 회수하면 된다. 고칠 것 없다 (DSC-09)
     - 막히는 건 **네비게이터 role** 창구 두 개다. 이 둘은 captain 만 받는다
   - **권하는 수정: 네비게이터 role 창구에 「네비게이터 호출」이 아니라 「시스템 호출」을 연다** (DSC-06).
     네비게이터에게 직접 열면 네비게이터가 다른 사람의 네비게이터 권한을 떼거나 붙일 수 있다. 시스템으로 열면 「누가 할 수 있나」는 백엔드가 이미 판정한 뒤라 안전하다.
     이렇게 하면 role 부여·회수 **네 창구 모두 시스템 호출**로 통일되고, 질문 4 도 사라진다.
   - **답 (디스코드 봇 담당, 10-20)**: 크루를 중단시키며 스터디 role 회수 → 지금 가능. 네비게이터 창구는 네비게이터 role 전용이라 캡틴으로 한정했다. 다만 스터디 정리(지금은 손으로) 때 시스템이 뗄 수 있어야 할 것 같다 — **회의에서 자세히 정하자.**
   - ~~**상태: 회의 안건.** 정해질 때까지 DSC-06 · DSC-08 은 보류다.~~ DSC-09 의 스터디 role 회수는 머지됐다 (#315).
   - **결정됨 (10-24 회의)**: 권한 확인은 백엔드에서 한다(SSOT). **봇은 API 권한 체크를 지우고 시킨 동작만 한다** (DSC-13 — DSC-06 을 포함). navigator role 창구도 시스템 아이디로 부를 수 있다. `X-Discord-User-ID` 는 그대로 실행한 사람(아니면 시스템 아이디)으로 채운다 — 봇은 메시지 보낸 사람 용도로만 쓴다. → [share 10-24](2026-10-24-discord-squad-agreement.md)
   - 10-23 제품 결정으로 **백오피스 출석부에서 담당 캡틴도 크루 · 네비게이터의 참여를 중단시킨다** (머지됨 #325). 네비게이터 role 회수는 DSC-13 뒤 시스템 아이디로 한다.
6. **`role_changed` 는 어느 API 가 내고, 무엇을 담나?** (스터디 스쿼드 · 디스코드 스쿼드)
   - 문서끼리 다르다 (10-22 확인):
     - beta 에 머지된 [#299](https://github.com/StudyClub-PlusPlus/studyclub-engineering/pull/299) 는 반 · 역할을 **한 번에 바꾸는 일괄 API** `PATCH /api/admin/studies/{id}/participants` 로 정했다 ([study-group](../../specs/study-group/spec.md))
     - 머지되지 않은 `docs/discord-link-timing` 브랜치는 STD-03 을 **한 사람씩** `PATCH …/participants/{pid}/role` 로 적었다
   - 일괄이면 저장 한 번에 **역할이 바뀐 행마다** 1개씩 낸다. 반만 바뀐 행은 내지 않는다 — 스터디 role 은 반이 아니라 스터디 단위라서. 「같은 값이면 안 낸다」가 일괄에서 더 중요해진다
   - 함께 정할 것: 페이로드(`from` · `to` 만인가, `participantRole` 로 맞추나), actor(질문 5 에서 시스템 호출로 정하면 디스코드 쪽에는 필요 없다), 회수 조건(다른 진행 중 스터디 어디에서도 활성 `LEADER` 가 아닐 때만 — DSC-08 완료 조건)
   - 정해지면 STD-03 PR(kimjiy9607)에서 [domain-events](../../specs/domain-events/spec.md) 에 한 줄 추가한다. `joined` · `withdrawn` 과 같은 방식 — 디스코드 스쿼드가 리뷰하면 COM-01 합의다
   - **10-23: 발행 쪽은 #303 으로 머지됐다.** 일괄 API 가 역할이 바뀐 행마다 1개 낸다. 페이로드는 `previousRole` · `newRole` ([domain-events](../../specs/domain-events/spec.md)). 감사 로그 `PARTICIPANT_ROLE` 도 남긴다.
   - 남은 것: 디스코드 스쿼드 확인(이 페이로드로 DSC-08 을 붙일 수 있나) · 회수 조건 — 다른 진행 중 스터디에서 활성 `LEADER` 면 네비게이터 role 을 떼지 않는다.
   - **10-24 회의로 정리됨**: 회수 조건은 **권한 판정이라 백엔드가 따진다** (SSOT). 봇은 떼라면 뗀다. 남은 것은 디스코드 스쿼드의 페이로드 리뷰(COM-01)와 DSC-08 구현이다. 상태는 리뷰 뒤 `결정됨` 으로 바꾼다.

## 영향 — 누가 무엇을 해야 하나

- **기획**: 질문 1 은 결정됨 (10-23 — 가입 때 선택 연동, DSC-03). 온보딩 담당과 화면 · 범위를 맞춘다. 질문 4 · 5 는 10-24 회의로 결정됨. 질문 2 는 아직 회의 안건이다. 10-24 회의에서 새로 생긴 물음(디스코드 → 웹 알림을 받으면 무엇을 하나 · 기록 형태 · 미연동 캡틴)은 [share 10-24](2026-10-24-discord-squad-agreement.md) 에 있다 (COM-02). 질문 3(STD-01)은 결정됨 (#296).
- **제품 (협의 필요)**: 반 이동 때 옛 반 예정 회차의 사전 휴가(`EXCUSED`)를 지우는 지금 스펙 동작([study-group 스펙](../../specs/study-group/spec.md) 반 이동 2)을 유지할지 정한다 ([share 10-23](2026-10-23-planning-decisions.md)).
- **두 스쿼드 공통**: COM-01 이벤트 3개 계약부터 합의한다.
- **회의**: 질문 2 의 자동 가입 여부(DSC-11)를 정한다. 질문 5 · 6 은 10-24 회의로 정리됐다 — 권한은 백엔드, 봇은 동작만 ([share 10-24](2026-10-24-discord-squad-agreement.md)).
- **디스코드 스쿼드**: DSC-01(#298) · DSC-05(#276) · DSC-07(#316) · DSC-09 스터디 role(#315)은 머지됐다. DSC-12 시크릿을 넣고, DSC-10 을 이어 간다. 10-24 회의로 DSC-13(권한 체크 제거 · DSC-06 포함) · DSC-14 · DSC-15 가 생겼다. DSC-08 은 DSC-13 뒤. DSC-03 은 질문 1 결정대로 온보딩 담당과 맞춘다. → [작업 목록](#작업-목록--작업명)
- **스터디 스쿼드**: STD-02(#310) · STD-03(#303) · STD-04(#297) 모두 머지됐다. 백오피스 출석부의 캡틴 참여 중단도 머지됨 (#325, 같은 `withdrawn` 이벤트). 10-24 회의로 STD-05(연동한 사람만 캡틴) · STD-06(호출 기록) · DSC-16(받는 창구, 제안)이 생겼다. → [작업 목록](#작업-목록--작업명)
- **운영**: 스테이지에서 스터디를 만들어도 디스코드 채널이 안 생기는 게 지금은 정상이다. 버그로 올리지 않아도 된다.
