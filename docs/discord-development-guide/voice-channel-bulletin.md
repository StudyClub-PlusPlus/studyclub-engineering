# Voice Channel Bulletin (공부방 게시판)

스터디 **음성 채널로 바로 가는 링크 한 줄씩**을 모아 게시판 채널의 **메시지 하나**에 담고,
**매일 미국 태평양 시간 저녁 8시**에 그 메시지를 **갈아치우는** 봇 기능. 기다리기 싫으면
`!updateBulletin` 로 즉시 갱신한다.

> ✅ **구현됨** — [`discord/app/bot/bulletin.py`](../../discord/app/bot/bulletin.py) +
> [`discord/app/bot/commands/bulletin_cmd.py`](../../discord/app/bot/commands/bulletin_cmd.py),
> 테스트는 [`discord/tests/test_bulletin.py`](../../discord/tests/test_bulletin.py) ·
> [`test_bulletin_cmd.py`](../../discord/tests/test_bulletin_cmd.py).
> 이 문서는 **왜 그렇게 만들었는지**의 원본이다 — 코드와 어긋나면 코드를 보고 이 문서를 고친다.
> 길드 권한 설정([길드 쪽 준비](#길드-쪽-준비-게시판-만들기))은 **손으로 해야 하고, 아직 안 됐다.**

## Table of Contents

- [미리 알아야 할 것](#미리-알아야-할-것)
- [왜 필요한가](#왜-필요한가)
- [결과물](#결과물)
- [정해진 것 (리뷰 결과)](#정해진-것-리뷰-결과)
- [설계](#설계)
  - [설정값](#설정값)
  - [어떤 음성 채널을 모으나](#어떤-음성-채널을-모으나)
  - [메시지 포맷](#메시지-포맷)
  - [2000자 한도](#2000자-한도)
  - [메시지를 하나로 유지하는 방법](#메시지를-하나로-유지하는-방법)
  - [언제 돌리나](#언제-돌리나)
  - [손으로 갱신하기 (`!updateBulletin`)](#손으로-갱신하기-updatebulletin)
  - [실패했을 때](#실패했을-때)
  - [길드 쪽 준비 (게시판 만들기)](#길드-쪽-준비-게시판-만들기)
- [구현 단계](#구현-단계)
- [테스트 계획](#테스트-계획)
- [이번에 하지 않는 것](#이번에-하지-않는-것)
- [미정 사항](#미정-사항)

## 미리 알아야 할 것

이 작업을 안 한 사람이 읽는다고 가정한 용어 정리다.

| 용어 | 뜻 |
|------|-----|
| **카테고리(category)** | Discord 사이드바에서 채널들을 묶는 접이식 그룹. 스터디 하나 = 카테고리 하나다 ([create-study](api/create-study.md)) |
| **앵커(anchor) 카테고리** | 이름이 `===== New Study =====` 인 **구분선 역할의 빈 카테고리**. `create_study` 는 새 스터디 카테고리를 **이 바로 아래**에 끼워 넣는다 ([`studies.py`](../../discord/app/api/routes/studies.py) 의 `DEFAULT_NEW_STUDY_ANCHOR_NAME`) |
| **음성 채널(voice channel)** | 공부방. 스터디마다 `공부방-{스터디명}` 으로 하나 생긴다 |
| **채널 멘션** | 메시지에 `<#채널ID>` 라고 쓰면 Discord 가 **채널 이름이 적힌 클릭 가능한 칩**으로 렌더한다. 음성 채널도 된다 — 누르면 그 공부방으로 이동한다 |
| **게시판(bulletin) 채널** | 이 기능이 쓰는 텍스트 채널. **메시지가 항상 딱 하나**고, 봇과 운영진만 쓸 수 있어서 학교 게시판처럼 동작한다 |
| **스냅샷** | 이 기능은 정해진 시각에 길드 상태를 **베껴 적을** 뿐이고, 채널이 생기거나 사라질 때 실시간으로 반응하지 않는다. 그래서 새 공부방은 **다음 저녁 8시**에 게시판에 오른다 — 급하면 `!updateBulletin` |

비유하자면 **학원 입구의 "오늘의 강의실 안내판"** 이다. 누가 안내판을 새로 붙이는 게 아니라,
**매일 저녁 관리인이 와서** **같은 판의 내용만 지우고 다시 쓴다.** 판은 계속 한 장이다.
급한 공지가 있으면 운영진이 관리인을 불러 그때 바로 고쳐 쓰게 할 수도 있다(`!updateBulletin`).

## 왜 필요한가

스터디가 늘면 사이드바가 길어져서 내 공부방을 찾으려면 스크롤을 해야 한다.
게시판 메시지 하나에 전부 모아 두면 **한 화면에서 눌러서 바로 입장**할 수 있다.
그게 이 기능의 전부다 — 알림도, 통계도, 인원 표시도 목적이 아니다.

## 결과물

게시판 채널에 남는 **단 하나의 메시지**. 원문(봇이 보내는 글자):

```
알고리즘 스터디 : <#1327394882193883138> - <#1327394882193883139>
CS 전공 스터디 : <#1327394882193883142>
영어 회화 : <#1327394882193883150>
```

Discord 가 렌더한 모습 (각 칩이 클릭 가능한 링크):

```
알고리즘 스터디 : 🔊 공부방-알고리즘 스터디 - 🔊 공부방-2조
CS 전공 스터디 : 🔊 공부방-CS 전공 스터디
영어 회화 : 🔊 공부방-영어 회화
```

- **한 줄 = 카테고리(스터디) 하나.** 사이드바 순서(position) 그대로다.
- 구분자는 요청대로 `카테고리명 : 링크 - 링크 - ...` 다.
- **음성 채널이 없는 카테고리는 줄을 만들지 않는다** — 누를 게 없는 줄은 안내판을 길게만 만든다.

## 정해진 것 (리뷰 결과)

구현 전에 답이 필요했던 것들. **2026-09-29 리뷰에서 아래로 확정했다** — 구현은 이 표를 따른다.
`왜 이쪽인가` 는 나중에 "왜 저렇게 안 했나" 를 다시 묻지 않기 위한 기록이다.

| # | 질문 | 결정 | 왜 이쪽인가 |
|---|------|------|-------------|
| 1 | 앵커 **아래 끝은 어디**인가? | 앵커 아래부터 **사이드바 맨 끝까지** 전부 | 지금 앵커 아래는 스터디뿐이다. 구분선으로 끊는 규칙은 아직 존재하지 않는 구조를 미리 떠받치는 코드가 된다. 아카이브 구분선을 쓰기로 하면 그때 [미정 사항](#미정-사항) 1 로 다룬다 |
| 2 | 링크를 `<#ID>` 로 쓸까, `[이름](URL)` 로 쓸까? | `<#ID>` | 이름을 **Discord 가 렌더할 때 채워 넣는다** — 채널 이름이 바뀌어도 게시판이 낡지 않는다. `[이름](URL)` 은 이름이 하드코딩돼 rename 하면 다음 저녁 8시까지 틀린 이름이 남는다 |
| 3 | 앵커 카테고리를 **못 찾으면?** | 게시판을 **건드리지 않고** 로그 + alert 채널 통지 | 어제 목록이 남는 건 불편할 뿐이지만, 전체가 날아가거나 앵커 위 운영 카테고리까지 노출되는 건 사고다 |
| 4 | 봇 재시작 직후에도 **한 번 갱신**할까? | 갱신한다 | 같은 메시지를 고치는 멱등 동작이라 부작용이 없고, 배포 검증을 저녁 8시까지 기다리지 않아도 된다 |
| 5 | 게시판에 봇 메시지가 **여러 개** 발견되면? | **가장 오래된 것**을 고치고 나머지는 **손대지 않고** 경고 로그 | 지우는 건 되돌릴 수 없다. 여러 개가 있다는 건 이미 예상 밖 상태라서, 사람이 보고 판단하는 편이 안전하다 |
| 6 | 앵커 이름을 **API 와 봇이 어떻게 공유**하나? | 봇이 `DEFAULT_NEW_STUDY_ANCHOR_NAME` **상수를 직접 읽는다** | 런타임에 바꾸는 명령이 아직 없어 `app.state.new_study_anchor_name` 값과 늘 같다. 공유 홀더는 그 명령을 만들 때 함께 도입한다 — [미정 사항](#미정-사항) 2 에 조건과 함께 남겼다 |
| 7 | 손으로 즉시 갱신하는 수단 | **`!updateBulletin` 명령을 만든다 (captain 전용)** | 2026-09-30 에 추가로 요청됐다. 하루 한 번이면 아침에 만든 스터디가 저녁까지 게시판에 없어서, 봇을 재시작하는 것 말고 갱신할 방법이 필요하다. captain 전용인 이유는 [손으로 갱신하기](#손으로-갱신하기-updatebulletin) |

**"메시지는 정확히 하나" 는 길드 권한 설정으로 지킨다** — 봇은 그걸 강제하지 않고, 자기 메시지를 찾아
고칠 뿐이다 (5번). 권한은 **손으로 설정하기로 했다**: [길드 쪽 준비](#길드-쪽-준비-게시판-만들기) 가 그 체크리스트고,
거기 **Read Message History 가 빠지면 갱신마다 메시지가 하나씩 쌓인다.**

## 설계

### 설정값

기존 채널 설정과 **똑같은 방식**이다 — ID 를 환경변수로 받고, 이름으로 찾지 않는다.

| 환경변수 | 뜻 | 비우면 |
|----------|-----|--------|
| `DISCORD_BULLETIN_CHANNEL_ID` | 게시판으로 쓸 **이미 존재하는** 텍스트 채널 ID | 이 기능이 **아예 안 돈다** (경고 로그 한 줄, 다른 기능은 그대로) |

- [`config.py`](../../discord/app/config.py) 의 `Settings` 에 `bulletin_channel_id: int | None = None` 을 넣고
  `_parse_id(env, "DISCORD_BULLETIN_CHANNEL_ID")` 로 읽는다 — `DISCORD_ALERT_CHANNEL_ID` 와 같다.
  숫자가 아니면 **경고 후 버린다**. 설정이 깨져도 서비스는 뜬다는 기존 원칙 그대로다.
- `.env.example` · `discord/README.md` 에 한 줄씩 추가한다. `docker-compose.yml` 은 `env_file: ./.env` 라서 **고칠 게 없다.**
- 시간대와 갱신 시각(매일 태평양 20:00)은 **환경변수로 빼지 않는다** — 요청에 없었고,
  바꿀 일이 생기면 상수를 고치는 게 더 싸다. 자세한 건 [언제 돌리나](#언제-돌리나).

### 어떤 음성 채널을 모으나

`guild.categories` 는 **position 순으로 정렬돼 있다.** 그래서:

1. 이름이 앵커와 같은 카테고리를 찾는다. 같은 이름이 여러 개면 **맨 위**가 앵커다
   (`create_study` 가 `discord.utils.get` 으로 고르는 방식과 동일 — 두 기능이 같은 카테고리를 기준으로 삼아야 한다).
2. 앵커를 **못 찾으면 중단**한다 (결정 3).
3. 앵커 **다음 인덱스부터 끝까지**의 카테고리를 순서대로 훑는다 (결정 1).
4. 각 카테고리의 `voice_channels` 중 **봇이 볼 수 있는 것만** 싣는다
   (`c.permissions_for(guild.me).view_channel`) — `get_study_channels` 와 같은 필터다.
   봇이 못 보는 채널은 링크가 깨진 칩으로 렌더되니 안내판에 올리지 않는다.

**앵커 자신은 포함하지 않는다.** 앵커는 구분선이고 음성 채널도 없다.

### 메시지 포맷

순수 함수 하나로 만든다 — Discord 연결 없이 테스트할 수 있게 (`test_cmd.build_test_response` 와 같은 패턴):

```python
def build_bulletin(categories: list[tuple[str, list[int]]]) -> str:
    """(카테고리명, 음성채널ID들) 목록을 게시판 본문으로 만든다."""
```

- 줄: `f"{name} : " + " - ".join(f"<#{cid}>" for cid in voice_ids)`
- **음성 채널이 없는 카테고리는 건너뛴다.**
- 실을 줄이 하나도 없으면 "지금 열린 공부방이 없습니다" 같은 **한 줄 안내문**을 쓴다.
  빈 메시지는 Discord 가 거부하고, 예전 목록을 그대로 남기면 없어진 방을 누르게 된다.
- **@everyone·@here 처리는 불필요하다** — 본문은 봇이 카테고리 이름과 ID 로만 만든다.
  그래도 보내고 고칠 때 `allowed_mentions=discord.AllowedMentions.none()` 을 건다:
  카테고리 이름에 `@everyone` 을 넣어 두면 길드 전체에 알림이 갈 수 있다. 게시판은 **아무도 울리지 않아야 한다.**

### 2000자 한도

Discord 메시지는 2000자다. 한 줄은 대략 `카테고리명 + (22자 × 공부방 수)` 이므로,
스터디가 **50~60개를 넘어가면** 한도에 닿는다. 그때:

- **줄 단위로 넣다가 넘치면 멈추고**, 마지막에 `…외 N개는 사이드바에서 확인해 주세요` 한 줄을 붙인다.
- 잘렸다는 사실을 **로그와 alert 채널에 알린다** — 조용히 잘리면 자기 스터디가 빠진 사람만 알게 된다.
- 줄 중간에서 자르지 않는다. 끊긴 링크는 안 보이는 것보다 나쁘다.

> 대안: 임베드(embed)를 쓰면 본문 한도가 4096자로 늘어난다. 지금 규모에선 **평문이 더 단순**해서
> 평문으로 가고, 한도에 실제로 닿으면 임베드로 옮긴다.

### 메시지를 하나로 유지하는 방법

**봇은 "메시지가 하나"를 강제하지 않는다.** 그건 [길드 권한 설정](#길드-쪽-준비-게시판-만들기)이 하는 일이다.
봇은 **자기가 쓴 메시지를 찾아 고칠 뿐**이다:

1. `channel.history(limit=50, oldest_first=True)` 로 훑어 `m.author.id == bot.user.id` 인 첫 메시지를 찾는다.
2. 있으면 `await message.edit(...)`, 없으면 `await channel.send(...)`.
3. 봇 메시지가 둘 이상이면 **가장 오래된 것만 고치고 경고 로그**를 남긴다 (결정 5).

**메시지 ID 를 저장하지 않는 이유**: SQLite(`data/discord.sqlite3`)에 넣을 수도 있지만,
게시판은 권한상 메시지가 몇 개 안 되므로 **매번 찾는 비용이 사실상 0** 이고,
저장하면 볼륨이 날아가거나 사람이 메시지를 지웠을 때 **ID 가 썩는다.**
찾아서 고치는 쪽은 그런 상태가 없다. 대신 봇에게 **Read Message History 권한이 필요하다.**

### 언제 돌리나

**매일 태평양 시간 20:00** 한 번이다. `discord.ext.tasks` 의 시각 기반 루프를 쓴다 —
외부 스케줄러도, 새 라이브러리도 필요 없다 (`discord.py==2.4.0` 에 있다):

```python
# 20:00 America/Los_Angeles, 매일. "24시간 간격"이 아니라 "이 시각"으로 적는 이유는
# 아래 「간격이 아니라 시각」 참고. tasks.loop 이 다음 발생 시각을 매번 다시 계산하므로
# PST/PDT 전환은 저절로 맞는다 -- 어느 쪽이든 현지 20:00 이고, 그게 요청받은 것이다.
BULLETIN_TIME = datetime.time(hour=20, tzinfo=ZoneInfo("America/Los_Angeles"))

@tasks.loop(time=BULLETIN_TIME)
async def refresh_bulletin() -> None: ...

@refresh_bulletin.before_loop
async def prime_the_board() -> None:
    await bot.wait_until_ready()   # 준비되기 전엔 길드 캐시가 비어 있다
    await refresh(bot, settings)   # 결정 4 -- 재시작 직후 한 번
```

**간격이 아니라 시각을 넘긴다** — `tasks.loop(hours=24)` 는 **봇이 켜진 순간부터** 24시간을 센다.
그러면 갱신 시각이 배포할 때마다 달라지고 "저녁 8시" 라는 기준이 사라진다. 시각은 **벽시계에
고정**되므로 봇을 언제 재시작해도 20:00 그대로다.

- **tzdata**: `python:3.12-slim` 에 `zoneinfo` 가 `America/Los_Angeles` 를 찾는 것을 컨테이너에서 확인했다 —
  **`requirements.txt` 에 추가할 의존성이 없다.**
- **DST**: **태평양 현지 벽시계 20:00** 이다 (요청대로 PST/PDT 구분 없음). UTC 로는 03:00/04:00 을 오간다.
- `tasks.loop(time=...)` 은 **시작 즉시 돌지 않고 다음 20:00 까지 잔다.** 그래서 결정 4대로
  `before_loop` 에서 준비를 기다린 뒤 **한 번 즉시 갱신**하고 루프를 잇는다.
- 루프는 `client.py` 의 `create_bot` 에서 등록하고, **`bot.setup_hook` 에서 시작한다.**
  `DISCORD_BULLETIN_CHANNEL_ID` 가 없으면 **시작하지 않고 경고 로그**만 남긴다.
  **`create_bot` 안에서 바로 `start()` 하면 안 된다** — 구현 중 실제로 밟은 함정이다.
  `create_bot` 은 `bot.start()` **전에** 불리는데, 루프가 가장 먼저 하는 `wait_until_ready()` 는
  아직 로그인하지 않은 클라이언트에서 **`RuntimeError` 를 던진다.** 그러면 `before_loop` 에서 루프가
  죽고 **프로세스가 사는 동안 다시 안 돈다** — 게시판이 조용히 안 갱신되는 가장 나쁜 실패다.
  `on_ready` 도 안 된다: 재접속마다 다시 불려서 루프를 두 번 시작한다.
  기존 `setup_hook` 이 있으면 **덮지 않고 이어 붙인다** (덮으면 그쪽 일이 조용히 사라진다).
- **`reconnect=True`(기본)** 로 둔다 — Discord 쪽 일시 오류로 루프가 죽어 그 뒤로 조용히 멈추는 걸 막는다.
- 갱신 시각은 **환경변수로 빼지 않는다** ([설정값](#설정값)) — 바뀌면 `BULLETIN_TIME` 을 고친다.

### 손으로 갱신하기 (`!updateBulletin`)

하루 한 번이면 **아침에 만든 스터디가 저녁 8시까지 게시판에 없다.** 그래서 즉시 갱신하는 봇 명령을 둔다.
기존 `!testCmd` 와 같은 자리(`app/bot/commands/`)에 같은 모양(`register(bot, settings)`)으로 만든다.

```
!updateBulletin
→ 공부방 게시판을 갱신했습니다.
→ 공부방 게시판을 갱신하지 못했습니다. alert 채널과 로그를 확인해 주세요.
```

- **captain 전용이다.** 이 서비스의 다른 모든 쓰기 동작과 같은 기준이고
  ([`create-study`](api/create-study.md) · [`send-alert-message`](api/send-alert-message.md)),
  갱신 한 번이 **히스토리 읽기 + 메시지 수정**으로 Discord rate limit 을 쓴다. 게시판은 전원이 보는 물건이라
  아무나 다시 쓰게 두지 않는다. navigator 까지 허용하려면 `may_update` 를 넓히면 된다.
- `DISCORD_CAPTAIN_ROLE_ID` 가 **비어 있으면 거부**한다 — API 쪽 `caller_guild` 와 같은 태도로, 설정이
  없다는 게 문 열림을 뜻하지 않는다. DM 에서는 멤버도 역할도 없으니 역시 거부다.
- `DISCORD_BULLETIN_CHANNEL_ID` 가 없으면 **기능이 꺼져 있다고 답장**한다. 그 경우 `refresh` 는 로그만
  남기고 끝나서, 답장이 없으면 부른 사람은 갱신된 줄 안다.
- **성공/실패를 답장한다.** 그래서 `refresh` 가 `bool` 을 돌려준다 — 실패 이유는 이미 로그와 alert 채널에
  가 있으므로, 답장은 어느 쪽인지와 어디를 볼지만 알린다. 잘려서 올라간 경우는 **성공**이다 (올라갔으니까).
- **연타 제한(cooldown)은 두지 않는다** — captain 만 쓸 수 있어서 남용될 통로가 아니다.

### 실패했을 때

게시판 갱신은 **아무도 기다리지 않는 백그라운드 작업**이다. 그래서 어떤 실패도 프로세스를 죽이지 않고,
대신 **보이게** 만든다 — 기존 `warn_mention_everyone_missing` 과 같은 태도다.

| 상황 | 하는 일 |
|------|---------|
| `DISCORD_BULLETIN_CHANNEL_ID` 없음 | 시작 시 경고 로그 1회, 루프 미시작 |
| 채널을 못 찾음 / 봇이 못 봄 / 텍스트 채널이 아님 | 에러 로그 + alert 채널 통지, 게시판 **변경 없음** |
| 앵커 카테고리 없음 | 에러 로그 + alert 채널 통지, 게시판 **변경 없음** (결정 3) |
| `Send Messages` · `Read Message History` 권한 없음 (`discord.Forbidden`) | 에러 로그 + alert 채널 통지 — 어떤 권한이 없는지 메시지에 적는다 |
| 2000자 초과로 잘림 | 잘린 목록을 올리고 **경고 로그 + alert 채널 통지** |
| 그 밖의 예외 | `logger.exception` 으로 삼켜서 **다음 날에도 루프가 계속 돌게 한다** |

alert 채널 통지는 [`channels.py`](../../discord/app/api/routes/channels.py) 의 `resolve_configured_channel` 을
재사용한다. **통지 자체가 실패해도 삼킨다** — 알림 실패가 본 작업을 무너뜨리면 안 된다.

### 길드 쪽 준비 (게시판 만들기)

**코드가 아니라 사람이 Discord 에서 하는 설정**이다. 이게 돼 있어야 "메시지 하나뿐인 게시판" 이 성립한다.

1. 텍스트 채널 하나를 만든다 (예: `📌공부방-바로가기`).
2. `@everyone` 권한: **View Channel ✅ / Send Messages ❌ / Add Reactions ❌(선택)**
   → 일반 멤버는 **읽기만** 한다. 그래서 메시지가 하나로 유지된다.
3. 운영진(captain) 역할: **Send Messages ✅** (요청대로 moderator 는 쓸 수 있다).
4. **봇**: **View Channel ✅ / Send Messages ✅ / Read Message History ✅**
   → 마지막 것이 없으면 봇이 자기 메시지를 못 찾아 **매번 새로 보내서 메시지가 쌓인다.**
5. 그 채널 ID 를 `DISCORD_BULLETIN_CHANNEL_ID` 에 넣고 **컨테이너를 재생성**한다
   (설정은 기동 시점에 읽는다 — `DISCORD_BOT_CHANNEL_ID` 과 같다).

## 구현 단계

각 단계는 **혼자 검증 가능한 것**까지 묶었다. `cd discord && .venv/bin/pytest` 가 공통 확인 수단이다.

```
1. config: Settings.bulletin_channel_id + _parse_id 한 줄
   → verify: tests/test_config.py 에 "설정됨 / 비어 있음 / 숫자 아님" 3케이스, pytest 통과

2. app/bot/bulletin.py — 순수 함수 build_bulletin(categories) -> str
   → verify: 정상 / 음성채널 없는 카테고리 스킵 / 전부 비었을 때 안내문 / 2000자 초과 절단,
             Discord 없이 단위 테스트로 전부 통과

3. 같은 파일 — collect_categories(guild, anchor_name) : 앵커 아래 카테고리 + 보이는 음성채널
   → verify: FakeGuild(test_study_channels.py 패턴)로 앵커 위 제외 · 앵커 없음 · 안 보이는 채널 제외

4. 같은 파일 — refresh(bot, settings, anchor_name) : 채널 해석 → 자기 메시지 찾기 → edit/send
   → verify: 기존 메시지 있으면 edit 호출 / 없으면 send 호출 / 봇 메시지 2개면 가장 오래된 것 edit + 경고,
             Forbidden·채널 없음에서 예외가 새어 나오지 않는지

5. 같은 파일 — register(bot, settings) : tasks.loop(time=BULLETIN_TIME) 등록 + setup_hook 시작 + 최초 1회 갱신
   → verify: 채널 ID 없으면 루프 미시작, 있으면 시작.
             loop.time 이 20:00 America/Los_Angeles 인지 단정

6. client.py 에 bulletin.register(bot, settings) 한 줄
   → verify: 전체 pytest 통과 (기존 테스트 무회귀)

7. app/bot/commands/bulletin_cmd.py — may_update(captain 검사) + update_bulletin(답장) + register
   → verify: captain 통과 / 비captain·DM·역할 미설정 거부 / 성공·실패 답장 /
             권한 없을 때 refresh 를 아예 부르지 않음. client.py 에 register 한 줄

8. .env.example · discord/README.md 갱신, 이 문서의 "구현 안 됐다" 배너를 "구현됨" 으로
   → verify: 문서에서 DISCORD_BULLETIN_CHANNEL_ID 를 grep 하면 3곳에 나온다.
             api/summary.md 는 **고치지 않는다** — 엔드포인트가 아니라 봇 루프다

9. 실제 길드에서 손으로 확인 (위 "길드 쪽 준비" 를 끝낸 뒤)
   → verify: 봇 재시작 → 게시판에 메시지 1개, 링크를 누르면 공부방으로 들어간다.
             `!updateBulletin` → 같은 메시지가 고쳐지고 "갱신했습니다" 답장이 온다.
             captain 아닌 계정으로 `!updateBulletin` → 거부 답장, 게시판은 그대로
```

**9번은 사람이 해야 하는 단계다** — 봇 토큰과 길드 권한이 필요해서 CI 나 에이전트가 대신할 수 없다.

## 테스트 계획

기존 테스트 관례를 따른다 (`unittest.mock` 의 `Mock`/`AsyncMock` + `FakeGuild`, 실제 Discord 연결 없음).
새 파일 `discord/tests/test_bulletin.py` · `discord/tests/test_bulletin_cmd.py`.

| 무엇 | 확인하는 것 |
|------|-------------|
| `build_bulletin` | 포맷(`이름 : <#a> - <#b>`) · 음성채널 없는 카테고리 스킵 · 전부 빔 · 2000자 절단 + 안내 줄 |
| `collect_categories` | 앵커 위 카테고리 제외 · 순서 유지 · 앵커 없으면 실패 신호 · 봇이 못 보는 음성채널 제외 |
| `refresh` | 기존 봇 메시지 edit · 없으면 send · 봇 메시지 여러 개면 가장 오래된 것 · 남의 메시지는 안 건드림 |
| `refresh` 실패 경로 | 채널 미설정/미존재/텍스트 아님/`Forbidden` 에서 **예외를 던지지 않고** alert 통지 |
| `register` | 채널 ID 없으면 루프 미시작 · `setup_hook` 이 불릴 때 시작(그 전엔 아님) · 기존 `setup_hook` 도 여전히 불림 · 루프 시각이 20:00 `America/Los_Angeles` |
| `may_update` | captain 통과 · 역할 없는 멤버 거부 · `DISCORD_CAPTAIN_ROLE_ID` 미설정 시 거부 · DM 거부 |
| `update_bulletin` | 성공/실패에 맞는 답장 · 권한 없으면 `refresh` 를 아예 부르지 않음 · 채널 미설정이면 꺼져 있다고 답장 |

**하지 않는 테스트**: 실제로 저녁 8시까지 기다리는 테스트. 시각은 `loop.time` 값을 단정하는 것으로
갈음한다 (`discord.py` 가 `time` 을 목록으로 정규화하므로 `[20:00]` 과 비교한다).

## 이번에 하지 않는 것

요청 범위 밖이라 **의도적으로 빼는** 것들. 필요해지면 별건으로 올린다.

- 갱신을 부르는 **HTTP 엔드포인트** — 백엔드가 게시판을 갱신할 이유는 아직 없다 (봇 명령만 있다)
- 채널이 생기거나 지워질 때 **실시간** 갱신 (`on_guild_channel_create` 등) — 하루 한 번 + `!updateBulletin` 이면 충분하다
- 공부방 **현재 접속 인원** 표시
- 텍스트 채널(`로비-*`) 링크 — 요청은 음성 채널이다
- 갱신 시각·시간대·메시지 문구의 환경변수화
- `!updateBulletin` 의 연타 제한(cooldown) — captain 만 쓸 수 있어서 남용될 통로가 아니다
- 게시판에 사람이 남긴 메시지를 **봇이 지우는** 것 (권한 설정으로 막는 쪽이 안전하다)

## 미정 사항

| # | 미정 | 지금은 |
|---|------|--------|
| 1 | 앵커 아래에 **구분선 카테고리**(아카이브 등)를 쓸 계획이 생기면 | 앵커 아래 전부를 스터디로 본다 (결정 1). 구분선을 쓰기로 하면 `collect_categories` 의 종료 조건 한 줄이 바뀐다 |
| 2 | 앵커 이름을 **런타임에 바꾸는 명령**([`studies.py`](../../discord/app/api/routes/studies.py) 주석의 계획)이 생기면 | 봇은 상수를 읽으므로 **그때 갈라진다.** 그 명령을 만들 때 `app.state.new_study_anchor_name` 과 봇이 **한 출처를 공유하도록** 반드시 함께 고쳐야 한다 (결정 6) |
| 3 | 게시판 채널 이름·위치, 운영진 역할이 `DISCORD_CAPTAIN_ROLE_ID` 와 같은지 | 길드 담당자가 정한다. 봇은 **ID 만** 본다 |
| 4 | 스터디가 50개를 넘어 2000자에 닿을 시점 | 평문 + 절단으로 버티고, 닿으면 임베드로 옮긴다 |
