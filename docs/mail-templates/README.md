# 메일 템플릿 시안

알림 메일 문구의 **정본은 DB**(`NOTIFICATION_TEMPLATE`)다. 시안 HTML 은 **playground 안**
[`proto/mail/templates/`](../../frontend/apps/playground/src/proto/mail/templates/) 에 두고, 디자이너는 playground 「운영 콘솔 → 알림 → 알림 템플릿」(`/proto/console/notifications/templates`)의 추가·수정 팝업에서 HTML 을 고치며 미리 본다.
웰컴메일 시안은 오너 승인 후 `V38__user_registered_email_html.sql` 로 적용했다(아래 「적용」).

| 템플릿 | 언제 | 제목 | 치환 변수 | 시안 원본 |
|---|---|---|---|---|
| `USER_REGISTERED` · `EMAIL` | 회원가입 직후 즉시 | `[StudyClub] 회원가입을 환영합니다` | `{{nickname}}` | [user-registered-email.html](../../frontend/apps/playground/src/proto/mail/templates/user-registered-email.html) |
| `STUDY_NOTICE` · `EMAIL` | 네비게이터가 반 공지를 보낼 때 | `[StudyClub] {{studyTitle}} 공지` | `{{studyTitle}}` `{{groupName}}` `{{senderName}}` `{{title}}` `{{body}}` | [study-notice-email.html](../../frontend/apps/playground/src/proto/mail/templates/study-notice-email.html) |
| `FEEDBACK_REPLIED` · `EMAIL` | 문의에 첫 답변을 등록할 때 (수정은 제외) | `[StudyClub] 문의에 답변이 등록됐어요` | `{{nickname}}` `{{feedbackUrl}}` | [feedback-replied-email.html](../../frontend/apps/playground/src/proto/mail/templates/feedback-replied-email.html) |

- 시안 원본은 `{{nickname}}` 이 그대로 있는 **DB 에 들어갈 본문**이다. 제목·치환 변수는 위 표를 참고한다
- 추가·수정 팝업의 **본문 편집 → 미리보기**로 HTML 을 확인한다. 치환 변수는 예시 값으로 바꾸지 않고 원문 그대로 표시한다. 회원가입·문의 회신 시안은 기본 예시로 불러오며, 다른 시안은 본문 편집 칸에 붙여 넣어 확인할 수 있다
- 프로토에서 추가·저장한 내용은 현재 화면에서만 유지되고 새로고침하면 사라진다. 반영할 HTML 은 본문 편집 칸에서 복사해 시안 파일에 붙여 PR 을 낸다
- playground 는 DB 를 읽지 않는다. DB 에 지금 무엇이 있는지는 백오피스 「알림 템플릿」에서 본다

문의 회신 시안은 가입메일의 카드·버튼 디자인을 사용한다. 답변 본문·첨부 이미지·캡틴 메모는 메일에 넣지 않고, 로그인 후 해당 문의의 답변을 확인하도록 안내한다. `{{feedbackUrl}}` 은 `NOTIFICATION_SITE_BASE_URL` 과 `/ko/my/feedbacks/{id}` 로 만든 전체 URL 이다. `V48__feedback_replied_email.sql` 이 같은 HTML을 등록하고, 첫 회신 트랜잭션에서 알림을 예약한다.

## 제목 규칙

모든 알림 메일 제목은 **`[StudyClub] 무엇`** 이다.

| 좋다 | 나쁘다 | 왜 |
|---|---|---|
| `[StudyClub] 회원가입을 환영합니다` | `StudyClub에 오신 걸 환영합니다` | 받은편지함 목록에서 보낸 곳이 맨 앞에 와야 한다 |
| `[StudyClub] DDIA 2판 신청이 접수됐어요` | `[StudyClub] 안내` | 「무엇」은 열기 전에 내용을 알 수 있게 — 스터디 이름 같은 구체값을 넣는다 |
| `[StudyClub] 내일 20:30 첫 모임이 있어요` | `[StudyClub] 🔔 중요!! 꼭 확인` | 이모지·느낌표·「중요」 는 스팸 점수를 올린다 |

