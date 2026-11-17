# 분석 이벤트 (트래킹 플랜)

> 상태: 1단계 구현 · 프론트: `frontend/apps/core-front/src/lib/{amplitude,analytics}.ts` · 서버: `backend/api/src/main/java/com/studyclub/api/analytics/`

사용자 사이트(core-front)의 행동 분석. 백오피스는 대상이 아니다.
이 표에 없는 이벤트를 코드에 추가하지 않는다 — 추가할 때는 이 표부터 고친다.

## 도구

| 도구 | 무엇을 보나 | 언제 로드하나 | env |
|---|---|---|---|
| Amplitude | 이벤트 퍼널·리텐션 | 키가 있으면 (stage·production 프로젝트가 따로) | `NEXT_PUBLIC_AMPLITUDE_API_KEY` (프론트) · `AMPLITUDE_API_KEY` (서버) |
| GA4 | 유입 채널·페이지 조회 | **production 빌드에서만** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| GA4 (서버, Measurement Protocol) | 가입·활성화 키 이벤트 | 두 env 가 다 있을 때 | `GA4_MEASUREMENT_ID` · `GA4_API_SECRET` |
| Microsoft Clarity | 세션 녹화·히트맵 | **production 빌드에서만** | `NEXT_PUBLIC_CLARITY_PROJECT_ID` |

- production 판정은 빌드 인자 `NEXT_PUBLIC_APP_ENV=production` (main 배포만). stage 는 `stage`
- GA4·Amplitude는 키 외에도 분석 허용 상태를 확인한 뒤 수집한다.
- 키가 비면 그 도구는 아예 부르지 않는다. 로컬은 전부 비워 둔다
- 값은 레포에 적지 않는다 — GitHub Environment 시크릿 → 빌드 인자 (서버 키는 배포 env)

## 식별

- `user_id` = `ACCOUNT_ANALYTICS.ANALYTICS_USER_ID`. 서버 HMAC-SHA256으로 한 번 생성·저장하고 프론트·서버가 같은 값을 쓴다
- 분석 ID는 `키버전_64자리 hex`. 회원번호·비밀키 원문은 분석 도구로 보내지 않는다. Clarity에도 같은 HMAC 분석 ID를 사용한다.
- 이메일·이름·닉네임은 user_id 에도, Clarity 에도 넣지 않는다. Clarity는 허용 확인 후 `identify(분석 ID)` + 태그 `service`·`env`를 적용한다.
- 로그아웃하면 Amplitude `reset()` (기기 id 새로) + 첫 유입 기록 삭제

## 공통 속성 (모든 이벤트)

| 키 | 값 |
|---|---|
| `service` | `studyclub` |
| `env` | `production` · `stage` · `development` |
| `event_version` | `1.0.0` |
| `platform` | `web` (프론트) · `server` (서버) |
| `locale` | `ko` · `en` (프론트) |

## 첫 유입 (유저 속성, 가입 때 setOnce)

처음 들어온 방문의 `utm_*`(소문자) · 랜딩 경로 · 외부 referrer 호스트를 브라우저에 기억해 두었다가 가입 완료 때 한 번만 붙인다.
`acquisition_source` · `acquisition_medium` · `acquisition_campaign` · `acquisition_content` · `acquisition_term` · `acquisition_landing_path` · `acquisition_referrer_host`

## 공통 규약 이벤트

| 행동 | Amplitude | GA4 | 속성 | 보내는 곳 | 지점 |
|---|---|---|---|---|---|
| 페이지 조회 | `Page Viewed` (수동, `page_name`) | `page_view` (수동, 허용 확인 후 SPA 이동 포함) | page_name, locale | front | `PageViewTracker` |
| 가입 | `User Signed Up` | `sign_up` | method=`google`·`apple`, signup_surface=`onboarding` | **server 정본** (GA4: server(MP)) + front 퍼널 사본 (Amplitude 만) | 온보딩 최초 완료 (`user.registered`) |
| 로그인 | `User Logged In` | `login` | method=`google`·`apple` | front | 온보딩을 마친 회원의 로그인 완료 |
| 활성화 | `Activated` | `activated` | activation_action=`study_applied`, study_id (GA4 는 activation_action 만) | server (GA4: server(MP)) | 계정의 **첫** 스터디 신청 저장 (`study_application.submitted`) |

