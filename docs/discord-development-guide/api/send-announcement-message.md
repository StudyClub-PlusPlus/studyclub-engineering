# Send Announcement Message

**announcement 채널**에 메시지 하나를 올린다. 길드 전체에 알릴 공지 용도라 **맨 위에 `@everyone` 을 붙여
모두에게 알림을 울린다.** [`send-alert-message`](send-alert-message.md) 와 모양이 같고, **다른 곳만**
[아래](#send-alert-message-와-다른-점)에 모아 적는다.

> ⚠️ **아직 구현 전이다.** 이 문서는 구현할 계약이다.
> 공통 요청 헤더는 [`common-header.md`](common-header.md) 를 따른다.
> **대상 길드는 하나로 고정**이라 요청에 길드를 넘기지 않는다.

## Table of Contents

- [요청](#요청)
  - [올리는 메시지](#올리는-메시지)
- [성공 응답](#성공-응답)
- [실패 응답](#실패-응답)
- [중복 전송과 재시도](#중복-전송과-재시도)
- [send-alert-message 와 다른 점](#send-alert-message-와-다른-점)
- [미정 사항](#미정-사항)

## 요청

```
POST /api/v1/channels/announcement/msg
```

헤더는 [공통 헤더](common-header.md) 전부 — `Idempotency-Key` 는 **필수**다
(메시지 전송은 되돌릴 수 없고, 재시도가 길드 전체에 `@everyone` 알림을 두 번 울리면 안 된다).

**captain 역할을 가진 멤버만 호출할 수 있다.** [`create-study`](create-study.md#요청) ·
[`assign-role`](assign-role.md#요청) 과 같은 규칙이다 — 봇이 `X-Discord-User-ID` 로 길드 멤버를 조회해
captain 역할 보유 여부를 확인하고, 없으면 **403** 이다. navigator 는 호출할 수 없다
([`send-alert-message`](send-alert-message.md#요청) 와 다르다).

captain 역할과 announcement 채널은 둘 다 길드에 **이미 존재하는** 것이다. 이 엔드포인트는 어느 것도
만들지 않고, 찾지 못하면 보내지 말고 실패한다. 둘 다 **설정값으로 ID 를 받는다**
(예: `DISCORD_CAPTAIN_ROLE_ID` · `DISCORD_ANNOUNCEMENT_CHANNEL_ID`) — 이름으로 찾지 않는다.
`DISCORD_BOT_OUTPUT_CHANNEL` 과 같은 방식이다.

```jsonc
{ "msg": "알고리즘 스터디 2기 모집을 시작합니다. 신청은 이번 주 금요일까지입니다." }
```

| 필드 | 타입 | 필수 | 제약 |
|------|------|------|------|
| `msg` | string | O | 1–1990자, 공백만으로 이루어지면 안 된다. Discord 메시지 한도(2000자)에서 [`@everyone` 줄](#올리는-메시지) 몫(`@everyone\n`, 10자)을 뺀 값이다 |

### 올리는 메시지

봇은 받은 `msg` 를 아래 순서로 가공한 뒤 올린다.

1. **`msg` 안의 `@everyone` · `@here` 를 지운다.** 지운 자리에서 새로 생길 수 있으므로
   (`@every@hereone` → `@everyone`) 더 이상 남지 않을 때까지 반복한다. 전체 알림은 봇이 붙이는
   맨 위 한 줄로만 울린다.
2. **지운 결과가 비었거나 공백만 남으면 400** 이다. 보내지 않는다.
3. **맨 위에 `@everyone` 줄을 붙인다.** 발신자는 붙이지 않는다 — 공지는 개인이 아니라 운영진 이름으로 나간다.

```
@everyone
알고리즘 스터디 2기 모집을 시작합니다. 신청은 이번 주 금요일까지입니다.
```

**전송은 `AllowedMentions(everyone=True, users=False, roles=False)` 로 한다** — `@everyone` 만 알림을 울린다.

- `msg` 안의 역할 · 유저 멘션은 글자로만 보이고 알림은 없다.
- `@everyone` 을 허용하므로 1번이 유일한 방어선이다. 1번을 빠뜨리면 `msg` 안의 `@here` 가 그대로 울린다 —
  테스트로 고정한다.

## 성공 응답

**204 No Content** — 바디가 없다.

**204 는 "announcement 채널에 이 메시지가 [가공된 모양](#올리는-메시지)으로 올라가 있다" 는 뜻이다.**
`@everyone` 알림이 실제로 울렸다는 보장은 아니다 — 봇에게 `Mention Everyone` 권한이 없으면 알림 없이 올라가고
그래도 204 다 ([아래](#mention-everyone-권한이-없을-때) 참고).
`msg` 에서 `@everyone` · `@here` 를 지웠더라도 204 다 — 호출자에게 따로 알리지 않는다.
같은 `Idempotency-Key` 의 재시도에도 새로 보내지 않고 204 를 그대로 돌려준다 ([아래](#중복-전송과-재시도) 참고).

생성된 **메시지 ID 는 응답에 넣지 않는다.** 호출자가 공지를 수정·삭제할 일이 생기면 그때 추가한다.

## 실패 응답

에러 바디는 현재 FastAPI 기본형 `{"detail": "..."}` 이다
(BE 의 `{errorCode, errorMessage}` 와 다르다 — [미정 사항](#미정-사항) 참고).

### 공통 헤더에서 나는 것

| 상태 | 언제 |
|------|------|
| **400** | `X-Discord-User-ID` 가 없거나 snowflake 형식이 아님 — 이 엔드포인트는 captain 확인 때문에 필수다 |
| **401** | `X-API-Key` 없음 또는 불일치 |
| **403** | 요청자에게 captain 역할이 없음 |
| **404** | `X-Discord-User-ID` 가 그 길드의 멤버가 아님 |
| **409** | 같은 `Idempotency-Key` 로 다른 바디가 옴 |

### 이 엔드포인트에서 나는 것

| 상태 | 언제 | 원인 |
|------|------|------|
| **400** | `msg` 누락 · 문자열이 아님 · 빈 문자열 · 공백만 있음 | 요청자 잘못. 그대로 재시도해도 실패한다. 빈 공지로 `@everyone` 만 울리게 두지 않는다 |
| **400** | `@everyone` · `@here` 를 지우고 나니 비었거나 공백만 남음 | 위와 같음 |
| **400** | `msg` 가 1990자 초과 | 위와 같음. 잘라서 보내지 않는다 — 공지 뒷부분이 조용히 사라진다. 길이는 **가공 전** 값으로 잰다 |
| **404** | captain 역할을 길드에서 찾지 못함 | 서버·길드 설정 문제(역할이 지워졌거나 잘못 지정됨). 요청자와 무관하므로 403 이 아니다. `detail` 로 다른 404 와 구분한다 |
| **404** | announcement 채널을 봇이 찾지 못함, 또는 그 ID 가 메시지를 올릴 수 있는 채널(텍스트 · 공지 채널)이 아님 | 위와 같은 **서버·길드 설정 문제**다. 채널이 지워졌거나, 봇에게 `View Channel` 권한이 없거나, 카테고리·음성 채널 ID 가 설정됨. `POST /api/v1/ping` 의 채널 404 와 같은 결 |
| **409** | `DISCORD_ANNOUNCEMENT_CHANNEL_ID` 가 설정되지 않음 (또는 숫자가 아니라 시작 시 버려짐) | 서버 설정 문제. `POST /api/v1/ping` 이 `DISCORD_BOT_OUTPUT_CHANNEL` 미설정을 409 로 돌려주는 것과 같은 결. `detail` 로 멱등 키 409 와 구분한다 |
| **502** | Discord 가 전송을 거부 | 봇 권한 부족(announcement 채널의 `Send Messages`), 그 밖의 Discord 5xx |
| **503** | 봇 비활성 또는 아직 미연결 | `DISCORD_TOKEN` 미설정, 또는 기동 직후 `is_ready()` 가 아직 False |

503 · Discord 5xx 502 는 **재시도 가능**하다. 400 · 401 · 403 은 조건이 바뀌기 전에는 재시도해도 같다.
멤버 404 는 그 유저가 길드에 들어오면 통한다.
역할 · 채널 404, 설정 409, 권한 502 는 호출자가 고칠 수 없다 — 길드나 서버 설정을 고쳐야 풀린다.

> **권한 부족 502 는 "가끔" 이 아니라 "항상" 이다.** 채널이 하나로 고정이라, 봇에게 `Send Messages`
> 권한이 없으면 **모든 요청이** 502 로 실패한다. 재시도로는 풀리지 않고 채널 권한을 고쳐야 한다.
> 로그에는 권한 문제임을 남긴다. `Mention Everyone` 권한이 없는 것은 실패가 아니다 — [아래](#mention-everyone-권한이-없을-때) 참고.

> **429 는 밖으로 나가지 않는다.** discord.py 가 레이트 리밋을 내부에서 기다렸다가 재시도하므로,
> 증상은 429 응답이 아니라 **응답이 느려지는 것**으로 나타난다
> ([create-study](create-study.md#이-엔드포인트에서-나는-것) 와 같다).

### Mention Everyone 권한이 없을 때

봇에게 `Mention Everyone` 권한이 없어도 **Discord 는 전송을 거부하지 않는다.** 메시지는 올라가고
`@everyone` 이 글자로만 보일 뿐 알림이 울리지 않는다 — Discord 쪽에서는 에러 없이 조용히 넘어간다.

**공지는 그대로 올리고, alert 채널에 권한이 없다는 메시지를 따로 남긴다.** 응답은 **204** 다.

1. 전송 전에 `channel.permissions_for(guild.me).mention_everyone` 으로 권한을 확인해 둔다.
   **없어도 막지 않는다** — 알림이 안 울릴 뿐 공지 내용은 전달된다.
2. 공지를 [평소대로](#올리는-메시지) 올린다.
3. 공지 전송이 성공했고 1번에서 권한이 없었으면, **alert 채널**(`DISCORD_ALERT_CHANNEL_ID`,
   [send-alert-message](send-alert-message.md#요청) 와 같은 채널)에 아래 메시지를 올린다.

```
봇에게 <#announcement 채널 ID> 채널의 `Mention Everyone` 권한이 없어 방금 올린 공지의 @everyone 알림이 울리지 않았습니다. 채널 권한을 확인해 주세요.
```

- 전송은 `AllowedMentions.none()` 으로 한다. 채널 멘션 `<#id>` 는 이름으로 보이기만 한다.
  `@everyone` 을 글자로 적되 울리지 않는다.
- **alert 메시지 전송이 실패해도 응답은 204 다** — alert 채널 미설정 · 못 찾음 · 권한 부족 · Discord 5xx 모두.
  로그에 권한 문제와 alert 실패 이유를 남기고 끝낸다. 공지는 이미 올라갔으므로 실패를 돌려주면
  호출자가 재시도해 같은 공지가 두 번 올라간다 ([아래](#중복-전송과-재시도) 참고).
- 공지 전송 자체가 실패(502 · 503)하면 alert 메시지도 보내지 않는다.

> **권한을 고치기 전까지는 공지마다 alert 가 하나씩 쌓인다.** 채널이 하나로 고정이라 권한이 없으면
> 모든 공지가 알림 없이 올라가고, 그때마다 alert 메시지가 남는다. 중복을 따로 억제하지 않는다 —
> 반복되는 alert 가 권한을 고치라는 신호다.

## 중복 전송과 재시도

Discord 호출은 **한 번**(메시지 전송)뿐이라 부분 적용 상태는 없다. 문제는 **중복**이다 —
메시지 전송은 멱등이 아니어서, 같은 요청을 두 번 실행하면 길드 전체에 `@everyone` 알림이 두 번 울린다.
alert 보다 중복의 비용이 크다.

1. **먼저 다 확인하고, 그 다음에 보낸다** — 요청자 멤버 · captain 역할 · announcement 채널을 먼저
   해석하고, 하나라도 문제가 있으면 아무것도 보내지 않고 실패한다. `Mention Everyone` 권한은 확인만 하고
   막지 않는다 ([위](#mention-everyone-권한이-없을-때) 참고).
2. **`Idempotency-Key` 는 성공(204)했을 때만 저장한다.** 실패한 요청은 메시지가 올라가지 않았으므로,
   같은 키로 다시 오면 **다시 실행**한다.
3. **응답을 못 받은 호출자는 같은 키로 재시도한다.** 네트워크가 끊겼을 뿐 공지는 이미 올라갔을 수
   있는데, 새 키로 재시도하면 `@everyone` 이 두 번 울린다.

> **막을 수 없는 틈이 하나 있다.** Discord 가 메시지를 받은 직후, 키를 저장하기 전에 서비스가 죽으면
> 같은 키의 재시도가 한 번 더 보낸다. 되돌릴 수 없는 외부 호출과 키 저장을 한 트랜잭션으로 묶을 수
> 없어서다. 드문 경우라 받아들이되, 중복 공지는 captain 이 Discord 에서 직접 지운다.

## send-alert-message 와 다른 점

| | [send-alert-message](send-alert-message.md) | send-announcement-message |
|------|------|------|
| 경로 | `/channels/alert/msg` | `/channels/announcement/msg` |
| 호출 권한 | captain **또는** navigator | captain 만 |
| 발신자 줄 | `발신: <@id>` 를 맨 위에 붙임 | **붙이지 않음** |
| 맨 위 줄 | 발신자 줄 | `@everyone` |
| 알림 | `AllowedMentions.none()` — 아무것도 안 울림 | `@everyone` 만 울림 |
| `msg` 상한 | 1900자 | 1990자 |
| 추가 권한 | 없음 | `Mention Everyone` (없으면 공지는 올리고 alert 채널에 알림) |
| 설정값 | `DISCORD_ALERT_CHANNEL_ID` · captain · navigator 역할 | `DISCORD_ANNOUNCEMENT_CHANNEL_ID` · captain 역할 · (권한 알림용) `DISCORD_ALERT_CHANNEL_ID` |

## 미정 사항

정해야 이 계약이 확정되는 것들.

- **공지 채널 발행(crosspost)** — announcement 채널이 Discord 의 공지 채널 타입이면, 올린 메시지를
  팔로우한 다른 서버로 발행할지. 지금은 올리기만 하고 발행하지 않는다.
- **에러 바디 모양** — 여기는 FastAPI 의 `{"detail": ...}`, 백엔드는 `{errorCode, errorMessage}` 다.
  맞출지 말지는 별도 결정 사항.
