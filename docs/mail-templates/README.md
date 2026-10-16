# 메일 템플릿 시안

알림 메일 문구의 **정본은 DB**(`NOTIFICATION_TEMPLATE`)다. 이 폴더는 DB 에 넣기 전 디자인 시안을 두는 곳이다.
웰컴메일 시안은 오너 승인 후 `V38__user_registered_email_html.sql` 로 적용했다(아래 「적용」).

| 템플릿 | 언제 | 치환 변수 | 시안 원본 | 미리보기 (예시 값 채움) |
|---|---|---|---|---|
| `USER_REGISTERED` · `EMAIL` | 회원가입 직후 즉시 | `{{nickname}}` | [user-registered-email.html](user-registered-email.html) | [after](preview/user-registered-email.html) · [before](preview/user-registered-email.before.html) |

- 시안 원본은 `{{nickname}}` 이 그대로 있는 **DB 에 들어갈 본문**이다. `preview/` 는 그걸 `스터디메이트` 로 채운 것이다
- `before` 는 V38 이전 DB 본문(V14 시딩)을 `text/plain` 으로 보낸 모습을 재현한 것이다
- 실제 DB 에 있는 템플릿을 고르고 예시 값을 바꿔 보는 화면은 playground `/proto/mail` 이다

## 시안 규칙 (메일 클라이언트 호환)

- 표(`<table>`) 레이아웃 · 모든 스타일 인라인 · 폭 600px(좁은 화면은 100%). `<style>` 블록에 기대지 않는다 — 네이버 메일·일부 Gmail 뷰가 지운다
- 글꼴은 웹폰트를 쓰지 않는다: `-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', sans-serif`
- 색은 디자인 토큰(`frontend/packages/design/tokens.css`)의 값을 그대로 옮긴다 — primary `#5267D8`, ink `#282A43`, secondary `#626476`, border `#E2E1E9`, 바탕 `#F5F7FF`
- 로고는 이미지 대신 글자 워드마크 — 이미지 차단이 기본인 메일함에서도 보인다
- 라이트 고정(`color-scheme: light`)

## 적용 (2026-10-16 · V38)

HTML 본문은 아래 세 가지와 **같이** 나가야 깨지지 않는다 — 한 PR 에 넣었다. 규칙 정본은 [notification 스펙 §본문 형식](../../specs/notification/spec.md#본문-형식--html--텍스트-대체본).

1. **발송기 multipart** — `SesMailClient` 는 본문이 `<` 로 시작하면 `Body.html` + `Body.text`(태그를 걷은 대체본, `MailBody.toPlainText`)를 보낸다
2. **치환 값 HTML 이스케이프** — `NotificationTemplateRenderer` 가 HTML 템플릿이면 `& < > " '` 를 이스케이프해서 끼운다
3. **백오피스 템플릿 상세** — HTML 본문은 샌드박스 iframe 으로 보여 준다(텍스트 본문은 기존 `<pre>`)

- **stage 는 Flyway 가 꺼져 있다**(Hibernate `update`). V38 이 돌지 않으므로 같은 본문을 손으로 한 번 넣는다 — stage 에는 V14 시딩도 안 돌아
  행 자체가 없으므로 "없으면 INSERT, 있으면 UPDATE" 로 쓴다
- 새 템플릿을 HTML 로 만들 때도 같은 순서다: 이 폴더에 시안 → playground `/proto/mail` 로 확인 → `V{n}` 마이그레이션(작은따옴표는 두 번)