- `page_name` 값 (경로 → 이름, `PageViewTracker` 의 `pathToPageName`): `landing` · `studies_list` · `study_detail` · `events_list` · `event_detail` · `notices_list` · `notice_detail` · `about` · `guide` · `terms` · `privacy` · `login` · `onboarding` · `my_page` · `my_studies`(`/my/joined`) · `saved_studies`(`/my/saved`) · `account_leave`(`/my/leave`) · `study_room_schedule` · `study_room_attendance` · `study_room_notice`(`/my/joined/{id}/schedule[/attendance|/notice]`). `study_detail` · `study_room_*` 는 `study_id` 를 함께 보낸다. 곧장 다른 화면으로 넘기는 경로(`/my/joined/{id}`, `/my/joined/{id}/attendance`)는 세지 않는다
- 서버 이벤트 `insert_id` 는 결정적이다: `user_signed_up_{analyticsId}` · `activated_{analyticsId}` — 재전송돼도 Amplitude 가 중복을 지운다
- 서버는 커밋 뒤·비동기로 보내고 실패는 삼킨다 ([domain-events](../domain-events/spec.md))
- GA4 서버 전송 client_id: 가입 = 온보딩 요청 바디 `gaClientId`(현재 계정에 등록한 브라우저 식별자). 없으면, 그리고 활성화는 항상 분석 ID에서 파생한 숫자형 client_id — **유입 귀속 안 됨**
- 활성화 정의는 가설이다 — 4주 코호트로 확정한다

## 서비스 이벤트 (front)

| 이벤트 | 지점 |
|---|---|
| `Auth Google Login Clicked` · `Auth Apple Login Clicked` · `Auth OAuth Cancelled` · `Auth Login Completed{is_new_user}` · `Auth Login Failed` | 로그인 화면 |
| `Onboarding Started` · `Onboarding Nickname Submitted` · `Onboarding Nickname Conflict` · `Onboarding Consents Agreed` · `Onboarding Completed` | 온보딩 |
| `Onboarding Discord Skipped{after_not_in_guild}` | 온보딩 디스코드 단계의 「건너뛰기」. `after_not_in_guild` = 서버 미가입 안내를 본 뒤에 건너뛰었나 |
| `Study Filter Tab Changed` · `Study Category Filtered` · `Study Searched` · `Study Card Clicked` · `Hero CTA Clicked` · `Event Card Clicked` | 탐색 |
| `Study Bookmarked` · `Study Unbookmarked` (`study_id`, `source`) | 하트 버튼 · 찜한 스터디(`source=saved_page`, 해제만) |
| `Study Apply CTA Clicked` · `Study Apply External Opened` · `Study Apply Dialog Opened` · `Study Apply Slots Selected` · `Study Apply Submitted` · `Study Apply Completed` · `Study Apply Failed` · `Study Apply Dialog Dismissed` | 신청 |
| `My Discord Connected` (`source`=`onboarding`·`apply_gate`·`my_page`) | 온보딩 디스코드 단계 · 신청 전 디스코드 연동 창 · 마이페이지 디스코드 줄 — OAuth 팝업으로 받은 코드가 연동 API 에서 204 일 때 (개발 서버는 목 연동). 연동 함수 `linkDiscord` 안에서만 보낸다 — 연동 화면이 늘어도 빠지지 않는다 |
| `Discord Connect Failed` (`source`, `reason`=`cancelled`·`popup_blocked`·`not_in_guild`·`already_linked`·`session_expired`·`error`, `http_status`) | 위 세 곳에서 연동이 실패했을 때 — 팝업 단계(창 닫기·차단)와 연동 API 단계(403 서버 미가입 · 409 다른 계정에 연결됨 · 401 · 그 외) 모두. `linkDiscord` 안에서만 보낸다 |
| `My Profile Updated` | 마이페이지 |
| `Study Presenter Registered` · `Study Presenter Unregistered` (`study_id`, `meeting_id`, `slot`) | 스터디룸 일정 탭 — 발표자 신청·취소 API 가 성공했을 때 |
| `Study Discord Opened` (`study_id`) | 스터디룸 정보 카드의 「디스코드」 버튼 (스터디 채널로 이동) |

