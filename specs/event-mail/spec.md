# 행사 메일 API Spec: 안내 메일 · 취소 안내 메일 · 메일 이력 · 행사 알림 템플릿

> ERD: 새 테이블 `EVENT_MAIL` · `EVENT_MAIL_RECIPIENT` 는 아래 「데이터 모델 제안」이 초안이다. 기존: [NOTIFICATION](../../docs/erd/NOTIFICATION.md), [NOTIFICATION_TEMPLATE](../../docs/erd/NOTIFICATION_TEMPLATE.md), [ACCOUNT](../../docs/erd/ACCOUNT.md). 행사·신청은 [event](../event/spec.md#데이터-모델-제안) · [event-participant](../event-participant/spec.md#데이터-모델-제안-club_event_registration)
> 생성일: 2026-11-18 · 리뷰 반영: 2026-11-19 (PR #479 리뷰 M1~M7 · 재발송 상태 검증 · 탈퇴·메일 예약 동시성)
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 행사를 등록하고 신청자의 참가를 확정할 수 있다](../../01-planning/stories/captain-manage-events/PRD.md) (ST-037) §1 · §6 · §7 「메일 이력」 M2 · M4 · §7-1 「안내 메일 작성·미리보기」 M1 · M3 · M5 · M6 · 「후속 구현 합의」 M7
> - 경계: [크루는 행사에 신청하고 참가 확정 상태를 확인할 수 있다](../../01-planning/stories/crew-apply-event/PRD.md) (ST-038) §4 · §5 — 자동 메일의 시간대·참여 링크 규칙
>
> 기준 스펙: [notification](../notification/spec.md) (템플릿 · 발송 이력 · 폴러) · [study-notice](../study-notice/spec.md) (운영자가 여러 명에게 보내는 메일의 선례: `BEFORE_COMMIT` 아웃박스 · 수신자 스냅샷) · [domain-events](../domain-events/spec.md) · [event](../event/spec.md) · [event-status](../event-status/spec.md) · [event-participant](../event-participant/spec.md)
> 기준 프로토타입: playground `/proto/console/events/{id}` (`EventMailComposer.tsx` · `EventAdminDetail.tsx` 메일 이력 탭) · `/proto/console/notifications/templates` (행사 알림 조건)
> 판정·렌더링 로직의 근거: `frontend/apps/playground/src/proto/events/model.ts` (`renderEventNoticePreview` · `renderEventNotice` · `renderAutomaticEventMail` · `createEventNoticeMail` · `fillLegacyEventMailPreview` · `validateEventTemplate` · `transition` MAIL · CANCELLATION_MAIL) · 메일 시안 [event-announcement-email.html](../../frontend/apps/playground/src/proto/mail/templates/event-announcement-email.html) · 기본 문구 `frontend/packages/mock/src/data/event-preview.ts` (`EVENT_NOTICE_TEMPLATE` · `EVENT_CANCELLATION_TEMPLATE` · `EVENT_STATUS_TEMPLATES`) · [메일 템플릿 README](../../docs/mail-templates/README.md)

## 엔드포인트 목록

**백오피스: `/api/admin/events/{eventId}/mails` (`AdminClubEventMailController` 제안, 캡틴만)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| POST | /api/admin/events/{eventId}/mails/preview | 작성 창의 공통 미리보기: 템플릿을 적용한 제목·본문(닉네임만 원문) · 받는 사람 수 · 보낼 수 있는지. 저장하지 않는다 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/events/{eventId}/mails | 안내 메일 · 취소 안내 메일 보내기: 발송 작업 1건 + 수신자 스냅샷 + 수신자별 `NOTIFICATION` 행 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/events/{eventId}/mails | 메일 이력 탭: 운영자가 보낸 메일만, 최신순 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/events/{eventId}/mails/{mailId} | 메일 이력 상세: 발송 당시 제목·본문 · 대상 · 마스킹된 받는 사람 | O (ADMIN) | 스펙작성중 |

자동 메일(신청 상태 알림 4종)은 엔드포인트가 없다. 다른 스펙의 처리가 발행하는 도메인 이벤트를 이 스펙의 구독자가 받아 `NOTIFICATION` 행을 만든다 (아래 「자동 메일: 신청 상태 알림」). 템플릿 관리는 기존 `/api/admin/notification-templates` 를 그대로 쓴다.

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 먼저 읽을 것

### 메일 여섯 종류

PRD §7 은 메일을 **운영자 안내**와 **자동**으로 나눈다. 둘 다 같은 `NOTIFICATION` 아웃박스와 폴러로 나가지만, 메일 이력 탭에는 운영자 안내만 보인다.

| 알림 조건 (`NotificationEventType`) | 구분 | 언제 | 받는 사람 | 이력 탭 |
|---|---|---|---|---|
| `EVENT_ANNOUNCEMENT` | 운영자 안내 | 캡틴이 `안내 메일 보내기` | 그 행사의 참가 확정자 전체 또는 참여 방식별 | 보인다 |
| `EVENT_CANCELLATION` | 운영자 안내 | 캡틴이 행사 취소 뒤 `취소 안내 메일 보내기` | 취소 직전 확인 대기·참가 확정이던 신청자 ([event-status](../event-status/spec.md#행사-취소가-신청에-하는-일)) | 보인다 |
| `EVENT_REGISTRATION_PENDING` | 자동 | 운영진 확인 방식 행사에 신청 접수 (ST-038) | 신청자 | 안 보인다 |
| `EVENT_REGISTRATION_CONFIRMED` | 자동 | 자동 확정 접수 (ST-038) · 운영진 참가 확정 ([event-participant](../event-participant/spec.md#참가-처리)) · 확정 방식 `REVIEW → AUTO` 일괄 확정 ([event](../event/spec.md#확정-방식-전환-수정의-연관-효과)) | 신청자 | 안 보인다 |
| `EVENT_REGISTRATION_DECLINED` | 자동 | 운영진 참가 불가 · 행사 종료 자동 전환 ([event-participant](../event-participant/spec.md#행사-종료-시-확인-대기-자동-전환)) | 신청자 | 안 보인다 |
| `EVENT_REGISTRATION_CANCELLED` | 자동 | 운영진 개별 취소 · 크루 본인 취소 (ST-038). **행사 전체 취소는 아니다** ([event-status 「취소와 메일」](../event-status/spec.md#취소와-메일-s2)) | 신청자 | 안 보인다 |

- 여섯 값을 `NotificationEventType` 에 더한다. `NOTIFICATION.EVENT_TYPE` · `NOTIFICATION_TEMPLATE.EVENT_TYPE` 은 `VARCHAR(40)` 이라 가장 긴 `EVENT_REGISTRATION_CONFIRMED`(28자)도 들어간다. 스키마 변경 없이 값만 늘어난다
- 프로토 알림 조건 이름(`frontend/apps/playground/src/proto/console/lib/templates.ts` `TRIGGERS`)과 같다: 행사 안내 · 행사 취소 안내 · 행사 참가 확정 · 행사 확인 대기 · 행사 참가 불가 · 행사 신청 취소
- 이력 탭이 운영자 안내만 보이는 근거: PRD §7 「메일 이력 탭에는 운영자가 안내 메일 보내기로 생성한 이력만 표시. 확인 대기·참가 확정·참가 불가·신청 취소 자동 메일은 표시하지 않음」. 자동 메일은 백오피스 「알림 › 발송 이력」(`GET /api/admin/notifications?eventType=EVENT_REGISTRATION_CONFIRMED` 등)에서 본다

### 인가

- [event 「인가」](../event/spec.md#인가) 와 같다. `@RequireAdmin` 으로 캡틴만. 401 · 403 을 404 보다 먼저 본다
- `mailId` 가 그 행사의 것인지 서버가 확인한다. 다른 행사의 `mailId` 는 404

### 시각과 시간대

- 요청·응답의 모든 절대 시각은 UTC ISO 8601
- 메일 본문 안의 일정(`{{eventSchedule}}`)은 **사람이 읽는 현지 시각 문자열**이다. 어느 시간대로 쓰는지는 누가 읽는 본문인지로 갈린다

| 본문 | 시간대 | 근거 |
|---|---|---|
| 작성 창 미리보기 · 이력에 저장하는 공통 본문 | 요청의 `displayTimeZone` → 없으면 보내는 캡틴의 `ACCOUNT.TIME_ZONE` → 없으면 행사 `CLUB_EVENT.TIME_ZONE` | PRD §7-1 「운영자 프로필 시간대로 변환한 일정」 · §7 「운영자 프로필 시간대로 변환」, crew-apply-event §5 「운영진 공통 미리보기는 운영자 시간대」, 프로토 `useDisplayTimeZone()` |
| 수신자 개인별 본문 (안내 · 취소 안내 · 자동 4종) | **발송 예약(`NOTIFICATION` 행)을 만드는 시점**의 수신자 `ACCOUNT.TIME_ZONE` → 없으면 신청의 `APPLICANT_TIME_ZONE` → 없으면 행사 `TIME_ZONE` (M3) | PRD §7-1 M3, crew-apply-event §5 「개인별 메일 일정은 예약 생성 시 현재 프로필 → 신청 당시 시간대 → 행사 시간대 순」 |

- **예약 때 정한 일정 문자열은 고정이다** (M3). `PAYLOAD.eventSchedule` 에 문자열로 저장하고, 이후 수신자가 프로필 시간대를 바꾸거나 실패 건을 재발송해도 다시 계산하지 않는다. 바뀐 프로필은 새로 만드는 메일부터 적용된다
- `displayTimeZone` 허용 값: 회원 시간대([ACCOUNT](../../docs/erd/ACCOUNT.md) `TIME_ZONE` 의 넷)와 행사 시간대(event Q5 의 넷)의 합 — `Asia/Seoul` · `America/Toronto` · `America/New_York` · `America/Vancouver` · `America/Los_Angeles`. 그 밖은 400. 화면의 시간대 선택은 표시만 바꾸고 프로필을 고치지 않는다 (crew-apply-event §2-2 와 같은 원칙)

---

## 렌더링 규칙

미리보기 · 공통 본문 저장 · 수신자별 발송이 모두 이 규칙 하나를 쓴다. 프로토 `renderNoticeValues` · `eventNoticeValues` 를 서버로 옮긴 것이다.

### 쓰는 템플릿

- 행사 여섯 조건 각각에서 `NOTIFICATION_TEMPLATE` 중 **`ID` 가 가장 작은 `EMAIL` 템플릿 한 건**만 쓴다 (`ORDER BY ID ASC LIMIT 1`, M1). 템플릿 선택 UI · 「사용 중」 표시는 두지 않는다. 첫 템플릿이 삭제되거나 다른 조건으로 옮겨지면 남은 템플릿 중 ID 가 가장 작은 것을 쓴다 (PRD §7-1 M1, 프로토 `state.eventTemplates.find(...)` · `appendAutomaticEventMail` 의 `.find(...)`)
- 기존 조건(`USER_REGISTERED` · `STUDY_NOTICE` · `FEEDBACK_REPLIED`)은 지금처럼 같은 조건의 템플릿을 **모두** 보낸다 ([notification 2026-10-30 갱신](../notification/spec.md)). **행사 여섯 조건만 「가장 작은 ID 한 건」으로 다르다.** 그래서 행사 메일은 받는 사람 한 명에 메일 행 하나다. notification 스펙에 이 차이를 적는 일은 구현 PR 에서 한다
- 템플릿 원문은 운영자가 쓴 것이라 이스케이프하지 않는다. 본문이 HTML 인지는 기존 규칙대로 앞 공백을 뺀 뒤 `<` 로 시작하는지로 정한다 (`MailBody.isHtml`, [notification 「본문 형식」](../notification/spec.md#본문-형식--html--텍스트-대체본))

### 치환 변수

| 변수 | 값 | `EVENT_ANNOUNCEMENT` | `EVENT_CANCELLATION` | 자동 4종 |
|---|---|---|---|---|
| `{{nickname}}` | 수신자 `ACCOUNT.NICKNAME`. **공통 미리보기·공통 본문에서는 치환하지 않고 `{{nickname}}` 그대로** | O | O | O |
| `{{eventTitle}}` | `CLUB_EVENT.TITLE` | O | O | O |
| `{{channel}}` | 안내: 대상이 `ALL` 이면 행사 형식 이름(`온라인` · `오프라인` · `온라인·오프라인`), `ONLINE`·`OFFLINE` 이면 그 방식 이름. 수신자별·자동: 그 신청의 참여 방식 이름 | O | — | O |
| `{{eventSchedule}}` | 아래 「일정 문자열」 | O | — | O |
| `{{participation}}` | 아래 「참여 안내 문자열」 | O | — | `CONFIRMED` 만. 그 밖의 자동 3종은 빈 문자열 |
| `{{notice}}` | 운영진이 쓴 안내 내용 (앞뒤 공백 제거) | O | O | — |

- **취소 안내에는 행사명과 안내 내용만 채운다.** 일정·참여 방식·장소·온라인 링크 값을 서버가 아예 만들지 않으므로, 템플릿에 `{{participation}}` 이 있어도 원문 그대로 남을 뿐 장소·링크가 새지 않는다 (PRD §1 「행사명과 취소 안내 내용을 표시」 · §7-1 「참여 링크와 장소는 자동으로 넣지 않음」, crew-apply-event §4 「취소 안내 메일에는 참여 링크가 들어가지 않음」, 프로토 `renderEventNoticePreview` 의 `EVENT_CANCELLATION` 분기)
- **참여 링크는 참가 확정 메일에만 들어간다.** 확인 대기·참가 불가·신청 취소 자동 메일의 `{{participation}}` 은 빈 문자열이다 (crew-apply-event §4 「참가가 확정된 온라인 신청자만 온라인 참여 링크를 볼 수 있음」, 프로토 `renderAutomaticEventMail` `participation: registration.status === 'CONFIRMED' ? … : ''`)
- 표에 없는 변수(`{{foo}}`)는 원문 그대로 남긴다 (기존 `NotificationTemplateRenderer` 동작)

**일정 문자열** (프로토 `eventNoticeValues` · `formatDate` 와 같은 결과)

- 종료 시각이 있으면 `{시작} ~ {종료 + 시간대 약어}`, 없으면 `{시작 + 시간대 약어}`
- 날짜 형식은 `ko-KR` 의 `M월 d일 (요일) HH:mm` (24시간), 약어는 그 시각의 약어. 예: `12월 5일 (금) 19:00 ~ 12월 5일 (금) 22:00 KST`, `11월 28일 (토) 10:00 EST`
- 약어는 프로토 `zoneAbbreviation` 규칙을 따른다: 서울 `KST`, 그 밖은 그 시각의 서머타임 여부에 따른 약어(`EST`·`EDT`·`PST`·`PDT`), 밴쿠버는 프로토 규칙의 약어 (PRD §7 「날짜별 시간대 약어로 표시」, crew-apply-event §2-2 「KST·EST·EDT·PST·PDT 같은 약어」)
- 서버는 같은 입력에 프로토와 같은 문자열을 내는지 테스트로 고정한다 (시간대 넷 × 서머타임 전·후)

**참여 안내 문자열**

| 대상(또는 신청)의 방식 | 값 |
|---|---|
| `OFFLINE` | `CLUB_EVENT_CHANNEL.LOCATION` (오프라인 장소) |
| `ONLINE` | `CLUB_EVENT_CHANNEL.ONLINE_URL`. 비어 있으면 `온라인 참여 링크는 추후 안내드립니다.` |
| 안내 메일 대상 `ALL` + `HYBRID` 행사 (공통 본문만) | `온라인: {온라인 값}\n오프라인: {오프라인 값}` — 온라인 먼저 (PRD §7-1 「전체 대상인 동시 행사는 온라인·오프라인 안내를 함께 표시」) |

- 수신자별 본문은 대상이 `ALL` 이어도 **그 수신자의 참여 방식 하나**로 채운다 (프로토 `renderEventNotice` 가 `recipient.channel` 을 넘긴다). 오프라인 참가자에게 온라인 링크가 가지 않는다

### 치환 방식

- **한 번만 훑어 치환한다** (single-pass). 치환한 값 안의 `{{…}}` 는 다시 치환하지 않는다. 운영진이 안내 내용에 `{{nickname}}` 이라고 직접 써도 그 글자 그대로 나간다 (기존 `NotificationTemplateRenderer.render`, PRD §7-1 「개인별 결과에도 남은 변수 문자열은 운영진 안내 원문일 수 있어 보존」)
- HTML 템플릿이면 값의 `& < > " '` 를 HTML 이스케이프한 뒤 **줄바꿈 `\n` 을 `<br>` 로 바꿔** 끼운다. 텍스트 템플릿이면 값을 그대로 끼운다. 제목은 언제나 텍스트 규칙이다 (프로토 `renderNoticeValues`)
- **기존 렌더러와 다른 곳 두 가지** (구현 PR 에서 렌더러를 고친다):
  1. 줄바꿈 → `<br>`: 지금 `NotificationTemplateRenderer` 는 이스케이프만 하고 줄바꿈을 바꾸지 않는다. 안내 내용·참여 안내는 여러 줄이라 HTML 메일에서 한 줄로 붙는다. 행사 조건에만 켜는 옵션으로 넣어 기존 `STUDY_NOTICE` 메일 모양을 바꾸지 않는다 (공지 본문에도 켤지는 별도 결정)
  2. 공백 허용: 프로토는 `{{ notice }}` 처럼 괄호 안 공백을 허용하고, 서버 렌더러(`\{\{(\w+)}}`)는 허용하지 않는다. 서버 규칙(공백 없음)을 정본으로 두고, 아래 「템플릿 검증」이 공백 있는 변수를 저장 때 거절한다

### 템플릿 검증 (notification 스펙 변경 제안)

지금 `POST` · `PUT /api/admin/notification-templates` 는 조건별 변수를 검사하지 않는다 ([notification 「서버가 조건에 없는 치환 변수를 막지는 않는다」](../notification/spec.md#delete-apiadminnotification-templatesid)). 행사 조건에는 프로토 `validateEventTemplate` · `validateAutomaticEventTemplate` 과 같은 검사를 더하기를 제안한다.

| 조건 | 허용 변수 | 필수 | 실패 |
|---|---|---|---|
| `EVENT_ANNOUNCEMENT` | `nickname` · `eventTitle` · `channel` · `eventSchedule` · `participation` · `notice` | 본문에 `{{notice}}` | 400 `INVALID_INPUT` 「행사 안내 내용이 들어갈 {{notice}}를 본문에 넣어 주세요.」 · 「지원하지 않는 변수입니다: {{…}}」 |
| `EVENT_CANCELLATION` | `nickname` · `eventTitle` · `notice` | 본문에 `{{notice}}` | 같음 |
| `EVENT_REGISTRATION_CONFIRMED` | `nickname` · `eventTitle` · `eventSchedule` · `channel` · `participation` | — | 「지원하지 않는 변수입니다」 |
| `EVENT_REGISTRATION_PENDING` · `_DECLINED` · `_CANCELLED` | `nickname` · `eventTitle` · `eventSchedule` · `channel` | — | 같음 |

- 이 검사가 있으면 취소 안내 템플릿에 `{{participation}}` 같은 변수가 저장될 수 없어, 「취소 안내에 장소·링크를 넣지 않는다」를 템플릿 쪽에서도 막는다
- 기존 세 조건은 검사를 더하지 않는다 (지금 동작 유지)
- 템플릿 API 의 `eventType` 검증은 여섯 값을 새로 받는다. 백오피스 알림 템플릿 화면의 조건 선택에도 여섯 값이 보인다 (프로토 `TRIGGERS`)

---

## 메일 미리보기

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/events/{eventId}/mails/preview`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 작성 창의 「받는 사람 N명」 · 미리보기 탭 · 보내기 버튼 활성을 한 번에 준다. 아무것도 저장하지 않고 잠금도 잡지 않는다. 화면은 창을 열 때 · 대상을 바꿀 때 · 미리보기 탭을 열 때 부른다
- **왜 POST 인가**: 안내 내용(최대 5,000자)을 본문으로 보내야 한다. URL 쿼리에 넣으면 길이 제한과 로그 노출(안내 내용)이 생긴다. 부수효과는 없다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Request Body

```json
{ "type": "ANNOUNCEMENT", "audience": "ALL", "notice": "", "displayTimeZone": "Asia/Seoul" }
```

| 필드 | 타입 | 필수 | 검증 | 근거 |
|------|------|------|------|------|
| type | String | Y | `ANNOUNCEMENT`(행사 안내) · `CANCELLATION`(행사 취소 안내) | `EventMailComposer` `mode` (`NOTICE` · `CANCELLATION`) |
| audience | String | Y | `ANNOUNCEMENT` 이면 `ALL` · `ONLINE` · `OFFLINE`. `CANCELLATION` 이면 `CANCELLED_ACTIVE` 만. 조합이 틀리면 400 | PRD §7 「전체/온라인/오프라인/취소 직전 신청자」, 프로토 `EventMailPreview.audience` |
| notice | String | N | 비어도 된다 (`""` · 생략 · null 은 같다). 최대 5,000자 | PRD §7-1 「확정자가 없어도 작성창 진입과 미리보기 가능」, `EventMailComposer` `maxLength={5000}` |
| displayTimeZone | String | N | 위 「시각과 시간대」 허용 값. 생략하면 캡틴 프로필 → 행사 시간대 | PRD §7-1 |

- `ONLINE` · `OFFLINE` 대상인데 그 행사에 그 방식이 없으면 400 (`audience`). 화면은 행사 형식으로 선택지를 만든다 (`EventMailComposer` `channels(event)`)
- 대상 `ALL` 의 화면 이름은 「참가 확정자 전체」, `CANCELLED_ACTIVE` 는 「취소 당시 신청자 전체」(이력) · 「취소 직전의 확인 대기·참가 확정 신청자 전체」(작성 창) — 문구는 화면이 정한다 (프로토 `mailAudienceLabel`)

### Response — 200

```json
{
  "type": "ANNOUNCEMENT",
  "audience": "ALL",
  "templateId": 3,
  "templateExists": true,
  "subject": "[StudyClub] 연말 네트워킹 밋업 안내",
  "body": "<!DOCTYPE html>…안녕하세요, {{nickname}}님.…일정: 12월 5일 (금) 19:00 ~ 12월 5일 (금) 22:00 KST…온라인: https://meet.example.com/abc<br>오프라인: 서울 강남구 ○○빌딩 5층…",
  "format": "HTML",
  "displayTimeZone": "Asia/Seoul",
  "recipientCount": 76,
  "canSend": false,
  "blockedReason": "NOTICE_REQUIRED"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| type | String | N | 요청 값 | — |
| audience | String | N | 요청 값 | — |
| templateId | Long | Y | 쓸 템플릿. 없으면 null | NOTIFICATION_TEMPLATE.ID (조건의 가장 작은 ID) |
| templateExists | Boolean | N | 템플릿이 있나. false 면 화면은 「등록된 행사 안내 템플릿이 없습니다」 | 계산: `templateId ≠ null` |
| subject | String | Y | 공통 제목 (치환 후). 템플릿이 없으면 null | 계산: 렌더링 규칙 |
| body | String | Y | 공통 본문 (`{{nickname}}` 만 원문). 템플릿이 없으면 null. HTML 이면 화면은 `sandbox=""` iframe 으로 그린다 (PRD §7-1 「미리보기 iframe은 sandbox로 스크립트 실행 제한」) | 계산: 렌더링 규칙 |
| format | String | Y | `HTML` · `TEXT`. 템플릿이 없으면 null | 계산: `MailBody.isHtml(template.body)` |
| displayTimeZone | String | N | 일정에 실제로 쓴 시간대 | 계산: 요청 → 캡틴 `ACCOUNT.TIME_ZONE` → `CLUB_EVENT.TIME_ZONE` |
| recipientCount | Integer | N | 지금 보내면 받을 사람 수. 화면 「받는 사람 N명」 | 계산: 아래 「받는 사람」 |
| canSend | Boolean | N | 지금 보내기 버튼을 켤까 | 계산: `blockedReason = null` |
| blockedReason | String | Y | 보낼 수 없는 첫 이유. 아래 표 순서. 보낼 수 있으면 null | 계산: `EventMail.sendBlock(...)` (제안) |

`blockedReason` (위에서부터 먼저 맞는 하나):

| 값 | 조건 | 화면 | 보내기 응답과 짝 |
|---|---|---|---|
| `EVENT_CANCELLED` | `ANNOUNCEMENT` 인데 행사가 취소됨 | 작성 창을 닫고 상세를 다시 읽는다 | 409 `EVENT_CANCELLED` |
| `EVENT_NOT_CANCELLED` | `CANCELLATION` 인데 행사가 취소되지 않음 | 같음 | 409 `EVENT_NOT_CANCELLED` |
| `TEMPLATE_MISSING` | 조건의 템플릿이 없음 | 「등록된 {행사 안내 · 행사 취소 안내} 템플릿이 없습니다」 | 409 `EVENT_MAIL_TEMPLATE_MISSING` |
| `NO_RECIPIENTS` | 받는 사람 0명 | 안내: 「선택한 대상에 참가 확정자가 없습니다」 / 취소 안내: 「취소 당시 확인 대기 또는 참가 확정 신청자가 없어 안내 메일을 보낼 대상이 없습니다」 | 409 `EVENT_MAIL_NO_RECIPIENTS` |
| `NOTICE_REQUIRED` | 안내 내용이 공백뿐 | 보내기 버튼만 끈다 (입력 중이라 문구 없음) | 400 `INVALID_INPUT` (`notice`) |

- 프로토 `EventMailComposer` 의 보내기 버튼 조건(`!template || !recipients.length || !notice.trim()`)을 서버 판정으로 옮겼다. 화면이 템플릿 존재·수신자 수·글자로 다시 판정하지 않는다
- 미리보기는 판정이 막혀도 200 이다 (막힌 이유를 보여 주는 것이 목적). 템플릿이 있으면 막혀 있어도 `subject` · `body` 를 채운다 (수신자가 0명이어도 미리보기 가능 — PRD §7-1)
- 잠금 없이 읽으므로 보내기 직전에 상태가 바뀔 수 있다. 보내기가 잠금 뒤 다시 판정한다
- 종료된 행사의 안내 메일은 막지 않는다 (M4). 그래서 `blockedReason` 에 `EVENT_ENDED` 가 없다

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `type` · `audience` 누락·허용 밖 · 조합 틀림 · 행사에 없는 방식 · `notice` 5,000자 초과 · `displayTimeZone` 허용 밖 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | `eventId` 없음 |

### 프론트엔드 사용처

- back-office-front 행사 상세 안내 메일 작성 창 (아직 없음). `useEventMailPreview(eventId, {type, audience, notice})` — 안내 작성 탭에서는 `notice: ""` 로 수신자 수·버튼 판정만, 미리보기 탭에서는 입력 중인 내용으로 부른다. 입력할 때마다 부르지 않는다 (미리보기 탭 전환·대상 변경 때만)
- 취소 안내의 기본 문구(「부득이한 사정으로 행사가 취소되었습니다. …」)는 지금처럼 화면 상수로 채운다 (`EventMailComposer` 초기값). 서버는 기본 문구를 주지 않는다
- 근거 시안: `EventMailComposer.tsx` · `model.ts` `renderEventNoticePreview`

---

## 메일 보내기

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/events/{eventId}/mails`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 발송 작업 1건(`EVENT_MAIL`)과 받는 사람 스냅샷(`EVENT_MAIL_RECIPIENT`)을 저장하고, 같은 트랜잭션에서 받는 사람마다 `NOTIFICATION` 행을 만든다. 응답은 **접수까지**다. 실제 발송은 커밋 뒤 기존 폴러(`NotificationPollingScheduler`, 30초 주기)가 한다 (PRD §7-1 「보내기는 발송 작업 한 건과 확정자별 치환 결과를 함께 저장」, [study-notice 공지 보내기](../study-notice/spec.md) 와 같은 구조)

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Request Headers

| 헤더 | 필수 | 설명 |
|---|---|---|
| Idempotency-Key | Y | 화면이 **보내기 시도마다 새로 만드는 UUID v4**. 응답을 못 받아 다시 보낼 때는 같은 키. 없거나 형식이 틀리면 400 `INVALID_INPUT` (`Idempotency-Key`). 규칙은 [event 「행사 등록」 N1](../event/spec.md#행사-등록) 과 같다 |

- 서버는 **같은 보낸 사람 · 같은 키**로 이미 만든 발송이 있으면 새로 만들지 않고 그 발송의 응답을 그대로 준다 (201). 메일이 두 번 나가지 않는다
- 본문 검증(400)에 실패한 요청에는 키를 저장하지 않는다
- 키는 `EVENT_MAIL.IDEMPOTENCY_KEY` 에 두고 `UNIQUE(SENDER_ACCOUNT_ID, IDEMPOTENCY_KEY)` 로 동시에 온 같은 키 중 하나만 만든다. 유일성 위반이면 먼저 만든 발송을 읽어 돌려준다
- 쿨다운 · 일일 한도는 두지 않는다 (M5)
- 화면 규칙 (M5): 요청 중에는 보내기 버튼을 막는다. 응답을 받지 못했거나 네트워크 오류로 다시 보낼 때는 **같은 키**를 쓴다. 성공을 확인한 뒤 별도로 보내는 메일에는 **새 키**를 만든다

### Request Body

```json
{
  "type": "ANNOUNCEMENT",
  "audience": "OFFLINE",
  "notice": "행사장 5층 엘리베이터가 점검 중이라 계단을 이용해 주세요.",
  "templateId": 3,
  "displayTimeZone": "Asia/Seoul"
}
```

| 필드 | 타입 | 필수 | 검증 | 근거 |
|------|------|------|------|------|
| type | String | Y | 미리보기와 같다 | |
| audience | String | Y | 미리보기와 같다 | |
| notice | String | Y | 앞뒤 공백을 제거한 뒤 1~5,000자. 줄바꿈 포함 | PRD §7-1 「대상·안내 내용이 없으면 보내기 제한」, 프로토 `transition` MAIL 「안내 내용을 입력해 주세요」 |
| templateId | Long | N | 미리보기에서 받은 `templateId`. 보내면 지금 쓸 템플릿과 같아야 한다 | PRD §7-1 「데이터: 템플릿 ID」, 프로토 `MAIL.templateId` |
| displayTimeZone | String | N | 이력에 저장할 공통 본문의 시간대. 미리보기와 같다 | 프로토 `MAIL.displayTimeZone` |

- `templateId` 를 보내는 이유: 캡틴이 미리보기로 확인한 템플릿과 실제로 나가는 템플릿이 같아야 한다. 미리보기 뒤 다른 캡틴이 첫 템플릿을 지우거나 더 작은 ID 의 템플릿이 생기면 409 `EVENT_MAIL_TEMPLATE_CHANGED` 로 막고, 화면은 미리보기를 다시 부른다. 생략하면 이 검사를 건너뛴다

### 받는 사람

| 종류 | 받는 사람 (잠금 뒤 읽는다) | 근거 |
|---|---|---|
| 안내 `ALL` | 그 행사의 `STATUS = CONFIRMED` 신청 | PRD §7 「전체 또는 참여 방식별 참가 확정자」, 프로토 `transition` MAIL |
| 안내 `ONLINE` · `OFFLINE` | 위 + `CHANNEL = audience` | 같음 |
| 취소 안내 `CANCELLED_ACTIVE` | 그 행사의 `STATUS = CANCELLED ∧ CANCEL_REASON = EVENT_CANCELLED` 신청 | PRD §7 「취소 직전의 확인 대기·참가 확정 신청자 전체」, [event-status](../event-status/spec.md#행사-취소가-신청에-하는-일) |

- 위 신청 중 **계정이 남아 있는 사람만** 받는 사람으로 센다 (event-status S5). 미리보기와 보내기가 각각 다시 확인한다. 탈퇴로 계정이 없으면 보낼 주소가 없다 (study-notice 「이미 없는 계정은 그 사람 몫을 만들지 않는다」). `recipientCount` 도 이 수다
- 한 계정이 같은 행사에 유효 신청을 둘 가질 수 없으므로(ST-038 중복 신청 제한) 신청 수 = 사람 수다. 그래도 계정 ID 로 중복을 걸러 한 사람에게 한 통만 만든다
- 취소 안내는 한 행사에서 여러 번 보낼 수 있다 (M6). 대상은 매번 위 조건으로 다시 고른다
- 종료된 행사에도 안내 메일을 보낼 수 있다. 별도 기간 제한이 없다 (M4). 대상은 실제 참석 여부가 아니라 **신청 상태** 기준(`CONFIRMED`)이고 참가 불가 · 신청 취소자는 빠진다. 종료 뒤 행사 정보·신청폼 수정(`PUT`)과 참가자 상태 변경은 409 `EVENT_ENDED` 로 막히지만, 자료 공유 · 설문 · 후기 요청을 위한 안내 메일 작성 · 미리보기 · 보내기는 된다
- 수신자 스냅샷은 보낼 때 고정된다. 이후 신청 상태가 바뀌어도 이력의 대상·인원은 그대로다 (PRD §7 「대상과 인원은 발송 시점 기준으로 보관하며 현재 신청 상태가 바뀌어도 유지」)

### 처리 순서

인가(401 · 403)와 헤더·본문 검증(400)을 통과한 뒤, 한 트랜잭션에서 아래 순서로 처리한다. 먼저 걸리는 것 하나만 응답하고, 실패하면 아무것도 저장하지 않는다.

| # | 단계 | 실패 | 근거 |
|---|---|---|---|
| 1 | `CLUB_EVENT` 행을 쓰기 잠금으로 읽는다 (**트랜잭션의 첫 조회**). `ACCOUNT` 는 잠그지 않는다. 없으면 | 404 `NOT_FOUND` | 아래 「행사 행을 잠그는 이유」 · 「탈퇴와 메일 예약의 순서」 |
| 2 | 같은 보낸 사람 · 같은 `Idempotency-Key` 의 `EVENT_MAIL` 이 있으면 그 발송을 그대로 돌려준다 | 201 (재응답) | event N1 과 같은 방식 |
| 3 | 안내(`ANNOUNCEMENT`)인데 `STATUS = CANCELLED` | 409 `EVENT_CANCELLED` | 프로토 「취소된 행사에는 안내 메일을 보낼 수 없습니다」 |
| 4 | 취소 안내(`CANCELLATION`)인데 `STATUS ≠ CANCELLED` | 409 `EVENT_NOT_CANCELLED` | 프로토 「취소된 행사에만 취소 안내 메일을 보낼 수 있습니다」 |
| 5 | `ONLINE` · `OFFLINE` 대상인데 행사에 그 방식이 없다 | 400 `INVALID_INPUT` (`audience`) | `EventMailComposer` 대상 선택지 |
| 6 | 조건의 템플릿을 고른다 (가장 작은 ID). 없으면 | 409 `EVENT_MAIL_TEMPLATE_MISSING` | 프로토 「등록된 행사 (취소) 안내 템플릿이 없습니다」 |
| 7 | 요청 `templateId` 가 있는데 6 과 다르다 | 409 `EVENT_MAIL_TEMPLATE_CHANGED` | 위 `templateId` 설명 |
| 8 | 받는 사람을 읽는다 (잠금 뒤 일반 조회로 신청 · `ACCOUNT` 를 읽어 계정이 남은 사람만). 0명이면 | 409 `EVENT_MAIL_NO_RECIPIENTS` | 프로토 「선택한 대상에 참가 확정자가 없습니다」 · 「취소 안내 메일을 받을 신청자가 없습니다」 |
| 9 | 공통 제목·본문을 렌더링한다 (`{{nickname}}` 원문, 일정은 공통 본문 시간대) | — | PRD §7-1 「이력 미리보기 제목·본문도 닉네임만 원문으로 두고 나머지를 발송 시점 값으로 저장」, 프로토 `createEventNoticeMail` |
| 10 | `EVENT_MAIL` 1행(공통 제목·본문·형식·대상·수신자 수·템플릿 ID·보낸 사람·안내 내용·키)과 `EVENT_MAIL_RECIPIENT` 받는 사람 수만큼 저장 | — | PRD §7 「한 번의 발송을 이력 한 건으로」 |
| 11 | `ClubEventMailSentEvent` (`club_event_mail.sent`) 를 트랜잭션 안에서 발행한다 | — | [domain-events](../domain-events/spec.md) |
| 12 | 커밋 직전 `BEFORE_COMMIT` 구독자(`ClubEventMailEmailListener` 제안)가 받는 사람마다 `NOTIFICATION` 행 1개를 같은 트랜잭션에 저장한다. 템플릿 제목·본문 스냅샷을 함께 저장한다 (아래 「수신자별 메일 행」 · 「발송 내용 고정」). 행 생성이 실패하면 **예외를 삼키지 않고 전체 롤백** | — | domain-events 「아웃박스 행을 만드는 구독자는 `BEFORE_COMMIT`」, study-notice 처리 규칙 5 |
| 13 | 커밋. 커밋 뒤 폴러가 SES 로 보낸다 | — | [notification 「처리 흐름」](../notification/spec.md#처리-흐름) |

- 3·4 는 잠금 뒤의 상태로 판정한다. 행사 취소([event-status](../event-status/spec.md))와 안내 메일이 겹치면 먼저 잠금을 얻은 쪽이 이긴다: 취소가 먼저면 안내는 409, 안내가 먼저면 안내가 확정자에게 나가고 그 뒤 취소된다
- 종료된 행사는 막지 않는다 (M4). 프로토 `EventAdminDetail` 도 취소되지 않았으면 종료 뒤에 `안내 메일 보내기` 를 보인다
- 2 를 3~8 보다 먼저 두는 이유: 첫 요청이 성공한 뒤 상태가 바뀌었어도(예: 행사가 그 사이 취소됨) 같은 키의 재시도는 첫 결과를 받아야 한다

**행사 행을 잠그는 이유**: 받는 사람(참가 확정자 · 취소 안내 대상)과 행사 상태가 발송 도중 바뀌지 않게 한다. 참가자 처리 · 행사 취소 · 크루 신청·취소가 모두 같은 잠금을 먼저 잡으므로, 잠금을 쥔 동안 읽은 받는 사람 집합이 커밋 시점까지 그대로다 ([event 「같은 행사에 쓰는 요청의 처리 순서」](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서)). 대신 받는 사람이 많으면 잠금이 그만큼 길어진다.

**큰 발송의 잠금 시간 (M7)**: 이번에는 행사 잠금을 쥔 채 수신자 확정 · `EVENT_MAIL` · `EVENT_MAIL_RECIPIENT` · 수신자별 `NOTIFICATION` 을 한 트랜잭션으로 저장하고, 실제 발송은 커밋 뒤 폴러가 한다. `NOTIFICATION` 은 `IDENTITY` 라 행마다 INSERT 한다 (`NotificationCreationService` 주석). 구현 뒤 스테이지에서 **수신자 합계 최대 20,000명(온라인 + 오프라인 정원 합)** 까지 수신자 수별로 다음을 잰다: 예약 저장 시간, 그동안 같은 행사의 크루 신청 · 취소가 기다린 시간과 오류 · 롤백 여부. 잠금 대기가 지나치거나 시간 초과가 나면 **배포 전에** 수신자 상한이나 저장을 나누는 방식을 정한다 (PRD 「후속 구현 합의」 M7)

### 수신자별 메일 행

`NOTIFICATION` 한 행 = 받는 사람 한 명 (첫 템플릿 한 건만 쓰므로 템플릿 수만큼 늘지 않는다, M1).

| `NOTIFICATION` 컬럼 | 값 |
|---|---|
| EVENT_TYPE | `EVENT_ANNOUNCEMENT` · `EVENT_CANCELLATION` |
| RECIPIENT_TYPE · RECIPIENT_VALUE | `EMAIL` · 행을 만드는 시점의 `ACCOUNT.EMAIL` |
| RECIPIENT_USER_ID | 받는 사람 계정 ID |
| TEMPLATE_ID | 처리 순서 6 의 템플릿 (기록용) |
| SUBJECT_TEMPLATE · BODY_TEMPLATE (신규) | 처리 순서 6 템플릿의 제목 · 본문 원문 스냅샷 (아래 「발송 내용 고정」) |
| REFERENCE_ID | `EVENT_MAIL.ID` — `(EVENT_TYPE, REFERENCE_ID)` 인덱스로 한 발송의 메일 행을 찾는다 |
| SENDER_ACCOUNT_ID | 보낸 캡틴 — 탈퇴 비식별화가 이 값으로 행을 찾는다 (STUDY_NOTICE 와 같다) |
| PAYLOAD | 안내: `{nickname, eventTitle, channel, eventSchedule, participation, notice}` · 취소 안내: `{nickname, eventTitle, notice}`. 값은 **그 수신자 기준**으로 만든다 — 일정은 수신자 시간대, `channel` · `participation` 은 그 수신자의 참여 방식 |

- 폴러는 행의 템플릿 스냅샷에 `PAYLOAD` 를 치환해 보낸다. 스냅샷 + PAYLOAD 가 곧 「확정자별 치환 결과」다 (PRD §7-1)

### 발송 내용 고정 (M6)

PRD §7-1 M6 「접수 시 템플릿과 개인별 결과를 고정하고 수정·삭제·재발송에도 보존」. 지금 폴러는 보낼 때 `TEMPLATE_ID` 로 `NOTIFICATION_TEMPLATE` 을 **다시 읽는다** ([notification 「지운 뒤의 동작」](../notification/spec.md#delete-apiadminnotification-templatesid)). 그대로 두면 예약 뒤 템플릿을 고치면 고친 문구로 나가고, 지우면 `TEMPLATE_MISSING` 으로 실패하며 재발송해도 같다. 그래서 행사 여섯 조건은 **예약 때 템플릿 원문을 행에 함께 저장**한다.

| 선택지 | 판단 |
|---|---|
| **템플릿 원문 스냅샷** — `NOTIFICATION.SUBJECT_TEMPLATE`(VARCHAR 255) · `BODY_TEMPLATE`(TEXT) 를 nullable 로 더한다 (채택) | 폴러 · 재발송은 스냅샷이 있으면 그것을, 없으면(기존 조건) 지금처럼 `TEMPLATE_ID` 로 읽는다. 개인별 값은 이미 `PAYLOAD` 에 고정돼 있다(일정 문자열 포함, M3). 탈퇴 비식별화는 지금처럼 `PAYLOAD.nickname` · `RECIPIENT_VALUE` 만 바꾸면 되고, 스냅샷에는 개인정보가 없다 (템플릿 원문뿐) |
| 개인별 완성 제목·본문을 저장 | 본문에 닉네임이 박혀 탈퇴 비식별화가 완성 본문까지 고쳐야 한다. 행마다 수십 KB HTML 이 중복된다 |
| 템플릿 버전 테이블 (`NOTIFICATION_TEMPLATE_VERSION`) | 같은 원문을 한 번만 저장하지만, 템플릿 수정 · 삭제 API 가 버전 행을 남기도록 바꿔야 해 범위가 넓다. 발송량이 커지면 다시 본다 |

- 스냅샷은 행사 여섯 조건의 행에만 채운다. 기존 세 조건의 동작은 바꾸지 않는다
- 그래서 예약 뒤 템플릿을 고치거나 지워도 이미 예약한 메일과 이력(`EVENT_MAIL` 공통 본문)은 접수 당시 내용 그대로다. 행사 조건의 행은 `TEMPLATE_MISSING` 으로 실패하지 않는다
- 실패 뒤 재발송도 접수 당시 스냅샷 + PAYLOAD 로 보낸다. 다만 재발송 가능 여부는 **현재 행사 · 신청 상태로 따로 검사**한다 (아래 「재발송 가능 조건」)
- 스키마 변경(컬럼 2개 추가)은 구현 PR 의 마이그레이션 · [NOTIFICATION ERD](../../docs/erd/NOTIFICATION.md) 에서 한다. 이 PR 은 ERD 정본을 고치지 않는다
- `PAYLOAD` 에 이메일을 넣지 않는다. `nickname` 은 탈퇴 비식별화 대상이다 ([user-leave 「알림 비식별화」](../user-leave/spec.md#알림-비식별화))
- 로그에 제목·본문·안내 내용·이메일을 남기지 않는다. `mailId` · `clubEventId` · 수신자 수만

### Response — 201

본문은 [메일 이력 상세](#메일-이력-상세) 와 같다. 헤더 `Location: /api/admin/events/{eventId}/mails/{mailId}`. 같은 `Idempotency-Key` 재시도에도 같은 응답을 준다.

### Error Responses

| 상태 | errorCode | 조건 | 화면 안내 |
|------|-----------|------|------|
| 400 | INVALID_INPUT | `Idempotency-Key` 누락·형식 · `type`·`audience` 누락·조합 · 행사에 없는 방식 · `notice` 공백뿐·5,000자 초과 · `displayTimeZone` 허용 밖 | 입력 유지 |
| 401 | UNAUTHORIZED | 토큰 없음 | |
| 403 | FORBIDDEN | ADMIN 아님 | |
| 404 | NOT_FOUND | `eventId` 없음 | |
| 409 | EVENT_CANCELLED | 취소된 행사에 안내 메일 | 창을 닫고 상세 다시 읽기 → 취소 안내 버튼 |
| 409 | EVENT_NOT_CANCELLED | 취소되지 않은 행사에 취소 안내 메일 | 창을 닫고 상세 다시 읽기 |
| 409 | EVENT_MAIL_TEMPLATE_MISSING | 조건의 템플릿이 없음 | 「등록된 … 템플릿이 없습니다」 + 입력 유지 |
| 409 | EVENT_MAIL_TEMPLATE_CHANGED | 미리보기 뒤 쓸 템플릿이 바뀜 | 입력 유지, 미리보기 다시 부르기 |
| 409 | EVENT_MAIL_NO_RECIPIENTS | 받는 사람 0명 | 입력 유지, 미리보기 다시 부르기 |

- **새 `ErrorCode` 네 개** (모두 409): `EVENT_NOT_CANCELLED` 「취소된 행사에만 취소 안내 메일을 보낼 수 있습니다.」 · `EVENT_MAIL_TEMPLATE_MISSING` 「등록된 행사 메일 템플릿이 없습니다.」 · `EVENT_MAIL_TEMPLATE_CHANGED` 「메일 템플릿이 바뀌었습니다. 미리보기를 다시 확인해 주세요.」 · `EVENT_MAIL_NO_RECIPIENTS` 「메일을 받을 사람이 없습니다.」. 화면 행동이 서로 다르다 (닫기 · 템플릿 등록 안내 · 다시 미리보기)
- 템플릿 없음을 422 가 아니라 409 로 둔다. 요청 형식은 맞고 서버 상태(템플릿 목록) 때문에 처리할 수 없는 경우라 레포의 다른 상태 충돌(409)과 같다. 레포에 422 를 쓰는 곳이 없다
- 수신자 0명을 400 이 아니라 409 로 둔다. 같은 요청도 신청 상태가 바뀌면 성공할 수 있는 상태 충돌이다

### 프론트엔드 사용처

- back-office-front 안내 메일 작성 창 `보내기` (아직 없음). `useSendEventMail()` mutation — 보낼 때마다 `crypto.randomUUID()` 로 키를 만들고, 응답 전에는 버튼을 막는다. 성공하면 메일 이력 탭으로 옮기고 이력 목록을 다시 읽는다 (프로토 `onSent` → `setTab('mails')`)
- 근거 시안: `EventMailComposer.tsx` · `model.ts` `transition` MAIL · CANCELLATION_MAIL · `createEventNoticeMail`

---

## 메일 이력 목록

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/events/{eventId}/mails`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 운영자가 `안내 메일 보내기` · `취소 안내 메일 보내기` 로 만든 발송만 (`EVENT_MAIL`). 자동 메일은 나오지 않는다 (PRD §7). 종료·취소 행사도 조회한다

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| offset | Integer | N | 0 | 0 이상 |
| limit | Integer | N | 20 | 1 ~ 50 |

- 정렬: `CREATED_AT DESC, ID DESC` 고정 (프로토 `state.mails.unshift` 로 최신이 위)
- 한 행사의 운영자 메일은 많지 않지만, 레포의 다른 기록 목록(study-notice 「보낸 공지 기록」 limit 최대 50)과 같은 모양으로 페이지를 둔다. 화면은 `total ≤ limit` 이면 페이지 이동을 그리지 않는다

### Response — 200

```json
{
  "items": [
    {
      "mailId": 21,
      "subject": "[StudyClub] 연말 네트워킹 밋업 안내",
      "audience": "OFFLINE",
      "recipientCount": 35,
      "createdAt": "2026-12-04T09:00:00Z"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 20
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items[].mailId | Long | N | | EVENT_MAIL.ID |
| items[].subject | String | N | 발송 당시 공통 제목 (이후 템플릿 수정·삭제와 무관) | EVENT_MAIL.SUBJECT |
| items[].audience | String | N | `ALL` · `ONLINE` · `OFFLINE` · `CANCELLED_ACTIVE`. 화면 이름은 프로토 `mailAudienceLabel` | EVENT_MAIL.AUDIENCE |
| items[].recipientCount | Integer | N | 발송 시점 받는 사람 수 (고정) | EVENT_MAIL.RECIPIENT_COUNT |
| items[].createdAt | String | N | 발송(접수) 시각, UTC. 화면은 운영자 시간대 + 약어로 | EVENT_MAIL.CREATED_AT |
| total | Long | N | 그 행사의 운영자 메일 수. 탭 배지 | 계산: COUNT |
| offset · limit | Integer | N | 요청 값 | — |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `offset < 0` · `limit` 이 1~50 밖 |
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | `eventId` 없음 |

### 프론트엔드 사용처

- back-office-front 행사 상세 「메일 이력」 탭. 탭 배지는 `total`. 빈 목록이면 「아직 보낸 안내 메일이 없습니다.」
- 근거 시안: `EventAdminDetail.tsx` 메일 이력 탭 (`mail.kind === 'OPERATOR'` 만)

---

## 메일 이력 상세

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/events/{eventId}/mails/{mailId}`
- **인증**: 필요 (`@RequireAdmin`)
- **설명**: 발송 당시 공통 제목·본문(닉네임 원문)과 대상, 접어서 보는 받는 사람 목록. 받는 사람 주소는 **언제나 서버가 가린 값**이고 펼쳐 보는 기능이 없다 (PRD §6 「메일 이력 상세의 수신 주소는 마스킹 표시」)

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |
| mailId | Long | 메일 ID |

### Response — 200

```json
{
  "mailId": 21,
  "type": "ANNOUNCEMENT",
  "subject": "[StudyClub] 연말 네트워킹 밋업 안내",
  "body": "<!DOCTYPE html>…안녕하세요, {{nickname}}님.…",
  "format": "HTML",
  "audience": "OFFLINE",
  "recipientCount": 35,
  "maskedRecipients": ["s***@naver.com", "h***@gmail.com"],
  "createdAt": "2026-12-04T09:00:00Z"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| mailId | Long | N | | EVENT_MAIL.ID |
| type | String | N | `ANNOUNCEMENT` · `CANCELLATION` | EVENT_MAIL.TYPE |
| subject | String | N | 발송 당시 공통 제목 | EVENT_MAIL.SUBJECT |
| body | String | N | 발송 당시 공통 본문. `{{nickname}}` 만 원문. 화면은 `sandbox=""` iframe | EVENT_MAIL.BODY |
| format | String | N | `HTML` · `TEXT` | EVENT_MAIL.FORMAT |
| audience | String | N | | EVENT_MAIL.AUDIENCE |
| recipientCount | Integer | N | 발송 시점 받는 사람 수. 화면은 「받는 사람 N명 보기」 펼치기에만 표시 (PRD §7 「상세의 인원수는 받는 사람 펼치기에만 표시」) | EVENT_MAIL.RECIPIENT_COUNT |
| maskedRecipients | String[] | N | 가린 받는 주소. 받는 사람 계정 ID 순. 탈퇴로 비식별된 주소는 비식별 값 그대로 가린다 | 계산: 이 발송의 `NOTIFICATION.RECIPIENT_VALUE`(발송 행을 만들 때의 주소 스냅샷)를 받는 사람별 하나로 줄여 마스킹 |
| createdAt | String | N | UTC | EVENT_MAIL.CREATED_AT |

- `type` 은 이력 목록에는 없다 (`audience` 로 구분된다). 상세는 창 제목(「행사 취소 안내」)을 고르는 데 쓴다
- **받는 주소의 소스를 `NOTIFICATION.RECIPIENT_VALUE` 로 두는 이유**: 메일이 실제로 나간 주소의 스냅샷이고, 회원 탈퇴 때 이미 비식별화된다([user-leave](../user-leave/spec.md#알림-비식별화)). `EVENT_MAIL_RECIPIENT` 에 주소를 또 복사하면 탈퇴 때 지울 곳이 하나 늘고, 현재 `ACCOUNT.EMAIL` 을 읽으면 회원이 주소를 바꾼 뒤 「보낸 곳」이 아닌 주소가 보인다. 인원·대상의 정본은 `EVENT_MAIL.RECIPIENT_COUNT` · `EVENT_MAIL_RECIPIENT` 이고, 이 필드는 표시용이다
- 마스킹은 admin-users · notification 과 같은 함수 (`h***@gmail.com`)
- 원본 주소를 보는 API 는 두지 않는다 (PRD §6). 수신자 수는 많아야 정원 합이라 한 응답에 싣는다 (페이지 없음)
- 수신자별 발송 상태(보냄·실패)는 싣지 않는다. PRD 에 없고, 백오피스 「알림 › 발송 이력」(`GET /api/admin/notifications`)에서 `eventType` 으로 본다. 그 화면에서 행 단위 재발송도 기존 규칙대로 된다
- 프로토의 `fillLegacyEventMailPreview`(구버전 미치환 이력을 현재 행사 정보로 한 번 보완)는 **플레이그라운드 브라우저 저장소의 옛 예시 데이터**를 고치는 코드다. 서버에는 옛 형식 이력이 없으므로 옮기지 않는다. 서버 이력은 처음부터 발송 시점 값으로 저장한다

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | `eventId` · `mailId` 없음, 그 행사 메일이 아님 |

### 프론트엔드 사용처

- back-office-front 메일 이력 탭 → 「내용 보기」 창. 받는 사람 목록은 `<details>` 로 접어 둔다
- 근거 시안: `EventAdminDetail.tsx` 「메일 미리보기」 Modal

---

## 자동 메일: 신청 상태 알림

다른 스펙의 처리가 신청 상태를 바꾸면 도메인 이벤트를 발행하고, 이 스펙의 `BEFORE_COMMIT` 구독자(`ClubEventRegistrationEmailListener` 제안, 처리와 다른 빈)가 바뀐 신청마다 `NOTIFICATION` 행을 **같은 트랜잭션에** 만든다. 행 생성이 DB 오류 등으로 실패하면 처리 전체가 롤백된다. 그 조건의 템플릿이 없을 때만 처리는 커밋하고 메일을 건너뛴다 (아래 「템플릿이 없을 때 (M2)」). 실제 발송은 커밋 뒤 폴러가 한다.

| 도메인 이벤트 | 발행하는 곳 | 알림 조건 |
|---|---|---|
| `ClubEventRegistrationsConfirmedEvent` (`club_event.registrations_confirmed`) | 행사 수정 `REVIEW → AUTO` ([event](../event/spec.md), PR #478) · 운영진 참가 확정 ([event-participant](../event-participant/spec.md#참가-처리)) | `EVENT_REGISTRATION_CONFIRMED` |
| `ClubEventRegistrationsDeclinedEvent` (`club_event.registrations_declined`, 신규) | 운영진 참가 불가 · 행사 종료 자동 전환 ([event-participant](../event-participant/spec.md)) | `EVENT_REGISTRATION_DECLINED` |
| `ClubEventRegistrationsCancelledEvent` (`club_event.registrations_cancelled`, 신규) | 운영진 개별 취소 ([event-participant](../event-participant/spec.md)) · 크루 본인 취소 (ST-038, 제안) | `EVENT_REGISTRATION_CANCELLED` |
| 신청 접수 이벤트 (ST-038 이 정한다) | 크루 신청 제출 (ST-038) | 접수 상태가 `PENDING` 이면 `EVENT_REGISTRATION_PENDING`, `CONFIRMED` 면 `EVENT_REGISTRATION_CONFIRMED` |

- **행사 전체 취소 · 탈퇴 취소(`ACCOUNT_DELETED`)는 이 표에 없다.** 행사 취소는 운영자가 취소 안내 메일을 보내고 ([event-status S2](../event-status/spec.md#취소와-메일-s2)), 탈퇴는 받을 사람이 없다
- 신청 접수 이벤트의 이름·페이로드는 ST-038 신청 스펙이 정한다. 이 구독자가 받으려면 페이로드에 `clubEventId` · `registrationId` · 접수 상태가 있어야 한다

| `NOTIFICATION` 컬럼 | 값 |
|---|---|
| EVENT_TYPE | 위 표의 알림 조건 |
| RECIPIENT_VALUE · RECIPIENT_USER_ID | 행을 만드는 시점의 `ACCOUNT.EMAIL` · 신청자 계정 ID. 계정이 없으면(탈퇴) 그 신청 몫은 만들지 않고 건너뛴다 (study-notice 와 같다) |
| TEMPLATE_ID · SUBJECT_TEMPLATE · BODY_TEMPLATE | 그 조건의 첫 템플릿과 그 원문 스냅샷 (M1 · M6) |
| REFERENCE_ID | `CLUB_EVENT_REGISTRATION.ID` |
| SENDER_ACCOUNT_ID | NULL (운영자가 쓴 글이 아니다) |
| PAYLOAD | `{nickname, eventTitle, eventSchedule, channel, participation}`. 일정은 수신자 시간대, `channel` 은 그 신청의 방식, `participation` 은 `CONFIRMED` 만 채우고 그 밖은 빈 문자열 |

- 제목 규칙은 [메일 템플릿 README 「제목 규칙」](../../docs/mail-templates/README.md#제목-규칙) (`[StudyClub] 무엇`)을 **템플릿이** 지킨다. 프로토 `appendAutomaticEventMail` 은 제목에 `[StudyClub]` 이 없으면 붙이지만, 서버는 템플릿 제목을 고치지 않는다 (다른 조건과 같다). 시드 템플릿은 모두 접두를 갖는다
- 수신자 계정은 잠금 뒤 일반 조회로 읽는다. `ACCOUNT` 를 잠그지 않는다 (아래 「탈퇴와 메일 예약의 순서」)

### 템플릿이 없을 때 (M2)

| 메일 | 그 조건의 템플릿이 없으면 | 근거 |
|---|---|---|
| 자동 4종 (`EVENT_REGISTRATION_*`) | 신청 접수 · 참가 처리 · 개별 · 본인 취소 · 종료 자동 전환은 **그대로 커밋**하고 그 메일 예약만 건너뛴다. 운영자 누락 경보를 남긴다 | PRD §7 M2, crew-apply-event §5 「자동 템플릿 누락은 신청·취소를 막지 않으며」 |
| 운영자 안내 2종 (`EVENT_ANNOUNCEMENT` · `EVENT_CANCELLATION`) | 409 `EVENT_MAIL_TEMPLATE_MISSING` 으로 보내기를 막는다. 작성 창은 미리 `blockedReason = TEMPLATE_MISSING` 으로 알린다 | PRD §7-1 「템플릿이 없거나 … 보내기 제한」 |

- **이 예외는 템플릿이 없을 때만이다.** 템플릿은 있는데 DB 오류 등으로 메일 예약 저장이 실패하면 지금처럼 예외를 삼키지 않고 처리 전체를 롤백한다 (`BEFORE_COMMIT` 규칙)
- 누락 경보 (제안): 구독자가 건너뛸 때 `club_event_mail.template_missing` 사실을 남긴다. 에러 로그에 `eventType` · `clubEventId` · `registrationId` 를 남기고(연락처 없음), [ops-alerts](../ops-alerts/spec.md) 운영 채널에 경보를 보낸다. 같은 `(eventType, clubEventId)` 경보는 10분에 한 번으로 묶고 그동안 건너뛴 건수를 함께 적는다 — 종료 자동 전환처럼 한 번에 수십 건이 빠질 때 채널이 넘치지 않게 한다. ops-alerts 스펙 표에 줄을 더하는 일은 구현 PR 에서 한다
- **템플릿을 복구해도 건너뛴 메일은 자동으로 다시 보내지 않는다** (소급 발송 없음). 필요하면 운영자가 안내 메일로 따로 알린다
- 자동 메일은 메일 이력 탭에 안 보인다 (위 「메일 여섯 종류」)

---

## 템플릿 시드와 기존 백오피스 API

### 시드

여섯 조건의 첫 템플릿을 `V{n}` 마이그레이션으로 넣는다 ([메일 템플릿 README 「적용」](../../docs/mail-templates/README.md#적용-2026-10-16--v38) 순서). 문구는 플레이그라운드 기본값을 쓴다.

| 조건 | 제목 | 본문 시안 |
|---|---|---|
| `EVENT_ANNOUNCEMENT` | `[StudyClub] {{eventTitle}} 안내` | [event-announcement-email.html](../../frontend/apps/playground/src/proto/mail/templates/event-announcement-email.html) |
| `EVENT_CANCELLATION` | `[StudyClub] {{eventTitle}} 행사 취소 안내` | `event-preview.ts` `EVENT_CANCELLATION_TEMPLATE` (HTML 파일 없음) |
| `EVENT_REGISTRATION_CONFIRMED` | `[StudyClub] {{eventTitle}} 참가가 확정되었습니다` | `EVENT_STATUS_TEMPLATES` (HTML 파일 없음) |
| `EVENT_REGISTRATION_PENDING` | `[StudyClub] {{eventTitle}} 신청이 확인 대기 중입니다` | 같음 |
| `EVENT_REGISTRATION_DECLINED` | `[StudyClub] {{eventTitle}} 참가 결과를 안내드립니다` | 같음 |
| `EVENT_REGISTRATION_CANCELLED` | `[StudyClub] {{eventTitle}} 신청이 취소되었습니다` | 같음 |

- README 규칙상 본문 시안은 `proto/mail/templates/` 에 HTML 파일로 둔다. 다섯 조건은 지금 TS 문자열로만 있어 구현 PR 에서 HTML 파일로 옮기고 README 시안 표에 줄을 더한다 (이 스펙 PR 은 시안을 만들지 않는다). 다섯 시안은 preheader(받은편지함 미리보기 문구)가 비어 있어 그때 채운다
- stage 는 Flyway 가 꺼져 있어 같은 본문을 손으로 한 번 넣는다 (README)

### 기존 백오피스 API 와 맞물리는 곳

| 기존 API ([notification](../notification/spec.md)) | 바뀌는 것 |
|---|---|
| `GET /api/admin/notification-templates` | 여섯 조건의 템플릿도 나온다. 모양 그대로 |
| `POST` · `PUT /api/admin/notification-templates` | `eventType` 이 여섯 값을 받는다. 위 「템플릿 검증」을 행사 조건에 더한다 (제안) |
| `DELETE /api/admin/notification-templates/{id}` | 「지운 뒤의 동작」 표에 여섯 조건 줄을 더한다: 운영자 안내는 「보내기가 409 `EVENT_MAIL_TEMPLATE_MISSING`, 작성 창은 템플릿 없음 안내」, 자동은 「처리는 진행하고 메일만 건너뛰며 누락 경보」(M2). 다음 템플릿이 있으면 그 템플릿이 「첫 양식」이 된다 (M1). 이미 예약한 행은 스냅샷이 있어 영향이 없다 (M6) |
| `GET /api/admin/notifications` | `eventType` 필터가 여섯 값을 받는다. 수신 주소 마스킹 그대로. 행사 여섯 조건의 `canResend` 는 아래 「재발송 가능 조건」을 더해 판정한다 |
| `POST /api/admin/notifications/resend` | 행 단위 재발송 그대로. 접수 당시 스냅샷 + `PAYLOAD` 로 다시 나간다 (M6). 행사 여섯 조건은 아래 조건을 통과한 행만 `PENDING` 으로 되돌리고, 아니면 `skipped` 로 돌려준다 |

### 재발송 가능 조건 (행사 메일)

PR #479 리뷰: 참가 확정 메일이 실패한 뒤 크루가 신청을 취소했는데 운영자가 실패 이력에서 재발송하면, 취소한 사람에게 참가 확정 안내와 온라인 링크가 다시 간다. 그래서 행사 여섯 조건은 기존 조건([notification 「재발송 가능 조건」](../notification/spec.md#재발송-가능-조건): `STATUS = FAILED` · 수신 계정이 남아 있음)에 **현재 행사 · 신청 상태**를 더해 판정한다.

| 알림 조건 | 지금 이렇게 되어 있어야 재발송한다 (기존 조건과 함께 모두) |
|---|---|
| `EVENT_REGISTRATION_CONFIRMED` | 그 신청(`REFERENCE_ID`)이 지금 `CONFIRMED` ∧ 행사가 `CANCELLED` 아님 |
| `EVENT_REGISTRATION_PENDING` | 그 신청이 지금 `PENDING` ∧ 행사가 `CANCELLED` 아님 ∧ 종료 전(`now < effectiveEndsAt`) |
| `EVENT_REGISTRATION_DECLINED` | 그 신청이 지금 `DECLINED` ∧ 행사가 `CANCELLED` 아님 |
| `EVENT_REGISTRATION_CANCELLED` | 그 신청이 지금 `CANCELLED` ∧ `CANCEL_REASON ∈ {ADMIN_CANCELLED, SELF_CANCELLED}` |
| `EVENT_ANNOUNCEMENT` | 행사가 `CANCELLED` 아님 ∧ 그 수신자의 신청(`EVENT_MAIL_RECIPIENT.REGISTRATION_ID`)이 지금 `CONFIRMED` |
| `EVENT_CANCELLATION` | 행사가 `CANCELLED` ∧ 그 수신자의 신청이 `CANCEL_REASON = EVENT_CANCELLED` |

- 신청 · 행사를 찾지 못하면(있을 수 없는 경우) 재발송하지 않는다
- 목록의 `canResend` 와 재발송 처리가 **같은 판정 메서드에 같은 쿼리로 읽은 재료**를 넘긴다 (지금 `Notification.canResend` 와 같은 원칙). 재료는 목록 한 페이지의 신청 ID · 메일 ID 묶음으로 한 번에 읽는다
- 조건에 안 맞으면 목록은 `canResend = false`, 재발송은 `skipped[].reason` 로 돌려준다. 새 사유 `STATE_CHANGED`(「행사 · 신청 상태가 바뀌어 이 안내를 다시 보낼 수 없다」)를 `ResendSkipReason` 에 더한다. 수신 계정이 없으면 기존 `RECIPIENT_GONE` 이 먼저다
- 재발송 판정은 행사를 잠그지 않는다. 판정과 `PENDING` 전환 사이에 신청 상태가 바뀔 수 있지만, 그 틈은 기존 재발송(행 단위 조건부 갱신)과 같은 수준으로 둔다
- notification 스펙 「재발송 가능 조건」 표와 `ResendSkipReason` 에 반영하는 일은 구현 PR 에서 한다

### 탈퇴와 메일 예약의 순서

PR #479 리뷰: 메일 작업이 계정 · 이메일을 읽은 뒤 탈퇴가 기존 알림을 정리하고 계정을 지우면, 메일 작업이 앞서 읽은 이메일로 새 예약을 만들 수 있다. 특히 취소 안내 대상은 신청 상태가 이미 `CANCELLED` 라 「유효 신청 취소」만으로는 빠진다.

- 회원 탈퇴(`AccountDeletionService`)는 `ACCOUNT` 쓰기 잠금 뒤 그 계정 신청이 걸린 **모든** `CLUB_EVENT` 를 ID 오름차순으로 쓰기 잠금한다. 유효 신청이 걸린 행사뿐 아니라 이미 `CANCELLED` 인 행사(`CANCEL_REASON = EVENT_CANCELLED` 취소 안내 대상 행)도 잠근다. 그 뒤 신청을 정리하고, 이 계정의 `NOTIFICATION` 을 `SELECT … FOR UPDATE` 로 읽어 `PENDING → CANCELLED` · 비식별한 다음 계정을 지운다 ([event-participant 「잠금 순서」](../event-participant/spec.md#잠금-순서))
- 메일 예약(`POST …/mails` · 자동 메일 구독자)은 그 행사 `CLUB_EVENT` 만 잠근다. `ACCOUNT` 는 거꾸로 잠그지 않고, 잠금 뒤 일반 조회로 읽어 **계정이 남은 사람에게만** `NOTIFICATION` 을 만든다
- 결과:
  - **메일 예약이 먼저 행사 잠금을 얻으면** 탈퇴는 그 커밋까지 기다린 뒤, 방금 만든 `NOTIFICATION` 까지 `CANCELLED` · 비식별한다
  - **탈퇴가 먼저 얻으면** 계정 삭제가 커밋된 뒤 메일 예약이 잠금을 얻는다. 메일 예약은 잠금 뒤 처음 일반 조회로 `ACCOUNT` 를 읽으므로 계정이 없음을 보고 새 예약을 만들지 않는다
- 두 순서 모두 `ACCOUNT → CLUB_EVENT` 방향이라 교착이 없다 (PR #508 R1)

- notification 스펙 · `NOTIFICATION` · `NOTIFICATION_TEMPLATE` ERD 의 `EVENT_TYPE` 값 목록과 「템플릿이 하나도 없으면」 표는 구현 PR 에서 고친다

---

## 데이터 모델 제안

ERD 문서가 없어 소스 칸은 아래 제안 이름을 쓴다. 확정은 ERD PR 에서 한다. 발송 작업은 애그리거트 루트 `EventMail`, 받는 사람은 그 안의 엔티티 (공지 `STUDY_NOTICE` · `STUDY_NOTICE_RECIPIENT` 와 같은 구조).

| 테이블 | 컬럼 | 비고 |
|---|---|---|
| EVENT_MAIL | ID · CLUB_EVENT_ID(BIGINT, ID 참조, FK 없음) · TYPE(`ANNOUNCEMENT`/`CANCELLATION`) · AUDIENCE(`ALL`/`ONLINE`/`OFFLINE`/`CANCELLED_ACTIVE`) · TEMPLATE_ID(BIGINT, ID 참조, FK 없음) · SUBJECT(VARCHAR 255) · BODY(MEDIUMTEXT) · FORMAT(`HTML`/`TEXT`) · NOTICE(TEXT, 5,000자 검증) · DISPLAY_TIME_ZONE(VARCHAR 64) · RECIPIENT_COUNT(INT) · SENDER_ACCOUNT_ID(BIGINT, FK 없음) · IDEMPOTENCY_KEY(VARCHAR 36) · CREATED_AT · UPDATED_AT | `INDEX(CLUB_EVENT_ID, CREATED_AT, ID)` 목록 정렬. `UNIQUE(SENDER_ACCOUNT_ID, IDEMPOTENCY_KEY)` 중복 보내기 방지. `INDEX(SENDER_ACCOUNT_ID)` 는 유일 제약이 겸한다 |
| EVENT_MAIL_RECIPIENT | ID · EVENT_MAIL_ID(FK, 애그리거트 안) · ACCOUNT_ID(BIGINT, FK 없음) · REGISTRATION_ID(BIGINT, ID 참조, FK 없음) · CHANNEL | `UNIQUE(EVENT_MAIL_ID, ACCOUNT_ID)`. 주소·닉네임은 두지 않는다 |

- `BODY` 는 템플릿 본문(`TEXT`, 65,535바이트)에 안내 내용(5,000자, HTML 이스케이프·`<br>` 로 늘어남)과 일정·참여 안내가 더해져 `TEXT` 를 넘을 수 있어 `MEDIUMTEXT` 로 제안한다
- `NOTICE` 를 따로 두는 이유: 공통 본문은 템플릿과 합쳐진 결과라 운영진이 쓴 글만 다시 꺼낼 수 없다. 수신자별 `PAYLOAD.notice` 와 같은 값이다. 화면에 내려 주지는 않는다 (지금 쓰는 곳 없음)
- 탈퇴: `EVENT_MAIL_RECIPIENT.ACCOUNT_ID` · `EVENT_MAIL.SENDER_ACCOUNT_ID` 는 ID 참조라 손대지 않는다 — `ACCOUNT` 가 지워지면 되짚을 수 없다 (study-notice 「`STUDY_NOTICE_RECIPIENT` 는 … 자연히 비식별」 과 같다). 공통 본문에는 닉네임이 원문 변수라 개인정보가 없다. 안내 내용에 운영진이 쓴 개인정보는 운영진 책임으로 둔다
- 행사는 지우는 API 가 없어(event Q1·Q2) 행사 삭제에 따른 고아 이력은 생기지 않는다
- `NOTIFICATION_TEMPLATE` 은 스키마 변경 없이 `EVENT_TYPE` 값만 늘어난다
- `NOTIFICATION` 은 `EVENT_TYPE` 값이 늘고, 템플릿 원문 스냅샷 컬럼 `SUBJECT_TEMPLATE`(VARCHAR 255, NULL) · `BODY_TEMPLATE`(TEXT, NULL) 두 개를 더한다 (M6, 위 「발송 내용 고정」). 기존 행은 NULL 이고 지금처럼 `TEMPLATE_ID` 로 읽는다

### 도메인 이벤트

| name | 클래스 | 언제 | aggregate · actor | 페이로드 | 구독자 |
|---|---|---|---|---|---|
| `club_event_mail.sent` | `ClubEventMailSentEvent` (domain.event, 제안) | 운영자 안내·취소 안내 발송 1건마다 | `club_event_mail` · mailId · 보낸 캡틴 | `mailId` · `clubEventId` · `type` · `recipientCount` (제목·본문·안내 내용·주소는 싣지 않는다) | `ClubEventMailEmailListener` (`BEFORE_COMMIT`, 동기 — 받는 사람마다 메일 행). ops 알림 없음 |

- [domain-events 「이벤트」](../domain-events/spec.md#이벤트) 표에는 구현 PR 에서 이 줄과 event-participant 의 두 줄을 더하고, PR #478 이 넣은 `club_event.registrations_confirmed` 줄의 구독자 칸을 채운다

## 퍼널·계측

해당 없음. 운영자 안내·자동 알림 메일이라 퍼널 단계를 바꾸지 않고, 추가·변경하는 분석 이벤트가 없다. 메일 열람·클릭이 행사 참석·재방문에 주는 영향은 이번에 측정하지 않는다 (SES 열람 추적을 켜지 않는다). 실험(A/B) 없음.

## 근거와 PRD·프로토·레포 규약의 차이

| 항목 | PRD · 프로토 · 레포 | 이 스펙 |
|---|---|---|
| 같은 조건의 템플릿 여럿 | notification: 모두 보낸다. PRD §7-1 · 프로토: 첫 양식 하나 | 행사 여섯 조건은 첫 한 건 (M1) |
| 템플릿 없음 | STUDY_NOTICE · FEEDBACK_REPLIED: 처리 롤백. USER_REGISTERED: 로그만 | 운영자 안내: 409 로 저장 없이 거절. 자동: 처리는 커밋하고 메일만 건너뛰며 누락 경보 (M2) |
| 줄바꿈 | 프로토: HTML 값의 `\n` → `<br>`. 서버 렌더러: 바꾸지 않음 | 행사 조건에 `<br>` 변환을 켠다 |
| 변수 공백 | 프로토: `{{ notice }}` 허용. 서버: `{{notice}}` 만 | 서버 규칙. 템플릿 저장 때 검증으로 거절 (제안) |
| 템플릿 변수 검사 | 프로토 `validateEventTemplate`: `{{notice}}` 필수 · 허용 변수만. 서버: 검사 없음 | 행사 조건에 같은 검사를 더한다 (제안) |
| 자동 메일 제목 접두 | 프로토: 없으면 `[StudyClub]` 을 붙인다 | 템플릿 제목 그대로 |
| 구버전 이력 보완 | 프로토 `fillLegacyEventMailPreview` | 서버에는 옛 이력이 없어 해당 없음 |
| 수신자별 결과 | 프로토: 수신자별 완성 제목·본문(`deliveries`)을 저장 | `NOTIFICATION` 에 템플릿 원문 스냅샷 + 수신자별 `PAYLOAD` 를 저장하고 폴러가 렌더링. 템플릿 수정·삭제와 무관 (M6) |
| 수신 주소 | 프로토: 이력에 원본을 저장하고 화면이 가린다 | `NOTIFICATION.RECIPIENT_VALUE` 를 서버가 가려 준다 |
| 중복 보내기 | 프로토: 막지 않음. study-notice: 1분 쿨다운 · 하루 30회 | `Idempotency-Key` 로 같은 시도만 막는다. 한도 없음 (M5) |
| 재발송 | notification: `FAILED` · 계정 존재만 본다 | 행사 조건은 현재 행사 · 신청 상태도 본다 (`STATE_CHANGED`) |
| 잠금 | event 「첫 조회로 `CLUB_EVENT`」 | 그대로. `ACCOUNT` 는 잠그지 않는다. 탈퇴만 `ACCOUNT → CLUB_EVENT` (PR #508 R1) |

## 결정 기록 (PR #479 리뷰)

리뷰: 2026-11-18, PR #479 M1~M7 · 인라인 2건 (PRD §7 · §7-1 · 「후속 구현 합의」 반영 PR #484). 잠금 순서: PR #508 R1.

| 결정 | 내용 | 반영한 곳 |
|---|---|---|
| M1 | 행사 여섯 조건 각각 ID 가 가장 작은 이메일 템플릿 한 건. 선택 UI · 사용 중 표시 없음. 삭제 · 조건 이동 시 다음으로 작은 ID. 기존 세 조건은 모두 발송 유지 | 「쓰는 템플릿」, 기존 백오피스 API 표 |
| M2 | 자동 메일은 템플릿이 없어도 처리는 커밋하고 메일만 건너뜀 + 행사 · 신청 · 알림 종류 누락 경보(반복 제한). 템플릿이 있는데 DB 오류면 전체 롤백. 운영자 안내는 템플릿 없으면 409. 복구 뒤 소급 발송 없음 | 「템플릿이 없을 때 (M2)」 |
| M3 | 개인별 일정은 예약 생성 시점의 프로필 → 신청 당시 시간대 → 행사 시간대. 예약 뒤 프로필 변경 · 재발송에도 고정, 새 메일부터 바뀐 프로필. 공통 미리보기는 선택 시간대 → 운영자 프로필 → 행사 시간대 | 「시각과 시간대」 |
| M4 | 종료 뒤에도 기간 제한 없이 안내 메일 허용. 대상은 신청 상태(`CONFIRMED`) 기준, 참가 불가 · 취소자 제외. 종료 뒤 수정 · 참가자 처리는 막고 후속 안내는 허용 | 「받는 사람」, 처리 순서, 미리보기 `blockedReason` |
| M5 | `Idempotency-Key` 로 같은 요청의 중복 접수만 막고 쿨다운 · 일일 한도 없음. 요청 중 버튼 비활성, 응답 불명 재시도는 같은 키, 성공 뒤 별도 발송은 새 키 | 「Request Headers」 |
| M6 | 취소 안내 여러 번 허용, 대상은 취소 직전 대기 · 확정이던 사람 중 계정이 남은 사람. 접수 때 템플릿 원문 스냅샷 + 개인별 PAYLOAD 를 고정해 수정 · 삭제 · 재발송에도 보존. 재발송 가능 여부는 현재 상태로 따로 검사 | 「발송 내용 고정 (M6)」, 「받는 사람」, 데이터 모델 |
| M7 | 행사 잠금을 쥔 채 수신자 · 이력 · 개인별 예약을 한 트랜잭션에 저장, 발송은 커밋 뒤. 스테이지에서 합계 20,000명까지 저장 시간 · 동시 신청/취소 대기 · 오류 확인, 지나치면 배포 전 상한 · 분리 결정 | 처리 순서 「큰 발송의 잠금 시간 (M7)」 |
| 인라인 1 | 행사 메일 재발송은 현재 행사 · 신청 상태도 검사. 목록 `canResend` 와 재발송이 같은 기준. 조건별 표 | 「재발송 가능 조건 (행사 메일)」 |
| 인라인 2 | 탈퇴와 메일 예약의 순서: 예약이 먼저면 탈퇴가 그 예약까지 정리, 탈퇴가 먼저면 새 예약 없음. 취소 안내 대상 행사까지 탈퇴가 잠근다 | 「탈퇴와 메일 예약의 순서」 |
