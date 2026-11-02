# 웹 푸시 — 이 기기에서 알림 받기 · 백오피스 푸시 보내기

> ERD: [WEB_PUSH_SUBSCRIPTION](../../docs/erd/WEB_PUSH_SUBSCRIPTION.md) · 아웃박스는 [NOTIFICATION](../../docs/erd/NOTIFICATION.md)
> 관련: [notification/spec.md](../notification/spec.md) (같은 아웃박스·폴러·발송 이력·재발송) · [user-leave/spec.md](../user-leave/spec.md) (탈퇴 시 구독 삭제)
> 흐름 그림: [docs/flows/web-push.md](../../docs/flows/web-push.md)
> 생성일: 2026-11-03 · 상태: 구현완료 (stage 확인 전)

## 미리 알아야 할 것

- **웹 푸시**: 앱 없이 브라우저가 받는 알림. 사이트를 닫아 둬도 휴대폰·PC 알림으로 뜬다.
- **구독(PushSubscription)**: 브라우저가 "이 주소로 보내면 이 기기에 간다" 고 내주는 주소(`endpoint`)와 암호화 키 두 개(`p256dh`, `auth`).
  주소는 구글·애플·모질라의 **푸시 서버**를 가리킨다. 우리는 그 서버에 암호화한 알림을 맡기고, 푸시 서버가 기기에 배달한다.
- **VAPID 키**: "이 알림은 StudyClub 서버가 보낸 것" 을 증명하는 키 한 쌍. 공개키는 브라우저가 구독할 때 쓰고, 개인키는 서버만 갖는다.
  FCM·애플 개발자 계정이 필요 없다.
- **iPhone 은 홈 화면에 추가해야만 받는다** (iOS 16.4+). 사파리 탭에서는 알림을 켤 수 없다. 카카오톡 안 브라우저는 지원하지 않는다.
- 비유: 구독은 **기기별 우편함 주소**다. 우편함은 기기마다 따로라 휴대폰과 PC 에서 각각 켜야 한다.

## 범위

| 한다 | 안 한다 |
|---|---|
| 사이트 마이페이지에서 이 기기 알림 켜기·끄기 | 이벤트별 자동 푸시(공지·문의 회신 등) — 템플릿 채널을 열면 같은 길로 붙는다 |
| 백오피스에서 캡틴이 직접 보내기 (나에게 · 구독자 전체) | 대상 고르기(스터디·반·회원 지정), 예약 발송 |
| 발송 이력·실패 재발송은 메일과 같은 화면 | 수신자 기기 정보 저장(브라우저·OS) |
| 홈 화면 설치(manifest) | 오프라인 캐시 |

## API

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | `/api/web-push/config` | `{enabled, publicKey}`. 키가 없으면 `enabled=false, publicKey=null` | X | 구현완료 |
| PUT | `/api/me/web-push-subscription` | 이 기기 구독. 본문은 `{endpoint, keys:{p256dh, auth}}` (브라우저 `subscription.toJSON()` 그대로). 같은 주소면 덮어쓴다. 204 | O (`@RequireOnboarding`) | 구현완료 |
| DELETE | `/api/me/web-push-subscription` | `{endpoint}`. 내 구독이 아니거나 없으면 아무것도 안 하고 204 | O (`@RequireOnboarding`) | 구현완료 |
| GET | `/api/admin/web-push` | `{enabled, subscriptions, accounts, mySubscriptions}` | O (`@RequireAdmin`) | 구현완료 |
| POST | `/api/admin/web-push/send` | `{audience: SELF\|ALL, title(≤60), body(≤200), url?}` → 202 `{queued}`. 받을 기기가 없으면 409 | O (`@RequireAdmin`) | 구현완료 |

### 판정·검증

- **구독 주소는 브라우저 회사 푸시 서버만 받는다** — `fcm.googleapis.com` · `*.push.services.mozilla.com` · `*.push.apple.com` · `*.notify.windows.com`,
  https, 기본 포트. 그 밖은 400. 서버가 이 주소로 요청을 보내므로 아무 주소나 받으면 로그인한 누구나 서버가 내부망을 찌르게 만들 수 있다(SSRF).