정의만 있고 보내지 않는 것: `Study Apply Motivation Entered` — 신청 폼에 지원 동기 입력란이 아직 없다.

## 개인정보

- IP 수집 끔 (`trackingOptions.ipAddress: false`)
- Clarity 는 프로필 카드(이메일·사진·닉네임)를 `data-clarity-mask` 로 가린다
- 처리방침 기재 방식 · 쿠키 동의 · user_id 와 세션 녹화 결합 여부는 **법무 확인 필요**


## 분석 개인정보 관리 (2026-11-08)

### 범위와 저장

- 수집 중단은 GA4·Amplitude·Clarity에 적용하며 기존 기록 삭제는 GA4·Amplitude만 연동한다. 사용자·관리자 문의 UI는 변경하지 않는다. 플레이그라운드 버튼·시연 데이터는 제거한다.
- ACCOUNT는 변경하지 않는다. ACCOUNT_ANALYTICS 한 테이블에 HMAC ID, OPTED_OUT_AT, GA_CLIENT_IDS, GA4_DELETION_STATUS, AMPLITUDE_DELETION_STATUS, AMPLITUDE_DELETION_IDS, AMPLITUDE_DELETION_REQUESTED_AT 및 공통 생성·수정 시각을 저장한다.
- 별도 삭제 작업 테이블, KEY_VERSION, DELETION_REQUEST_ID, 탈퇴 여부, NEXT_ATTEMPT_AT은 두지 않는다. HMAC 키 버전은 ID 접두어·서버 설정으로만 관리한다.
- 키 미설정 시 회원 분석을 끄며 원문 회원번호로 우회하지 않는다. 기존 실사용자 이관은 필요 없다.
- 분석 행은 탈퇴 후에도 필요한 외부 삭제가 끝날 때까지 유지한다. 회원 테이블에 행이 없으면 탈퇴한 대상으로 판단한다.

### API

| 메서드 | 경로 | 동작 | 권한 |
|---|---|---|---|
| GET | /api/me/analytics | `{userId, enabled, optedOutAt}`. no-store | 본인 |
| POST | /api/me/analytics/browser | `{clientId}` 숫자.숫자 형식 등록. 최대 128개, 중복 제거 | 본인 |
| POST | /api/admin/feedbacks/{feedbackId}/analytics-opt-out | 문의 작성자의 수집 중단·삭제 시작·감사 기록. 관리자용 상태 반환 | ADMIN |
| GET | /api/admin/feedbacks/{feedbackId} | 기존 응답에 `analytics` 추가. 식별자 원문 없이 수집·삭제 상태 조회 | ADMIN |

- 관리자 상태: `{accountExists, enabled, canOptOut, optedOutAt, ga4DeletionStatus, amplitudeDeletionStatus}`. 분석 행이 없으면 삭제 상태는 null이며, 삭제 완료를 추정하지 않는다.
- 상태는 NOT_REQUESTED(미접수·재시도 대기), REQUESTED(접수), DONE(완료 확인). GA4 REQUESTED를 DONE으로 자동 변경하지 않는다.
- 중단은 기존 관리자 권한을 재검사한다. 문의 작성자를 서버에서 찾아 회원·분석 행 순서로 잠근다. 반복 호출은 중단 시각과 감사 기록을 중복 생성하지 않는다.
- 중단 설정·감사 기록을 같은 트랜잭션에 저장한다. 실패 시 모두 롤백. 문의 상태·회신·메모는 변경하지 않는다.
- 미인증 401, 일반 회원 403, 없는 문의/탈퇴한 작성자 404. 별도 삭제 목록·강제 완료 API는 제공하지 않는다.

### 전송과 삭제 실행

