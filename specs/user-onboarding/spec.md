# 회원가입·온보딩 흐름

소셜 로그인 **첫 성공이 곧 가입**이다. 로그인 직후 USER·IDENTITY 를 만들고, 온보딩(필수 약관 + 닉네임 + 타임존)을 마쳐야 가입 완료. 완료 시점에 `UserRegisteredEvent` 를 **USER 당 1회** 발행하고 웰컴메일은 알림팀이 받아서 보낸다.

MVP 는 **구글만** (기획 08/31). 애플은 같은 구조로 붙을 수 있게만 해 두고 구현하지 않는다 — [애플 붙일 때](#애플-붙일-때).
프로필 이미지는 온보딩에서 안 받는다 (마이페이지, 별도 스펙).

## 흐름

```
로그인 화면 ──구글 인증──▶ 토큰 검증 → sub · email · email_verified · name
                              │
                              ├─ email 없음 / email_verified≠true ──▶ 가입 불가 안내 → 로그인 화면
                              │
                              ▼
                    IDENTITY(ISSUER, PROVIDER_USER_ID=sub) 조회
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   없음 = 신규            있음 · 미완료           있음 · 완료
   USER + IDENTITY 생성   기존 USER              기존 USER
   ONBOARDING_COMPLETED_AT=NULL
   NICKNAME=user_<랜덤> (임시)
   EMAIL=구글 이메일
        │                     │                     │
        └────────┬────────────┘                     ▼
                 ▼                            홈 (next 있으면 거기)
            온보딩 화면
            약관 3종 · 닉네임(제공자 이름 미리 채움) · 타임존(브라우저 타임존 미리 선택)
                 │
                 ├─ 검증 실패 ──▶ 필드별 오류, 저장 없음, 온보딩 화면
                 ▼
            완료 처리 (한 트랜잭션)
            USER.NICKNAME · TIME_ZONE · ONBOARDING_COMPLETED_AT=now
            ACCOUNT_CONSENT 3행
                 │
                 ▼
            UserRegisteredEvent 발행 ──▶ 알림팀 → 웰컴메일
                 │
                 ▼
            홈 (next 있으면 거기)
```

- 토큰은 신규·미완료·완료 전부에서 발급한다. **온보딩 미완료도 로그인 상태**다. 쓸 수 있는 게 적을 뿐.
- 미완료·완료 로그인 때 `IDENTITY.LAST_LOGIN_AT` 을 갱신한다. ERD 에 있는 컬럼 — 그 로그인 수단으로 마지막에 들어온 시각. 신규는 행 만들 때 채워진다.

## 사람을 어떻게 찾나 — `(ISSUER, sub)`

이메일이 아니라 제공자가 준 고유값 `sub` 로 찾는다. `sub` 는 제공자 안에서만 고유하니 항상 `ISSUER` 와 쌍으로. ERD `IDENTITY` 의 `UNIQUE(ISSUER, PROVIDER_USER_ID)` 가 그거다.

```
로그인 성공 → (issuer, sub, email, email_verified, name)

1. email 없음 / email_verified ≠ true   → 가입 불가
2. IDENTITY(issuer, sub) 있음            → 그 USER
3. 없음, USER(EMAIL=email) 있음           → 그 USER 에 IDENTITY 추가   ← 애플 붙일 때 켤지 미정
4. 둘 다 없음                            → USER + IDENTITY 신규
```

구글만일 땐 1·2·4 만 돈다.

예 — 진중이 구글로 가입하고, 나중에 애플도 연결한 상태:

```
USER
  ID=7  EMAIL=jin@gmail.com  NICKNAME=jinjoong  ONBOARDING_COMPLETED_AT=2026-09-02 …

IDENTITY
  ID=1  USER_ID=7  ISSUER=GOOGLE  PROVIDER_USER_ID=110293847562938475  PROVIDER_EMAIL=jin@gmail.com
  ID=2  USER_ID=7  ISSUER=APPLE   PROVIDER_USER_ID=001234.abcd1234…    PROVIDER_EMAIL=abc@privaterelay.appleid.com

구글로 로그인 → (GOOGLE, 110293847562938475) → IDENTITY 1 → USER 7. 완료 상태니 홈
애플로 로그인 → (APPLE, 001234.abcd1234…)   → IDENTITY 2 → USER 7. 같은 사람
처음 보는 sub → IDENTITY 없음                → USER 8 새로 만들고 온보딩
```

이메일은 어디에도 조회 조건으로 안 쓰인다. `USER.EMAIL` 은 연락처, `IDENTITY.PROVIDER_EMAIL` 은 "그 제공자가 준 원본" 기록용.

- 구글 문서: "Use `sub` within your application as the unique-identifier key for the user." — 이메일은 바뀔 수 있어서 식별자로 쓰지 말라고 못박아 뒀다. ([OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect))
- `USER.EMAIL` 은 식별자가 아니라 **연락처**. **첫 가입한 제공자의 이메일**을 넣는다. 자유 입력 수정은 PRD 대로 없고, 제공자를 둘 이상 연결한 뒤 그중 하나로 바꾸는 것만 허용 — [미확정](#미확정-팀-결정).
- 제공자 `name` 은 **저장 안 한다.** 로그인 응답에 실어 온보딩 닉네임 칸 초기값으로만 쓴다. 사이트에서 부르는 이름은 `NICKNAME` 하나면 되고, 실명은 안 갖고 있는 게 낫다.
- 같은 `sub` 가 동시에 두 번 들어와 4 에서 INSERT 가 겹치면 UNIQUE 에 걸린다 → 재조회해서 2 로 태운다.

## 온보딩 입력

- **이용약관** — 필수. `true` 아니면 거부. `ACCOUNT_CONSENT` `TERMS_OF_SERVICE`
- **개인정보 수집·이용** — 필수. `true` 아니면 거부. `ACCOUNT_CONSENT` `PRIVACY_POLICY`
- **마케팅 수신** — 선택. `ACCOUNT_CONSENT` `MARKETING`. 거부해도 `AGREED=false` 행을 남긴다
- **닉네임** — 필수. trim 후 2~20자, **중복 불가**(이미 쓰는 닉네임이면 거부). `USER.NICKNAME`
- **타임존** — 필수. IANA ID (`ZoneId.of()` 통과). `USER.TIME_ZONE`

약관 버전은 클라이언트가 안 보낸다. **서버가 현재 게시 버전을 붙인다.**
초기값 — 닉네임=제공자 `name`, 타임존=브라우저 `Intl.DateTimeFormat().resolvedOptions().timeZone`. 편의일 뿐, 검증은 똑같이 탄다. DB 의 임시 닉네임(`user_<랜덤>`)은 화면에 안 보여준다 — 온보딩에서 반드시 정한다.
하나라도 실패하면 아무것도 저장 안 하고 필드별 오류.

## 미완료 사용자가 할 수 있는 것

`ONBOARDING_COMPLETED_AT IS NULL` 이면 온보딩·내 정보 조회·로그아웃·약관 열람만.

- 프론트: 로그인 필요한 페이지 들어오면 `/[locale]/onboarding` 으로 보낸다. 비회원 공개 범위(목록·상세)는 그대로.
- 백엔드: 회원 기능 API(신청·출석·마이페이지 수정…)는 미완료면 403. 프론트 가드만 믿지 않는다.

## 완료 처리와 이벤트

완료 처리는 **한 트랜잭션**이다 — 닉네임·타임존·완료 시각 저장과 약관 동의 3행 저장이 한 묶음. 하나만 저장되고 하나는 실패하는 상태는 없다.

- **중복 방지 기준 = `ONBOARDING_COMPLETED_AT` 이 NULL → 값으로 바뀐 그 요청.** 완료 시각은 "아직 NULL 인 경우에만" 채우고, 실제로 바뀐 요청에서만 이벤트를 낸다. 이미 완료된 사람이 또 요청하거나 두 탭에서 동시에 눌러도 DB 가 한 쪽만 통과시키니 USER 당 1회. 나중에 애플 IDENTITY 가 붙어도 마찬가지. `sub` 기준으로 잡으면 IDENTITY 가 둘일 때 두 번 나갈 수 있어 USER 기준.
- 이벤트는 저장이 확정된 **커밋 후**에 낸다 — 저장 실패했는데 웰컴메일 나가는 일 방지.
- 페이로드는 `userId` 뿐. 마케팅 동의 여부 등은 알림팀이 `ACCOUNT_CONSENT` 에서 읽는다. 사용자 기능은 SES 를 직접 안 부른다.
- 완료된 사용자가 또 부르면 변경 없이 성공 (멱등). 닉네임·타임존 수정은 마이페이지 API (닉네임 중복 검사는 거기서도 같이).


**USER**

- `NICKNAME` — `NOT NULL` 그대로. 로그인 직후엔 `user_<랜덤>` 임시값을 넣고 온보딩에서 정한다. **`UNIQUE(NICKNAME)` 추가** — 임시값이 겹치면 다시 생성
- `ONBOARDING_COMPLETED_AT` — **추가**, `DATETIME NULL`. NULL = 미완료. 이벤트 1회 기준
- `TIME_ZONE` — 온보딩시 정함. NULL 가능 
- `NAME` — 안 만든다. 굳이 실명을 써야할 이유가 없음

**IDENTITY** — 그대로. `UNIQUE(ISSUER, PROVIDER_USER_ID)` 가 곧 "googleSub unique". 미확정이던 `PROVIDER_EMAIL` 은 **넣자** — 제공자가 준 이메일 원본. 애플 중계 이메일이 들어오면 어디서 뭐가 왔는지 이걸로 본다. `EMAIL_VERIFIED` 는 가입 조건이 `true` 강제라 항상 `true` → 불필요.


## 그외 - 애플 붙일 때

애플을 붙일 때 DB·온보딩을 다시 뜯지 않도록 미리 정해 둔 두 가지 —

**온보딩 전 `NICKNAME` 을 NULL 로 허용하나 → 아니오. `NOT NULL` 유지.** 
- 로그인 직후엔 `user_<랜덤>` 임시값을 넣고, 온보딩에서 사용자가 직접 정한다.
- NULL 을 허용하면 명부·후기 등 닉네임을 보여주는 모든 화면이 "닉네임 없는 회원" 을 따로 처리해야 한다.
- 제공자 이름을 닉네임에 넣는 것도 안 된다. 구글은 이름을 매번 주지만 애플은 첫 로그인에만 준다. 그러면 구글 / 애플 첫 로그인 / 애플 재로그인이 다 다르게 갈린다. 임시값을 넣으면 제공자가 뭐든 똑같이 흐른다.
- "USER 를 온보딩 완료 때 만들면 되지 않나" — 그러면 온보딩 화면에서 저장 요청을 보낼 때 서버가 누구 요청인지 알 수 없다. 토큰에는 USER ID 를 담는데 USER 가 아직 없으니까. "아직 회원이 아닌 사람용 임시 토큰" 을 따로 설계해야 해서 더 복잡하다.

**애플 비공개 중계 주소(`@privaterelay.appleid.com`)를 `USER.EMAIL` 로 인정하나 → 예. 그대로 저장.** 
- 식별은 `sub` 라 이메일이 뭐든 로그인엔 영향 없고, 중계 주소도 애플이 실제 메일함으로 전달해 주니 연락처로 유효하다. 
- 원본은 `IDENTITY.PROVIDER_EMAIL` 에 남는다. 단 구글 이메일과 달라 구글 계정이 있어도 안 묶인다 → 별개 USER, 명시적 연결(후속). 다른 길인 "중계 주소면 가입 거부" 는 '이메일 가리기' 를 쓰는 애플 사용자를 통째로 못 받는다. 
- 제공자가 둘 이상 연결되면 `USER.EMAIL` 은 첫 가입 제공자 것이 그대로다. 애플(중계)로 먼저 가입하고 구글을 연결하면 진짜 주소를 알면서도 알림이 중계로 나가니, **연결된 IDENTITY 의 `PROVIDER_EMAIL` 중 하나를 대표로 고르는 것**은 허용. 검증된 주소 중 선택이라 아무 주소나 넣는 걸 막는 PRD 취지와 안 부딪히고, 인증 메일도 필요 없다. MVP 는 구글만이라 선택 UI 없음 — 애플과 같이.

애플 문서 ([Authenticating users with Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple)):

> "The API collects this information and shares it with your app the first time the user logs in using Sign in with Apple."
> "Although Apple provides the user's email address in the identity token on all subsequent API responses, it doesn't include other information about the user, such as their name."

- 이름은 **첫 로그인에만** 온다 → 저장 안 하니 무관. 첫 로그인에서 온보딩 안 끝내고 나가면 다음엔 닉네임 칸 초기값이 빈칸 — 어차피 온보딩에서 정해야 하니 그냥 둔다.
- 이메일은 **매번** 온다 → "이메일 없음" 거부에 걸릴 일이 사실상 없다.
- '이메일 가리기' 면 중계 주소가 온다 → 위에서 정한 대로 그대로 저장.

## 미확정 (팀 결정)

- **완료 후 어디로** — 홈, `next` 있으면 `next`. 마이페이지로 보내 프로필 이미지 유도하는 안도 있다.
- **`USER.EMAIL` 변경** — 자유 입력은 PRD 대로 안 함. 대신 **연결된 제공자 이메일 중 선택**은 허용하자는 제안 (애플 절 참고). 안 하면 애플(중계) 먼저 가입한 사람은 구글을 연결해도 알림을 영영 중계로 받는다. 자유 입력을 열려면 `UNIQUE(EMAIL)` 충돌 + 변경 인증 메일이 따라온다.

## 한계 / 후속

- **탈퇴** 시 USER·ACCOUNT_CONSENT·IDENTITY 처리 — PRD 미정, 별도 스펙. ERD 원칙대로면 삭제 대신 `REMOVED_AT`.
- **약관 문안·버전 출처** 미정 — `POLICY_VERSION` 을 설정으로 둘지 테이블로 둘지는 구현 때.
- 약관 개정 **재동의** 흐름 없음. 버전은 남으니 나중에 구버전 동의자는 골라낼 수 있다.
- 구글·애플 **명시적 연결**(마이페이지 "계정 연결") — 애플과 같이.
- 프로필 이미지·마이페이지 수정 API 는 별도.
- 웰컴메일 실패 재시도는 알림팀. 여기선 "1회 발행" 까지.
