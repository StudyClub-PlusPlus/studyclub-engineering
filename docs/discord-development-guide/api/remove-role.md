# Remove Discord Role

역할 하나를 여러 유저에게서 한 요청으로 뗀다. 스터디 종료·탈퇴 때 [`assign-role`](assign-role.md) 로
붙였던 역할을 회수하는 용도다. 붙이는 것의 짝이라 계약 대부분이 같고, **다른 곳만** 이 문서에 자세히 적는다.

> ✅ **구현됨** — `discord/app/api/routes/roles.py`.
> 공통 요청 헤더는 [`common-header.md`](common-header.md) 를 따른다.
> **대상 길드는 하나로 고정**이라 요청에 길드를 넘기지 않는다.

## Table of Contents

- [요청](#요청)
- [성공 응답](#성공-응답)
- [실패 응답](#실패-응답)
- [부분 실패와 재시도](#부분-실패와-재시도)
- [assign-role 과 다른 점](#assign-role-과-다른-점)
- [미정 사항](#미정-사항)

## 요청

```
DELETE /api/v1/roles/{discordRoleId}/users
```

| 위치 | 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| 경로 | `discordRoleId` | string | O | 뗄 **Discord 역할 ID**(snowflake). `create-study` 가 돌려준 `discordRoleId` 가 여기 들어간다. captain · navigator · `@everyone` 은 안 된다 |

```jsonc
{
  "discordStudyId": "1327394882193883136",
  "discordUserIds": ["327394882193883136", "412938471293847123", "998234871293847123"]
}
```

| 필드 | 타입 | 필수 | 제약 |
|------|------|------|------|
| `discordStudyId` | string | O | snowflake. **로깅·추적용** — [assign-role 과 같다](assign-role.md#discordstudyid-의-역할) |
| `discordUserIds` | string[] | O | snowflake 배열. 1개 이상, 중복은 무시. **최대 100개** (중복 제거 후) |

**바디를 싣는 DELETE 다.** HTTP 가 금지하지는 않지만 중간 프록시가 버리는 경우가 있다 —
이 서비스는 백엔드가 내부에서 직접 부르므로 그 경로에 프록시가 없다.

헤더는 [공통 헤더](common-header.md) 전부 — `Idempotency-Key` 는 **필수**다.

**봇은 요청자를 검사하지 않는다.** [`assign-role`](assign-role.md#요청) 과 같다 — 누가 역할을 떼게 할 수 있는지는
백엔드가 호출 전에 정한다.

모든 ID 는 문자열이고 `^[0-9]{17,20}$` 로 검증한다.

**captain · navigator · `@everyone` 역할은 뗄 수 없다** (**400**) — [assign-role 과 같은 셋](assign-role.md#배정할-수-있는-역할의-범위)이다.
navigator 는 [`remove-navigator-role`](remove-navigator-role.md) 로 뗀다. 막으려면 두 역할 ID 를 알아야 하므로
`DISCORD_CONFIG_CAPTAIN_ROLE_ID` · `DISCORD_CONFIG_NAVIGATOR_ROLE_ID` 가 비어 있으면 **409** 다.
그 밖의 `discordRoleId` 는 제한하지 않는다. 올바른 `discordStudyId` · `discordRoleId` 쌍을 보내는 건 백엔드
책임이다 — [assign-role 의 역할 범위](assign-role.md#배정할-수-있는-역할의-범위) 와 같은 신뢰 모델이다.

## 성공 응답

**200 OK** — [assign-role 과 같은 모양](assign-role.md#성공-응답)이다.

```jsonc
{
  "succeededCount": 2,
  "failed": [
    { "discordUserId": "998234871293847123", "reason": "DISCORD_REJECTED" }
  ]
}
```

`succeededCount` 는 **"지금 그 역할을 갖고 있지 않은" 요청 유저 수**다. 이번에 뗐는지, 원래
없었는지, 길드를 이미 떠났는지는 구분하지 않는다 — 셋 다 원하는 최종 상태가 같다.

`failed` 에 들어올 수 있는 `reason` 은 **`DISCORD_REJECTED` 하나뿐**이다. assign-role 과 달리
`NOT_IN_GUILD` 가 없다 — [길드에 없는 유저는 성공](#길드에-없는-유저는-성공이다)으로 치기 때문이다.

## 실패 응답

에러 바디는 현재 FastAPI 기본형 `{"detail": "..."}` 이다.

### 공통 헤더에서 나는 것

| 상태 | 언제 |
|------|------|
| **400** | `X-Discord-User-ID` 가 없거나 snowflake 형식이 아님 |
| **400** | `Idempotency-Key` 없음 |
| **401** | `X-API-Key` 없음 또는 불일치 |

### 이 엔드포인트에서 나는 것

| 상태 | 언제 | 원인 |
|------|------|------|
| **400** | `discordRoleId` · `discordStudyId` · `discordUserIds` 의 원소가 snowflake 형식이 아님 | 요청자 잘못. 그대로 재시도해도 실패한다 |
| **400** | `discordStudyId` 가 없음 | 위와 같음 |
| **400** | `discordUserIds` 가 없거나 빈 배열 | 위와 같음. "아무것도 안 함" 을 200 으로 돌려주지 않는다 — 호출자 쪽 버그일 가능성이 높다 |
| **400** | `discordUserIds` 가 중복을 뺀 뒤 100개 초과 | 위와 같음. 나눠서 보낸다 |
| **400** | `discordRoleId` 가 captain · navigator · `@everyone` 역할 | [요청](#요청) 참고. 역할이 길드에 있는지보다 먼저 본다 |
| **404** | `discordRoleId` 에 해당하는 역할이 길드에 없음 | [아래](#역할이-없으면-404-다) 참고 |
| **409** | `DISCORD_CONFIG_GUILD_ID` · `DISCORD_CONFIG_CAPTAIN_ROLE_ID` · `DISCORD_CONFIG_NAVIGATOR_ROLE_ID` 설정이 없음 | 서버 설정 누락. `detail` 이 빠진 설정 이름을 말한다 |
| **503** | 봇 비활성 또는 아직 미연결 | `DISCORD_TOKEN` 미설정, 또는 기동 직후 `is_ready()` 가 아직 False |

`discordUserIds` 의 유저가 **길드 멤버가 아니어도 에러가 아니다** — [아래](#길드에-없는-유저는-성공이다) 참고.

503 은 **재시도 가능**하다. 400 · 401 은 조건이 바뀌기 전에는 재시도해도 같다.

역할 서열(전원 `failed`(`DISCORD_REJECTED`) 지만 재시도로 안 풀림)과 429(밖으로 안 나가고 느려짐)는
[assign-role](assign-role.md#이-엔드포인트에서-나는-것) 과 같다. 서열 제한은 붙일 때와 뗄 때 똑같이 걸린다.

## 부분 실패와 재시도

Discord 에는 "역할을 여러 명에게서 한 번에" 가 없다. **유저 한 명당 API 호출 한 번**이다
(`DELETE /guilds/{guild}/members/{user}/roles/{role}`). 규칙은
[assign-role](assign-role.md#부분-실패와-재시도) 과 같고, **기우는 방향만 다르다.**

**규칙 1 — 역할이 없으면 아무것도 하지 않는다.** 역할을 먼저 해석하고, 없으면
[404](#역할이-없으면-404-다) 다. 유저는 미리 "길드에 있나" 를 판정하지 않는다 — 아래 참고.

**규칙 2 — 한 명이 실패해도 나머지를 계속 뗀다.** 멈추면 뒤에 남은 유저들이 재시도가 올 때까지
계속 접근권을 가진다. 이미 뗀 유저에게 역할을 다시 붙여 "되돌리지" 않는다 — 방금 뗀 사람에게
접근권을 다시 주는 건 회수 요청의 의도와 정반대다.

단, **Discord 와의 연결 자체가 끊기면 거기서 멈춘다** — 연결 리셋 · 끊김 · 타임아웃은 다음 유저에게도 똑같이
나고 한 명마다 몇 분씩 걸릴 수 있다. 그 유저와 아직 시도하지 않은 유저를 모두 `failed` 에 `DISCORD_REJECTED`
로 담고 200 으로 답한다 ([assign-role](assign-role.md#부분-실패와-재시도) 과 같다). (2026-10-15 결정)

**규칙 3 — 재시도는 전체를 다시 보내도 되고, `failed` 만 보내도 된다.** 회수는 **멱등**이다.
역할이 없는 멤버에게서 떼도 Discord 는 204 를 돌려준다.

**`Idempotency-Key` 는 요청 하나에 하나**다. 재시도할 때는 같은 값을 다시 보내 한 요청의
시도들을 로그에서 묶는다 ([assign-role](assign-role.md#부분-실패와-재시도) 과 같다).

## assign-role 과 다른 점

뗄 때는 **실패의 방향**이 반대다. 붙이다 실패하면 누군가 접근을 *못 얻고*, 떼다 실패하면 누군가
접근을 *잃지 않는다*. 탈퇴한 사람이 스터디 채널을 계속 보는 쪽이 더 나쁜 실패이므로,
아래 규칙은 "**확실히 떼는 것**" 쪽으로 기울어 있다.

### 길드에 없는 유저는 성공이다

assign-role 은 길드에 없는 유저를 `failed` 에 `NOT_IN_GUILD` 로 담는다. 여기서는
**`succeededCount` 에 넣는다.**

- Discord 에서 멤버가 길드를 나가면 멤버 객체가 사라지고, 다시 들어와도 **역할은 복원되지 않는다.**
  길드에 없는 유저는 이미 그 역할이 없다 — 원하는 상태가 이미 이뤄져 있다.
- 역할 회수가 필요한 가장 흔한 경우가 **탈퇴**다. 이걸 실패로 돌려주면 호출자는 "이미 나간 사람" 과
  "진짜 못 뗀 사람" 을 구분해서 처리해야 한다. 앞쪽은 할 일이 없으므로 성공에 합친다.
- **판단은 캐시가 아니라 Discord 응답으로 한다.** Discord 에 회수 요청을 보내고, `Unknown Member` 로
  답하면 그 유저를 성공으로 센다(로그에는 남긴다). 캐시로 "없음" 을 판정하면 캐시에서 빠진
  *실제 멤버*에게서 역할을 떼지 않고 성공으로 세게 되는데, 그건 역할이 남아 있는데 성공이라고
  말하는 것이다.
  assign-role 에서 캐시 누락은 `failed` 에 남아 눈에 띄지만, 여기서는 **조용한 거짓 성공**이 된다.
  그래서 멤버 캐시는 **회수를 보낼 멤버 객체를 얻는 데만** 쓴다 — 캐시에 있으면 바로 회수를 보내고,
  없으면 Discord 에 그 멤버를 물은 뒤 보낸다. 어느 쪽이든 "길드에 없다" 는 Discord 가 `Unknown Member` 로
  답했을 때만 내린다.

### 역할이 없으면 404 다

"역할이 없으면 누구도 그 역할을 갖고 있지 않으니 전원 성공" 이라는 논리도 가능하다. 그래도 404 로
둔다 — **틀린 `discordRoleId`** (백엔드 버그) 도 같은 증상이라, 성공으로 넘기면 백엔드는 잘못된 ID 로 회수가
계속 "성공" 하는 걸 알아챌 방법이 없다. 스터디 역할이 길드에서 지워진 경우라면 백엔드가 404 를
보고 그 스터디를 정리하면 된다.

역할은 요청 전에 확인하므로, 역할이 없을 때는 Discord 에 회수 요청을 보내지 않는다.

## 미정 사항

정해야 이 계약이 확정되는 것들.

- **에러 바디 모양** — 여기는 FastAPI 의 `{"detail": ...}`, 백엔드는 `{errorCode, errorMessage}` 다.
  맞출지 말지는 별도 결정 사항.
