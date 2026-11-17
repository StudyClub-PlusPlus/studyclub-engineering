# 디스코드 계정 연동

> 그림: [스터디클럽 디스코드 연동](https://claude.ai/artifact/1zttS7xAwHxTvT1FCAASP1) · 갱신 2026-10-27
> 계약: [study-application 「디스코드 계정 연동」](../../specs/study-application/spec.md#디스코드-계정-연동) · 연결 해제는 [profile-edit](../../specs/profile-edit/spec.md)

회원 계정에 디스코드 사용자를 붙이는 왕복이다. 붙은 `ACCOUNT.DISCORD_ID` 를 신청 허용 · `!출석체크` 매칭 · 스터디 role 부여가 같이 쓴다.

## 흐름

```
연동 창 「디스코드 연동하기」
  └ window.open ─▶ discord.com/oauth2/authorize   (scope identify guilds.members.read, state)
                       │ 승인
                       ▼
     <사이트>/api/auth/discord/callback ─ postMessage({code, state}) ─▶ 연동 창
                                                                         │ 출처 · 표식 · state 확인
                                                                         ▼
                                                     POST /api/me/discord/link {code}
                                                                         │
                     서버: code → 토큰 → /users/@me → 길드 멤버 확인 → ACCOUNT.DISCORD_ID · DISCORD_HANDLE 저장
```

| 단계 | 어디 |
|---|---|
| 팝업 열기 · 메시지 받기 | core-front `src/lib/discord.ts` `requestDiscordCode` |
| 착지점 | core-front `src/app/api/auth/discord/callback/route.ts` |
| 연동 진입점 | core-front `src/components/ApplyDiscordGate.tsx` (신청 직전) · `src/features/profile/DiscordRow.tsx` (마이페이지, 해제 포함) |
| 코드 교환 · 저장 | backend `AccountDiscordLinkService` · `DiscordOAuthClient` |

- 화면은 디스코드 ID 를 보내지 않는다. 서버가 code 로 디스코드에 직접 묻는다
- 한 디스코드 계정은 회원 하나에만 붙는다 (`UNIQUE(DISCORD_ID)`, 다른 계정이면 409)
- 팝업은 클릭과 같은 틱에 연다. await 뒤에 열면 브라우저가 막는다

## 켜는 조건

세 곳의 돌아오는 주소가 글자까지 같아야 한다. 하나라도 다르면 코드 교환이 503 이다.

| 곳 | 값 |
|---|---|
| 화면 (자동) | `<사이트 주소>/api/auth/discord/callback` |
| 백엔드 | `DISCORD_OAUTH_REDIRECT_URI` (+ `DISCORD_OAUTH_CLIENT_ID` · `_SECRET` · `DISCORD_GUILD_ID`) |
| Discord 개발자 포털 | OAuth2 → Redirects |

프론트 빌드에 `NEXT_PUBLIC_DISCORD_CLIENT_ID` 가 없으면 연동 창은 「준비 중」만 보인다. 개발 서버는 client id 없이 목 코드로 켜진다.

## 콜백 페이지 규칙 (구글 로그인 콜백도 같다)

- 쿼리값을 `<script>` 에 넣을 때 `<` 를 `\u003c` 로 바꾼다 (`</script>` 탈출 방지)
- `postMessage` 대상에 `"*"` 를 쓰지 않는다. 디스코드는 자기 출처, 구글은 자기 출처 · 운영/stage 백오피스 · 로컬 4700/4701
- 허용 출처를 `NEXT_PUBLIC_*` 로 받지 않는다. 빌드 인자라 서버 라우트 실행 때 비어 있다 (stage 실측 2026-10-27)

## 실측 (2026-10-27, stage)

- `GET /api/auth/discord/callback` 200, `postMessage(data, window.location.origin)`
- 구글 콜백 `code=</script>…` 는 `\u003c/script` 로 이스케이프되어 나온다
- stage 에 OAuth 키가 들어가기 전이라 실제 디스코드 왕복은 아직 못 봤다
