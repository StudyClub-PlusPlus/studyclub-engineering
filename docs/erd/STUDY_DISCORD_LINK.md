# STUDY_DISCORD_LINK — 스터디 ↔ 디스코드 식별자

스터디 하나가 쓰는 디스코드 카테고리·역할 ID. 봇이 아는 건 `DISCORD_STUDY_ID` 뿐이라
그걸 `STUDY.ID` 로 바꾸는 자리가 필요하다.
봇 계약: [discord-development-guide/api/summary.md](../discord-development-guide/api/summary.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_ID | BIGINT FK → STUDY | N | |
| DISCORD_STUDY_ID | VARCHAR(20) | N | 스터디 카테고리 채널의 snowflake. `create-study` 응답 |
| DISCORD_ROLE_ID | VARCHAR(20) | N | 스터디 전용 역할의 snowflake. `create-study` 응답 |

snowflake 는 **문자열**이다 (`^[0-9]{17,20}$`). `BIGINT` 로 받으면 프론트·봇의 JS 정밀도에서 깨진다.

## 관계
- 1 : 0..1 [STUDY](./STUDY.md) — 디스코드를 아직 연결하지 않은 스터디가 정상이다 (행을 만드는 Notion 110 이 미구현)

## 상태
없음. 연결/해제는 행 존재 여부.

## 제약
- `UNIQUE(STUDY_ID)` — 스터디 하나에 디스코드 카테고리 하나
- `UNIQUE(DISCORD_STUDY_ID)` — 카테고리 하나가 두 스터디에 붙지 않는다

## 저장하지 않는 것
- **채널 목록**(`discordChannelId`/`Name`/`Type`) — `get-study-channels` 로 언제든 조회된다.
  저장하면 디스코드에서 채널을 지웠을 때 백엔드만 옛 값을 들고 있게 된다.
- **보이스 채널 ↔ 분반 매핑** — 성립하지 않는다. 반이 여러 개여도 공부방은 보통 하나고, 보이스가
  나뉘어도 봇은 카테고리 ID 하나만 보낸다. 반은 참가자의 명부 소속으로 가른다
  (`specs/discord-attendance/spec.md`).

[STUDY.DISCORD_CHANNEL_URL](./STUDY.md) 과는 역할이 다르다. 그건 사람이 누르는 링크 한 개고
이 테이블은 API 호출용 식별자다.

## 미확정
- 행을 만드는 주체 — 스터디 등록(Notion 110)이 봇의 `create-study` 를 호출하고 응답을 저장하는
  흐름인데, 그 API 가 아직 없다. 현재는 조회만 쓴다.