- 대괄호 안은 서비스 이름 **`StudyClub` 고정** — 기능명(`[출석]`)·환경명(`[stage]`)을 넣지 않는다
- 「무엇」은 40자 안 · 마침표 없음 · 해요체/합니다체는 본문과 맞춘다
- 치환 변수(`{{studyTitle}}` 등)는 「무엇」 안에만 쓴다 — 제목은 이스케이프하지 않는 텍스트다
- HTML 본문의 `<title>` 도 제목과 같은 문자열로 둔다

## 본문 — 가입메일을 기준으로 쓴다

새 메일은 **[user-registered-email.html](../../frontend/apps/playground/src/proto/mail/templates/user-registered-email.html) 를 복사해서** 시작한다 — 같은 폴더에 새 파일을 두고 위 시안 목록에 제목·치환 변수·파일 링크를 추가한다. HTML 은 알림 템플릿 팝업에 붙여 넣어 미리 본다. 구조를 새로 짜지 않는다.

```
워드마크 (ink, 18px 굵게)  ← 그대로
┌ 카드 (상단 4px primary 줄) ┐
│ 라벨 (primary, 13px)       │ ← 「회원가입 완료」 처럼 이 메일의 종류
│ 제목 (ink, 24px, 굵게)      │ ← 인사 + 핵심 한 줄
│ 본문 (secondary, 16px)      │
│ [버튼 하나] (primary, 16px) │ ← 행동은 하나만. 두 번째는 본문 링크로
│ ─ 구분선 ─                  │
│ 문의 · 서명 (14px)          │
└────────────────────────────┘
수신 사유 고지 (12px)        ← 그대로, 내용만 이 메일에 맞게
```

- preheader(받은편지함 미리보기 문구, 숨김 div)를 반드시 채운다 — 비워 두면 본문 첫 줄이 미리보기로 나간다
- 버튼은 표 셀로 그린 버튼만 쓴다(이미지 버튼 금지)
- 트랜잭션 메일(가입·신청·출석)에는 홍보 문구를 넣지 않는다

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
- 새 템플릿을 HTML 로 만들 때도 같은 순서다: playground `templates/` 에 시안 → 알림 템플릿 팝업의 미리보기로 확인 → `V{n}` 마이그레이션(작은따옴표는 두 번)

## 문의 회신 배포

- `NOTIFICATION_SITE_BASE_URL` 을 명시하면 그 주소가 우선한다. 없으면 기존 `APP_ENV` 에 따라 로컬(`local`, 미설정 포함) `http://localhost:4700`, stage `https://stage.studyclub.life`, 운영(`production`) `https://studyclub.life` 를 사용한다. 다른 환경 이름은 주소를 명시해야 한다. 프로토의 localhost:4713 주소를 넣지 않는다.
- #373 문의 구현이 전제다. 기존 V41 이 반 공지 마이그레이션과 충돌하여 미병합 문의 스키마를 `V47__feedback.sql` 로 옮겼다. V46 은 같은 조건의 복수 템플릿이다.
- Flyway 를 쓰는 환경은 V47·V48 을 적용한다. stage 는 Hibernate 가 문의 테이블을 만들고, `backend/notification/src/main/resources/db/migration/V48__feedback_replied_email.sql` 을 한 번 실행해 템플릿을 등록한다. 또는 백오피스 알림 템플릿에서 「문의 회신」 조건으로 같은 제목·HTML을 등록한다. 기존 문의 회신 템플릿이 있으면 중복 등록하거나 덮어쓰지 않는다.
- HTML과 기존 메일 클라이언트의 일반 텍스트 대체본을 함께 보낸다. 과거 문의를 대상으로 알림을 생성하는 작업은 없다.