- `url` 은 `/` 로 시작하는 사이트 안 경로만(`//` 는 안 됨). 알림을 누른 사람을 밖으로 보내지 않는다. 서비스 워커도 한 번 더 거른다.
- 키가 비어 있으면 구독(PUT)·보내기(POST)는 409 `CONFLICT` 「웹 푸시가 꺼져 있습니다」.

## 처리 흐름

```
[브라우저] 알림 켜기 클릭 → 권한 허용 → /sw.js 등록(scope /push/) → pushManager.subscribe(VAPID 공개키)
     ↓ PUT /api/me/web-push-subscription
[WEB_PUSH_SUBSCRIPTION] 주소 해시로 한 행
     ↓ 캡틴: POST /api/admin/web-push/send
[NOTIFICATION] 구독마다 EVENT_TYPE=ADMIN_PUSH, RECIPIENT_TYPE=WEB_PUSH, RECIPIENT_VALUE=구독 ID, PENDING
     ↓ 폴러(30초) — 메일과 같은 클레임·재수거
WebPushDispatcher: 템플릿 렌더 → JSON {title, body, url} → RFC 8291 암호화 → VAPID 서명 → 푸시 서버 POST
     ↓ 2xx SENT · 404/410 구독 삭제 + FAILED(INVALID_RECIPIENT) · 그 밖 FAILED(PROVIDER_ERROR)
[서비스 워커] push → showNotification · notificationclick → 그 경로 열기
```

- 서비스 워커 범위를 `/push/` 로 좁힌다 — 개발 모드의 MSW 워커(scope `/`)와 겹치지 않고 페이지 요청을 가로채지 않는다. 푸시는 범위와 무관하게 온다.
- 암호화·서명은 **JDK 표준만** 쓴다(`WebPushCrypto`). RFC 8291 부록 예제와 바이트 단위로 맞는지 테스트가 확인한다. 외부 라이브러리를 들이지 않았다(AGENT.md).
- `TTL` 24시간 — 기기가 하루 동안 꺼져 있으면 푸시 서버가 버린다.

## 데이터 모델

`WEB_PUSH_SUBSCRIPTION` — [ERD](../../docs/erd/WEB_PUSH_SUBSCRIPTION.md). `NOTIFICATION` 은 컬럼을 더하지 않았다:
`RECIPIENT_TYPE` 에 `WEB_PUSH`, `EVENT_TYPE` 에 `ADMIN_PUSH` 값이 늘었을 뿐이다.

템플릿 `ADMIN_PUSH`·`WEB_PUSH` 한 건을 V56 이 시딩한다 — 제목 `{{title}}`, 본문 `{{body}}`. **stage 는 Flyway off 라 V56 의 INSERT 를 한 번 손으로 적용한다.**
템플릿이 없으면 보내기가 500 이다.

발송 이력 응답의 `recipientValue` 는 웹 푸시면 「기기 #<구독 ID>」 — 기기 정보는 주지 않는다.

## 탈퇴

`DELETE /api/me` 가 그 사람의 구독을 전부 지운다. 이미 만든 알림 행은 메일과 같이 비식별화·취소된다.

## 설정

| 키 | 환경변수 | 설명 |
|---|---|---|
| `notification.web-push.public-key` | `WEB_PUSH_VAPID_PUBLIC_KEY` | base64url, 65바이트 비압축 P-256 공개키 |
| `notification.web-push.private-key` | `WEB_PUSH_VAPID_PRIVATE_KEY` | base64url, 32바이트 |
| `notification.web-push.subject` | `WEB_PUSH_VAPID_SUBJECT` | `mailto:` 운영 주소 — 푸시 서버가 문제 있을 때 연락한다 |

키 만들기: `npx web-push generate-vapid-keys`. 값은 내부 시크릿 저장소에만 둔다(PUBLIC 레포). **환경마다 다른 키**를 쓴다 —
키를 바꾸면 그 전 구독은 전부 못 쓰게 된다(다시 켜야 한다).
