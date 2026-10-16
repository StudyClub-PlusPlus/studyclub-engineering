# 메일 템플릿 시안

알림 메일 문구의 **정본은 DB**(`NOTIFICATION_TEMPLATE`)다. 이 폴더는 DB 에 넣기 전 디자인 시안을 두는 곳이다.
지금 DB 에는 아무것도 바뀌지 않았다 — 오너 리뷰가 끝나면 아래 「적용할 때」대로 마이그레이션을 쓴다.

| 템플릿 | 언제 | 치환 변수 | 시안 원본 | 미리보기 (예시 값 채움) |
|---|---|---|---|---|
| `USER_REGISTERED` · `EMAIL` | 회원가입 직후 즉시 | `{{nickname}}` | [user-registered-email.html](user-registered-email.html) | [after](preview/user-registered-email.html) · [before](preview/user-registered-email.before.html) |

- 시안 원본은 `{{nickname}}` 이 그대로 있는 **DB 에 들어갈 본문**이다. `preview/` 는 그걸 `스터디메이트` 로 채운 것이다
- `before` 는 지금 DB 본문(V14 시딩)을 `text/plain` 으로 보낸 모습을 재현한 것이다
- 실제 DB 에 있는 템플릿을 고르고 예시 값을 바꿔 보는 화면은 playground `/proto/mail` 이다

## 시안 규칙 (메일 클라이언트 호환)

- 표(`<table>`) 레이아웃 · 모든 스타일 인라인 · 폭 600px(좁은 화면은 100%). `<style>` 블록에 기대지 않는다 — 네이버 메일·일부 Gmail 뷰가 지운다
- 글꼴은 웹폰트를 쓰지 않는다: `-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', sans-serif`
- 색은 디자인 토큰(`frontend/packages/design/tokens.css`)의 값을 그대로 옮긴다 — primary `#5267D8`, ink `#282A43`, secondary `#626476`, border `#E2E1E9`, 바탕 `#F5F7FF`
- 로고는 이미지 대신 글자 워드마크 — 이미지 차단이 기본인 메일함에서도 보인다
- 라이트 고정(`color-scheme: light`)

## 적용할 때 (아직 하지 않음)

본문만 바꾸면 **깨진다.** 아래 세 가지를 한 PR 에 같이 넣는다.

1. **`SesMailClient` 가 HTML 을 보내게** — 지금은 `Body.text(...)` 만 채운다(`backend/notification/.../mail/SesMailClient.java`).
   HTML 본문을 그대로 넣으면 받는 사람에게 태그가 글자로 보인다. `Body.html(...)` 을 채우고, 텍스트 대체본도 같이 보낸다(스팸 점수·텍스트 전용 메일함).
2. **치환 값 HTML 이스케이프** — `NotificationTemplateRenderer` 는 값을 그대로 끼운다. 닉네임은 길이(20자)만 자르고 문자 제한이 없어서
   `<a href=…>` 같은 닉네임이 메일 안에서 링크가 된다. HTML 본문에 넣을 때는 `& < > " '` 를 이스케이프한다.
3. **백오피스 템플릿 상세** — 지금 본문을 `<pre>` 로 보여 준다(`notification-templates/[id]/page.tsx`). HTML 이 되면 태그 덩어리로 보이므로
   샌드박스 iframe 미리보기로 바꾼다 (playground `/proto/mail` 과 같은 방식).

마이그레이션 초안 — 번호는 머지 직전 최신 `V*` 다음으로 매긴다(2026-10-16 기준 마지막 `V37`):

```sql
-- V38__user_registered_email_html.sql
UPDATE NOTIFICATION_TEMPLATE
   SET BODY = '<!DOCTYPE html>…(user-registered-email.html 전문, 작은따옴표는 두 번)…',
       UPDATED_AT = UTC_TIMESTAMP(6)
 WHERE EVENT_TYPE = 'USER_REGISTERED'
   AND CHANNEL = 'EMAIL';
```

- 텍스트 대체본을 어디 둘지는 정해야 한다 — `BODY_TEXT` 컬럼 추가 vs HTML 에서 태그를 걷어 자동 생성. 컬럼을 늘리면 운영자가 두 벌을 맞춰야 한다
- **stage 는 Flyway 가 꺼져 있다**(Hibernate `update`). 위 UPDATE 는 stage DB 에 손으로 한 번 돌린다