- 서버는 전송 직전에 계정·분석 상태를 검사한다. 브라우저는 최초 조회 전 전송하지 않고 활성 탭 30초 갱신·45초 허용 유효기간·포커스/인증 변경 때 상태를 다시 확인한다. 실패 시 중단한다. 인증 만료(401)는 영구 거부로 저장하지 않고 재로그인 후 다시 조회한다. 명시적 optedOutAt·탈퇴 중단은 유지한다. 일시 중단 후 재개는 같은 페이지 방문을 중복 집계하지 않으며 실제 경로 이동·새로고침은 새 방문으로 집계한다.
- Clarity는 허용 전 태그를 로드하지 않고, 비동기 로딩 완료 후 최신 상태를 다시 확인해 필요하면 즉시 stop한다. 식별자는 대기열에 넣지 않으며 HMAC만 사용한다. 일시 중단 후 재개할 때 이전 비동기 identify 완료를 기다려 계정이 섞이지 않게 한다. GPC도 존중한다.
- Clarity stop은 이전 버퍼의 마지막 전송을 수행할 수 있다. 신규 수집 중단과 이전 전송/기록 삭제를 구분한다. Cookie Consent API만으로 수집 중단을 구현하지 않는다. Clarity의 기존 기록 삭제·삭제 상태는 이번 범위에 없다.
- 다른 기기에는 동기화 시차가 있다. 초기 삭제 요청은 커밋 직후 기존 정리 스케줄러에 등록하고, 열린 탭의 전송 유효기간을 고려해 90초 뒤 실행한다. 30일 대기는 없다. 메모리 예약이 재시작으로 사라져도 DB 상태를 일일 정리가 회수한다.
- 탈퇴 시 수집 중단을 저장하고 ACCOUNT만 삭제한다. 커밋 후 이벤트로 삭제를 시작하며 롤백 시 실행하지 않는다.
- 기존 cleanup 주기(시작 60초 후, 이후 작업 종료부터 24시간)로 탈퇴 또는 OPTED_OUT_AT이 있는 회원을 키 순서로 나누어 확인한다. 회원별 다음 실행 시각은 저장하지 않는다.
- GA4는 HMAC userId, 서버 clientId, 저장된 브라우저 clientId를 모두 요청한 뒤 REQUESTED. 일부 실패면 전체를 다음 실행에서 다시 요청할 수 있다. 식별자를 먼저 비우지 않는다.
- Amplitude는 프로젝트 범위 v1 삭제 API를 사용한다. 반환한 내부 ID와 요청 시각을 저장하고, 그 요청에 해당하는 모든 ID가 done이면 DONE. 성공 응답의 invalid_ids에 요청한 HMAC ID가 명시되면 NOT_REQUESTED 상태에서 기존 AMPLITUDE_DELETION_REQUESTED_AT에 최초 부재 확인 시각을 저장한다. 24시간 이상 뒤 같은 ID의 부재를 재확인한 경우에도 DONE으로 정리한다. 그 사이 기록이 나타나면 내부 ID와 실제 접수 시각을 저장하고 완료 조회를 진행한다. 빈 응답·다른 ID·권한/통신 오류는 부재나 완료로 처리하지 않는다.
- HTTP는 DB 트랜잭션 밖에서 호출하고, 응답은 행 잠금 아래 같은 대상·단계인지 재검사한 뒤 반영한다. 서비스별 실패를 분리한다. 중복 외부 요청은 재시작/다중 인스턴스 때 가능하다.
- 전체 정리 또는 analytics.deletion.enabled를 끄면 초기 예약과 일일 삭제 모두 중지한다. 수집 중단 상태는 유지한다.
- GA4의 모든 식별자 삭제 접수와 Amplitude 완료 확인 후 활성 회원의 식별자를 비우고 중단 시각·회원번호·상태를 유지한다. 탈퇴 회원의 행은 제거한다. 이는 로컬 식별자 정리 조건이며 GA4 실제 완료 확인은 아니다. GA4 상태는 REQUESTED로 남고 접수 이후 삭제는 Google에서 진행한다. 식별자를 한 번도 만들지 않은 회원은 삭제 대상이 없어 양쪽 DONE이다.
- 프로젝트를 바꾸면 보관 중인 ID의 삭제 대상을 잃을 수 있으므로 미처리 건이 있는 동안 GA 속성·Amplitude 프로젝트 설정을 변경하지 않는다. 식별자·키·외부 응답 원문은 로그에 남기지 않는다.
- 비회원/로그아웃한 새 브라우저를 기존 거부 회원으로 알아내지는 않는다. GA_CLIENT_IDS 제거 여부는 별도 테스트 속성에서 검증한다.
