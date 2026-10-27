---
상태: 결정됨
물어볼 사람: 백엔드 · 디스코드 스쿼드
반영:
  - .env.example · docker-compose.yml · backend application.yml — 됨 (이 PR)
  - discord/ (코드 · 테스트 · README) — 됨 (이 PR)
  - docs/discord-development-guide/ · specs/ (discord-study-link · discord-role-sync · study-application) — 됨 (이 PR)
  - stage · 운영 서버의 환경 변수 — 안 됨 (배포 전에 담당자가 바꾼다)
---

# 디스코드 서버 ID 설정 9개의 이름 앞에 `DISCORD_CONFIG_` 를 붙인다

## 미리 알아야 할 것

- **환경 변수**: 프로그램이 켜질 때 읽는 설정값이다. 로컬에서는 레포 루트의 `.env` 파일에 `이름=값` 으로 적는다.
  봇 컨테이너와 백엔드는 이 파일을 함께 읽는다.
- **디스코드 ID**: 디스코드 서버 · 채널 · 역할(role)마다 붙는 긴 숫자다. 봇은 "어느 채널에 알림을 보낼지",
  "누가 captain 인지" 를 이 숫자로 안다.
- **시크릿**: 봇 로그인 토큰(`DISCORD_TOKEN`), 서비스 열쇠(`DISCORD_API_KEY`), OAuth 비밀값처럼 밖에 보이면 안 되는 값이다.

## 한 줄 요약

디스코드 서버 · 채널 · 역할 · 봇 **ID 설정 9개**의 이름이 `DISCORD_` → `DISCORD_CONFIG_` 로 바뀐다. **`.env` 를 고쳐야 한다.**

## 왜 — 지금 뭐가 문제인가

`.env` 에는 `DISCORD_` 로 시작하는 값이 열여섯 개 넘게 있다. 그중 일부는 시크릿이고, 일부는 보여도 되는 ID 다.
이름만 봐서는 어느 쪽인지 알 수 없다.

곧 captain 이 디스코드에서 `!config print` 로 봇의 현재 설정을 볼 수 있게 한다. 이때 "무엇을 보여줘도 되나" 를
이름으로 가를 수 있어야 한다. 비유하면, 서류함 칸마다 "공개" 딱지를 붙여 두는 것이다. 딱지가 붙은 칸만 꺼내 보여준다.

## 정해진 것

| 예전 이름 | 새 이름 |
|---|---|
| `DISCORD_GUILD_ID` | `DISCORD_CONFIG_GUILD_ID` |
| `DISCORD_BOT_CHANNEL_ID` | `DISCORD_CONFIG_BOT_CHANNEL_ID` |
| `DISCORD_CAPTAIN_ROLE_ID` | `DISCORD_CONFIG_CAPTAIN_ROLE_ID` |
| `DISCORD_NAVIGATOR_ROLE_ID` | `DISCORD_CONFIG_NAVIGATOR_ROLE_ID` |
| `DISCORD_ALERT_CHANNEL_ID` | `DISCORD_CONFIG_ALERT_CHANNEL_ID` |
| `DISCORD_ANNOUNCEMENT_CHANNEL_ID` | `DISCORD_CONFIG_ANNOUNCEMENT_CHANNEL_ID` |
| `DISCORD_BULLETIN_CHANNEL_ID` | `DISCORD_CONFIG_BULLETIN_CHANNEL_ID` |
| `DISCORD_ANCHOR_CHANNEL_ID` | `DISCORD_CONFIG_ANCHOR_CHANNEL_ID` |
| `DISCORD_BOT_ID` | `DISCORD_CONFIG_BOT_ID` — 봇 자신의 유저 ID. 서버에서 누구나 볼 수 있는 값이라 숨길 이유가 없다 |

- **규칙: `DISCORD_CONFIG_` 는 보여줘도 되는 ID 에만 붙인다.** 시크릿 · URL 에는 절대 붙이지 않는다.
- 백엔드도 `DISCORD_CONFIG_GUILD_ID` 를 읽는다. 같은 값을 두 이름으로 두지 않는다.
  `DISCORD_CONFIG_BOT_ID` 는 백엔드만 읽는다.
- 예전 이름은 **더 이상 읽지 않는다.** 예전 이름만 있으면 그 설정은 비어 있는 것과 같다.
  예를 들어 봇은 모든 명령을 거절하고, 게시판은 멈춘다.

## 영향 — 누가 무엇을 해야 하나

- **로컬에서 개발하는 사람**: `.env` 에서 위 9개의 이름을 바꾸고 `docker compose up -d discord api` 로 다시 띄운다.
- **stage · 운영 담당자**: 이 변경이 배포되기 **전에** 새 이름을 서버 환경 변수에 추가한다 (봇과 백엔드 둘 다).
  배포가 끝나면 예전 이름을 지운다.
- **새 디스코드 ID 설정을 만드는 사람**: 이름을 `DISCORD_CONFIG_..._ID` 로 짓는다.
