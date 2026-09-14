# Assign Navigator Discord Role

**navigator 역할**을 여러 유저에게 한 요청으로 붙인다. [`assign-role`](assign-role.md) 과 같은 동작인데
붙일 역할이 **navigator 로 고정**이라 경로에 `discordRoleId` 가 없다. 계약 대부분이 assign-role 과 같고,
**다른 곳만** 이 문서에 자세히 적는다. navigator 역할을 떼는 건
[`remove-navigator-role`](remove-navigator-role.md) 이 맡는다.

> ⚠️ **아직 구현 전이다.** 이 문서는 구현할 계약이다.
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
POST /api/v1/roles/navigator/users
```

헤더는 [공통 헤더](common-header.md) 전부 — `Idempotency-Key` 는 **필수**다.

**captain 역할을 가진 멤버만 호출할 수 있다.** [`create-study`](create-study.md#요청) ·
[`assign-role`](assign-role.md#요청) 과 같은 규칙이다 — 봇이 `X-Discord-User-ID` 로 길드 멤버를 조회해
captain 역할 보유 여부를 확인하고, 없으면 **403** 이다.

captain 역할과 navigator 역할은 둘 다 길드에 **이미 존재하는** 역할이다. 이 엔드포인트는 둘 중
어느 것도 만들지 않고, 찾지 못하면 배정하지 말고 실패한다.

**navigator 역할은 captain 역할과 같은 방식으로 찾는다** — 설정값(예: `DISCORD_NAVIGATOR_ROLE_ID`)으로
역할 ID 를 받는다. 이름으로 찾지 않는다 (길드에서 역할 이름이 바뀌거나 동명 역할이 생기면 조용히 깨진다).

```jsonc
{
  "discordStudyId": "1327394882193883136",
  "discordUserIds": ["327394882193883136", "412938471293847123"]
}
```

| 필드 | 타입 | 필수 | 제약 |
|------|------|------|------|
| `discordStudyId` | string | O | snowflake. **로깅·추적용** — [assign-role 과 같다](assign-role.md#discordstudyid-의-역할) |
| `discordUserIds` | string[] | O | snowflake 배열. 1개 이상, 중복은 무시. 상한은 [assign-role 과 같은 결정](assign-role.md#미정-사항)을 따른다 |

모든 ID 는 문자열이고 `^[0-9]{17,20}$` 로 검증한다.

## 성공 응답

**204 No Content** — 바디가 없다.

**204 는 "요청한 유저 전부가 지금 navigator 역할을 갖고 있다" 는 뜻이다.** 이번 요청이 실제로
붙였는지, 이미 갖고 있었는지는 구분하지 않는다 ([assign-role](assign-role.md#성공-응답) 과 같다).

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
| **400** | `discordStudyId` · `discordUserIds` 의 원소가 snowflake 형식이 아님 | 요청자 잘못. 그대로 재시도해도 실패한다 |
| **400** | `discordStudyId` 가 없음 | 위와 같음 |
| **400** | `discordUserIds` 가 없거나 빈 배열 | 위와 같음. "아무것도 안 함" 을 204 로 돌려주지 않는다 — 호출자 쪽 버그일 가능성이 높다 |
| **400** | `discordUserIds` 가 상한 초과 | 상한은 [미정](#미정-사항) |
| **404** | captain 역할을 길드에서 찾지 못함 | 서버·길드 설정 문제(역할이 지워졌거나 잘못 지정됨). 요청자와 무관하므로 403 이 아니다. `detail` 로 다른 404 와 구분한다 |
| **404** | navigator 역할을 길드에서 찾지 못함 | captain 404 와 같은 **서버·길드 설정 문제**다. 호출자가 보낸 값이 아니므로 호출자가 고칠 수 없다. `detail` 로 다른 404 와 구분한다 |
| **404** | `discordUserIds` 중 길드 멤버가 아닌 유저가 있음 | 탈퇴했거나 아직 입장 전. **아무 유저도 건드리지 않는다** — [아래](#부분-실패와-재시도) 참고 |
| **502** | Discord 가 배정을 거부 | 봇 권한 부족(`Manage Roles`), **역할 서열** 문제, 그 밖의 Discord 5xx |
| **503** | 봇 비활성 또는 아직 미연결 | `DISCORD_TOKEN` 미설정, 또는 기동 직후 `is_ready()` 가 아직 False |

503 · 502 는 **재시도 가능**하다. 400 · 401 · 403 은 조건이 바뀌기 전에는 재시도해도 같다.
멤버 404 는 그 유저가 길드에 들어오면 통한다.
captain · navigator 역할 404 는 호출자가 고칠 수 없다 — 길드의 역할이나 서버 설정을 고쳐야 풀린다.

역할 서열(502 지만 재시도로 안 풀림)과 429(밖으로 안 나가고 느려짐)는
[assign-role](assign-role.md#이-엔드포인트에서-나는-것) 과 같다.

> **여기서 역할 서열 문제는 "가끔" 이 아니라 "항상" 이다.** 역할이 하나로 고정이라, 봇 역할이
> navigator 보다 아래에 있으면 **모든 요청이** 502 로 실패한다. 호출자 재시도로는 풀리지 않고,
> 길드에서 봇 역할을 navigator 위로 올려야 한다. 로그에는 서열 문제임을 남긴다.

## 부분 실패와 재시도

[assign-role 의 규칙](assign-role.md#부분-실패와-재시도)을 그대로 따른다. 유저 한 명당 Discord 호출이
한 번 나가므로(`PUT /guilds/{guild}/members/{user}/roles/{navigator-role}`) 요청 도중 끊길 수 있다.

1. **먼저 다 확인하고, 그 다음에 붙인다** — captain · navigator 역할과 모든 유저를 먼저 해석하고,
   하나라도 없으면 아무것도 하지 않고 404.
2. **붙이는 도중 실패하면 되돌리지 않는다** — 그 유저가 원래부터 navigator 였을 수 있다. 502 를 돌려주고
   이미 붙은 유저 ID 를 로그에 남긴다.
3. **재시도는 전체 요청을 같은 `Idempotency-Key` 로 다시 보내는 것이다** — 역할 부여는 멱등이다.
   키는 성공(204)했을 때만 저장한다.

## assign-role 과 다른 점

### 역할을 호출자가 고르지 않는다

assign-role 은 `discordRoleId` 를 받고 **어떤 역할이든** 붙인다 — 올바른 역할을 고르는 책임이 백엔드에 있다.
여기서는 봇이 설정으로 navigator 역할을 **스스로** 찾는다. 그래서:

- 경로·바디에 역할 ID 가 없고, `discordRoleId` 형식 400 · 역할 없음 404 가 **navigator 역할 없음 404** 하나로 바뀐다.
  이 404 는 호출자가 보낸 값 때문이 아니라 **서버 설정 문제**다.
- captain 이 이 엔드포인트로 navigator 외의 역할을 붙일 방법은 없다.

### navigator 는 스터디별 역할이 아니다

navigator 역할은 **길드 전체에 하나**다. `discordStudyId` 는 로그에만 남고, 역할이 그 스터디로
한정되지 않는다 — 스터디 A 때문에 붙인 navigator 는 길드 어디서나 navigator 다.

- 봇은 대상 유저가 **그 스터디의 멤버인지 확인하지 않는다.** 그 정보의 주인은 백엔드다
  ([assign-role 의 신뢰 모델](assign-role.md#배정할-수-있는-역할의-범위) 과 같은 결).
- 요청자 captain 이 **그 스터디의 captain 인지도 확인하지 않는다.** captain 역할 역시 길드 전체에 하나라,
  봇이 볼 수 있는 건 "captain 역할이 있다" 까지다. 스터디 단위 권한 검사가 필요하면 백엔드가 호출 전에 한다.

### 경로 충돌

`/roles/navigator/users` 는 assign-role 의 `/roles/{discordRoleId}/users` 와 **모양이 겹친다.** FastAPI 는
라우트를 등록 순서대로 매칭하므로, 동적 경로가 먼저 등록되면 `navigator` 가 `discordRoleId` 로 잡혀
snowflake 형식 **400** 이 난다. **고정 경로를 동적 경로보다 먼저 등록한다** — 테스트로 이 순서를 고정한다.

## 미정 사항

정해야 이 계약이 확정되는 것들.

- **`discordUserIds` 상한** — [assign-role](assign-role.md#미정-사항) 과 같은 값을 쓴다.
- **에러 바디 모양** — 여기는 FastAPI 의 `{"detail": ...}`, 백엔드는 `{errorCode, errorMessage}` 다.
  맞출지 말지는 별도 결정 사항.
