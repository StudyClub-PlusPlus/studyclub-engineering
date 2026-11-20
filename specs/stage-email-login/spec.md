# 테스트 로그인 — 메뉴에 없는 이메일 가입 · 비밀번호 로그인 API Spec

> ERD: [EMAIL_SIGNUP_CODE](../../docs/erd/EMAIL_SIGNUP_CODE.md) · [ACCOUNT_IDENTITY](../../docs/erd/ACCOUNT_IDENTITY.md)
> 생성일: 2026-11-20
> 상태: 구현완료

## 왜

StudyClub 은 Google · Apple 로그인만 있다. 테스터(사람 · 에이전트)가 소셜 계정 없이 들어와 흐름을 확인할 수 있게, **스위치를 켠 환경에서만** 이메일 가입(메일 코드) · 비밀번호 로그인을 연다. 화면은 메뉴 · 로그인 화면 어디에도 링크가 없는 `/{locale}/auth/email` 하나다.

> **운영도 스위치로 연다 (2026-11-20 결정).** 다른 서비스는 운영에서 항상 404 지만, StudyClub 은 그날 운영 테스트가 필요해 `EMAIL_LOGIN_ENABLED=true` 면 운영에서도 열린다. **테스트가 끝나면 운영 스위치를 끈다.** 평문 코드 사본(`EMAIL_CODE_COPY`)은 운영에서 여전히 금지 — 운영 테스터는 실제 메일로 코드를 받는다.

## 스위치

| env | 값 | 뜻 |
|---|---|---|
| `EMAIL_LOGIN_ENABLED` | `true` | 아래 API 3개를 연다. 없거나 `false` 면 셋 다 404 |
| `EMAIL_CODE_COPY` | `true` | 코드 평문 사본을 `EMAIL_SIGNUP_CODE.CODE_COPY` 에 남긴다(에이전트가 DB 로 읽는 길). **`APP_ENV=production` 에서 켜면 서버가 뜨지 않는다** |
| `APP_ENV` | `production` · `stage` · … | 사본 금지 판정에만 쓴다 |

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| POST | /auth/email/signup | 가입 1/2 — 코드 메일 보내기 | X | 구현완료 |
| POST | /auth/email/verify | 가입 2/2 — 코드 확인 + 비밀번호 정하기 | X | 구현완료 |
| POST | /auth/email/login | 비밀번호 로그인 — 소셜 로그인과 같은 응답 | X | 구현완료 |

---

## 가입 1/2 — 코드 메일 보내기

- **Request** `{ "email": "string (이메일, 255자)" }` → **204**
- 6자리 코드를 만들어 HMAC 만 저장하고(사본 스위치면 평문도) `NOTIFY` 메일로 보낸다. 유효 10분
- 예약 도메인(`.test` · `.example` · `.invalid` · `.localhost`)은 메일을 보내지 않는다 — 에이전트 테스터 주소라 반송만 쌓인다. 그 코드는 사본에서 읽는다
- 사본이 없는데(운영) 메일 발송이 실패하면 503 — 코드 행은 롤백된다

| HTTP | errorCode | 언제 |
|---|---|---|
| 400 | INVALID_INPUT | 메일 형식 |
| 404 | NOT_FOUND | 스위치 꺼짐 |
| 409 | ACCOUNT_LINK_REQUIRED | 그 메일이 소셜(구글 · 애플)로 가입돼 있음 — 계정을 합치지 않는다 |
| 429 | TOO_MANY_REQUESTS | 같은 메일로 60초 안에 다시(「N초 뒤에…」) · 24시간 안에 10번 |
| 503 | EXTERNAL_SERVICE_ERROR | 운영에서 메일을 못 보냄 |

## 가입 2/2 — 코드 확인 + 비밀번호

- **Request** `{ "email", "code": "6자리 숫자", "password": "8~72자" }` → **204**
- 그 메일의 맨 마지막 코드만 본다. 한 번만 쓴다. 5번 틀리면 버린다. 틀린 횟수 · 사용 표시는 조건부 UPDATE 라 동시 입력에도 한도를 넘지 않는다
- 맞으면 소셜 가입과 같은 길(`AccountRegistrar`)로 ACCOUNT + ACCOUNT_IDENTITY(`ISSUER=EMAIL`, `PROVIDER_ACCOUNT_ID`=정규화 메일)를 만들고 비밀번호 해시(`{bcrypt}`)를 둔다. 이미 EMAIL 수단이 있으면 비밀번호만 바꾼다(다시 정하기)
- 비밀번호 72자 상한은 BCrypt 가 72바이트까지만 보기 때문

| HTTP | errorCode | 언제 |
|---|---|---|
| 400 | EMAIL_CODE_WRONG | 코드가 틀림 — 메시지에 남은 횟수 |
| 400 | EMAIL_CODE_EXPIRED | 10분 지남 · 이미 씀 · 5번 틀림 · 코드 없음 |
| 404 | NOT_FOUND | 스위치 꺼짐 |
| 409 | ACCOUNT_LINK_REQUIRED | 그 사이 소셜로 가입된 메일 |

## 비밀번호 로그인

- **Request** `{ "email", "password" }` → **200** `/auth/social-login` 과 같은 `AuthResponse`(토큰 · `account` · `suggestedNickname=null`)
- 온보딩 전이면 화면이 소셜 로그인과 똑같이 온보딩으로 보낸다

| HTTP | errorCode | 언제 |
|---|---|---|
| 401 | UNAUTHORIZED | 메일 · 비밀번호가 안 맞음(어느 쪽인지 말하지 않는다) |
| 404 | NOT_FOUND | 스위치 꺼짐 |

## 화면 — `/{locale}/auth/email` (core-front)

- 링크 없음 · `noindex`. BFF `POST /api/auth/email/{signup|verify|login}` 를 거친다(로그인은 소셜과 같이 httpOnly 쿠키)
- 탭 「로그인」 · 「가입」. `?email=` 로 오면 미리 채우고 가입 탭(초대 링크)
- 가입 2/2: 「<메일> 로 보냈어요. 10분 안에 넣어 주세요.」 + 「메일 바꾸기」 · 인증코드(칸 하나, `one-time-code`) · 비밀번호 · 「가입하고 로그인」 · 「코드 다시 받기 (N초 뒤)」. 만료면 확인 버튼이 꺼진다
- 로그인 뒤 맨 위에 「테스트 계정으로 로그인했어요 · <메일>」 띠(이번 탭 세션의 로그인 수단이 `email` 일 때)

## 에이전트 테스터가 코드를 읽는 길 (stage)

예약 도메인 주소(`tester+seller1@example.test` 등)로 가입하고, 사본에서 코드를 읽는다.

```sql
SELECT CODE_COPY FROM EMAIL_SIGNUP_CODE WHERE EMAIL = ? ORDER BY ID DESC LIMIT 1;
```

## 퍼널·계측

- 가입 단계 — 온보딩을 마치면 서버 `User Signed Up` 의 `method` 가 `email` 로 나간다(ISSUER 에서 계산). 로그인은 front `User Logged In` 은 보내지 않는다. 트래킹 플랜 [analytics](../analytics/spec.md) 의 method 값에 `email` 을 더했다
- OMTM 에 기대하는 변화 없음 — 테스트 계정이다. 운영 테스트 계정은 분석에서 `method=email` 로 걸러낸다

## 안 한 것

- IP 당 시간 한도 — 메일당 한도만 있다
- 오래된 코드 행 지우기 — 지금은 쌓인다
- 사람 테스터 초대 토큰 확인 — `?email=` 는 미리 채우기일 뿐이다
