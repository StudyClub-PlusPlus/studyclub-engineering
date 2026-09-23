# Remove Navigator Discord Role

**navigator 역할**을 유저 **한 명**에게서 뗀다. [`assign-navigator-role`](assign-navigator-role.md) 로
붙였던 역할을 회수하는 짝이다. [`remove-role`](remove-role.md) 과 같은 동작인데 뗄 역할이
**navigator 로 고정**이라 경로에 `discordRoleId` 가 없다. 계약 대부분이 remove-role 과 같고,
**다른 곳만** 이 문서에 자세히 적는다.

> ⚠️ **아직 구현 전이다.** 이 문서는 구현할 계약이다.
> 공통 요청 헤더는 [`common-header.md`](common-header.md) 를 따른다.
> **대상 길드는 하나로 고정**이라 요청에 길드를 넘기지 않는다.

## Table of Contents

- [요청](#요청)
- [성공 응답](#성공-응답)
- [실패 응답](#실패-응답)
- [여러 명을 뗄 때](#여러-명을-뗄-때)
- [remove-role 과 다른 점](#remove-role-과-다른-점)
- [미정 사항](#미정-사항)

## 요청

```
DELETE /api/v1/roles/navigator/users/{discordUserId}?discordStudyId={discordStudyId}
```

| 위치 | 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|------|
| 경로 | `discordUserId` | string | O | navigator 역할을 뗄 **Discord 유저 ID**(snowflake) |
| 쿼리 | `discordStudyId` | string | O | snowflake. **로깅·추적용** — [assign-role 과 같다](assign-role.md#discordstudyid-의-역할) |

**바디가 없다.** 그래서 `Content-Type` 도 붙이지 않는다.

헤더는 [공통 헤더](common-header.md) 전부 — `Idempotency-Key` 는 **필수**다.

**captain 역할을 가진 멤버만 호출할 수 있다.** [`assign-navigator-role`](assign-navigator-role.md#요청) ·
[`remove-role`](remove-role.md#요청) 과 같은 규칙이다 — 없으면 **403**.

captain 역할과 navigator 역할은 둘 다 길드에 **이미 존재하는** 역할이고, 둘 다 **설정값으로 역할 ID 를
받아** 찾는다 ([assign-navigator-role](assign-navigator-role.md#요청) 과 같다). 찾지 못하면 회수하지 말고 실패한다.

모든 ID 는 문자열이고 `^[0-9]{17,20}$` 로 검증한다.

## 성공 응답

**204 No Content** — 바디가 없다.

**204 는 "그 유저가 지금 navigator 역할을 갖고 있지 않다" 는 뜻이다.** 이번 요청이 실제로 뗐는지,
원래 없었는지, 유저가 이미 길드를 떠났는지는 구분하지 않는다 ([remove-role](remove-role.md#성공-응답) 과 같다).

## 실패 응답

에러 바디는 현재 FastAPI 기본형 `{"detail": "..."}` 이다.

### 공통 헤더에서 나는 것

| 상태 | 언제 |
|------|------|
| **400** | `X-Discord-User-ID` 가 없거나 snowflake 형식이 아님 — 이 엔드포인트는 captain 확인 때문에 필수다 |
| **400** | `Idempotency-Key` 없음 |
| **401** | `X-API-Key` 없음 또는 불일치 |
| **403** | 요청자에게 captain 역할이 없음 |
| **404** | `X-Discord-User-ID` 가 그 길드의 멤버가 아님 |

### 이 엔드포인트에서 나는 것

| 상태 | 언제 | 원인 |
|------|------|------|
| **400** | `discordUserId` · `discordStudyId` 가 snowflake 형식이 아님 | 요청자 잘못. 그대로 재시도해도 실패한다 |
| **400** | `discordStudyId` 쿼리가 없음 | 위와 같음 |
| **404** | captain 역할을 길드에서 찾지 못함 | 서버·길드 설정 문제. 요청자와 무관하므로 403 이 아니다. `detail` 로 다른 404 와 구분한다 |
| **404** | navigator 역할을 길드에서 찾지 못함 | [아래](#navigator-역할이-없으면-404-다) 참고 |
| **502** | Discord 가 회수를 거부 | 봇 권한 부족(`Manage Roles`), **역할 서열** 문제, 그 밖의 Discord 5xx |
| **503** | 봇 비활성 또는 아직 미연결 | `DISCORD_TOKEN` 미설정, 또는 기동 직후 `is_ready()` 가 아직 False |

`discordUserId` 가 **길드 멤버가 아니어도 에러가 아니다** (204) — [remove-role 과 같다](remove-role.md#길드에-없는-유저는-204-다).
판단도 같은 방식으로 캐시가 아니라 Discord 의 `Unknown Member` 응답으로 한다.

503 · 502 는 **재시도 가능**하다. 400 · 401 · 403 은 조건이 바뀌기 전에는 재시도해도 같다.
captain · navigator 역할 404 는 호출자가 고칠 수 없다 — 길드의 역할이나 서버 설정을 고쳐야 풀린다.

역할 서열과 429 는 [assign-navigator-role](assign-navigator-role.md#이-엔드포인트에서-나는-것) 과 같다 —
봇 역할이 navigator 보다 아래면 **모든 요청이** 502 다. 서열 제한은 붙일 때와 뗄 때 똑같이 걸린다.

## 여러 명을 뗄 때

[remove-role 의 규칙](remove-role.md#여러-명을-뗄-때)을 그대로 따른다.

- 여러 명이면 **호출자가 유저 수만큼 부른다.** 요청마다 Discord 호출은 한 번이라 요청 안의 부분 실패는 없다.
- 한 명이 실패해도 **나머지를 계속 부르고**, 실패한 유저만 다시 부른다. 이미 뗀 유저에게 다시 붙여 되돌리지 않는다.
- **`Idempotency-Key` 는 유저마다 따로** 만들고, 재시도할 때는 그 유저의 원래 키를 보낸다.
  키는 로그 추적용이고, 서버는 중복 요청을 막지 않는다.

## remove-role 과 다른 점

### navigator 는 스터디별 역할이 아니다 — 떼면 길드 전체에서 빠진다

**이 엔드포인트에서 가장 조심할 점이다.** navigator 역할은 **길드 전체에 하나**라
([assign-navigator-role](assign-navigator-role.md#navigator-는-스터디별-역할이-아니다)), 스터디 A 때문에
떼도 그 유저는 **길드 어디에서도** navigator 가 아니게 된다.

유저가 스터디 A 와 B 에서 둘 다 navigator 인데 A 가 끝나 이 엔드포인트를 부르면, **B 의 navigator 권한도
같이 사라진다.** 봇은 이걸 막을 수 없다:

- `discordStudyId` 는 로그에만 남는다. 봇은 유저가 어느 스터디에서 navigator 인지 **모른다** —
  그 정보의 주인은 백엔드다.
- Discord 역할에는 "몇 번 붙였는지" 개념이 없다. 두 번 붙여도 한 번 떼면 없어진다.

그래서 **부를지 말지는 백엔드가 판단한다.** 유저가 **남은 어떤 스터디에서도 navigator 가 아닐 때만** 부른다.
봇은 요청이 오면 그대로 뗀다. 잘못 부른 경우는 로그의 `discordStudyId` · `discordUserId` 로 추적한다.

같은 이유로, 요청자 captain 이 **그 스터디의 captain 인지도 확인하지 않는다** — captain 역할 역시 길드 전체에 하나다.

### navigator 역할이 없으면 404 다

remove-role 은 `discordRoleId` 가 없는 역할이면 404 다 — 틀린 ID(백엔드 버그)를 알아채게 하려고.
여기서는 역할 ID 를 호출자가 보내지 않으므로 **404 의 뜻이 바뀐다:** 호출자 잘못이 아니라
**설정값이 틀렸거나 길드에서 역할이 지워진 서버 설정 문제**다.

"역할이 없으면 누구도 navigator 가 아니니 204" 로 둘 수도 있지만 404 로 둔다 — 설정이 깨진 채로
회수가 계속 "성공" 하면 아무도 알아채지 못하고, 설정이 고쳐졌을 때 떼졌어야 할 사람들이 navigator 로 남는다.

역할은 요청 전에 확인하므로, 역할이 없을 때는 Discord 에 회수 요청을 보내지 않는다.

### 경로 충돌

`/roles/navigator/users/{discordUserId}` 는 remove-role 의 `/roles/{discordRoleId}/users/{discordUserId}` 와 **모양이 겹친다.**
[assign-navigator-role 과 같은 문제](assign-navigator-role.md#경로-충돌)다 — **고정 경로를 동적 경로보다 먼저 등록**하고,
테스트로 순서를 고정한다.

## 미정 사항

정해야 이 계약이 확정되는 것들.

- **에러 바디 모양** — 여기는 FastAPI 의 `{"detail": ...}`, 백엔드는 `{errorCode, errorMessage}` 다.
  맞출지 말지는 별도 결정 사항.
