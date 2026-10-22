# 분석 이벤트 (트래킹 플랜)

> 상태: 1단계 구현 · 프론트: `frontend/apps/core-front/src/lib/{amplitude,analytics}.ts` · 서버: `backend/api/src/main/java/com/studyclub/api/analytics/`

사용자 사이트(core-front)의 행동 분석. 백오피스는 대상이 아니다.
이 표에 없는 이벤트를 코드에 추가하지 않는다 — 추가할 때는 이 표부터 고친다.

## 도구

| 도구 | 무엇을 보나 | 언제 로드하나 | env |
|---|---|---|---|
| Amplitude | 이벤트 퍼널·리텐션 | 키가 있으면 (stage·production 프로젝트가 따로) | `NEXT_PUBLIC_AMPLITUDE_API_KEY` (프론트) · `AMPLITUDE_API_KEY` (서버) |
| GA4 | 유입 채널·페이지 조회 | **production 빌드에서만** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| Microsoft Clarity | 세션 녹화·히트맵 | **production 빌드에서만** | `NEXT_PUBLIC_CLARITY_PROJECT_ID` |

- production 판정은 빌드 인자 `NEXT_PUBLIC_APP_ENV=production` (main 배포만). stage 는 `stage`
- 키가 비면 그 도구는 아예 부르지 않는다. 로컬은 전부 비워 둔다
- 값은 레포에 적지 않는다 — GitHub Environment 시크릿 → 빌드 인자 (서버 키는 배포 env)

## 식별

- `user_id` = 회원 번호 문자열 (`String(account.id)`). 프론트·서버가 **같은 값**을 쓴다
- 회원 번호가 짧아 Amplitude 기본 최소 길이(5자)에 걸린다 → 브라우저 SDK `minIdLength: 1`, 서버 HTTP V2 요청 `options.min_id_length: 1`
- 이메일·이름·닉네임은 user_id 에도, Clarity 에도 넣지 않는다. Clarity 는 `identify(회원 번호)` + 태그 `service`·`env`
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
| 페이지 조회 | `Page Viewed` (수동, `page_name`) | `page_view` (자동, SPA 이동 포함) | page_name, locale | front | `PageViewTracker` |
| 가입 | `User Signed Up` | `sign_up` | method=`google`, signup_surface=`onboarding` | **server 정본** + front 퍼널 사본 | 온보딩 최초 완료 (`user.registered`) |
| 로그인 | `User Logged In` | `login` | method=`google` | front | 온보딩을 마친 회원의 로그인 완료 |
| 활성화 | `Activated` | — | activation_action=`study_applied`, study_id | server | 계정의 **첫** 스터디 신청 저장 (`study_application.submitted`) |

- 서버 이벤트 `insert_id` 는 결정적이다: `user_signed_up_account_{id}` · `activated_account_{id}` — 재전송돼도 Amplitude 가 중복을 지운다
- 서버는 커밋 뒤·비동기로 보내고 실패는 삼킨다 ([domain-events](../domain-events/spec.md))
- 활성화 정의는 가설이다 — 4주 코호트로 확정한다

## 서비스 이벤트 (front)

| 이벤트 | 지점 |
|---|---|
| `Auth Google Login Clicked` · `Auth OAuth Cancelled` · `Auth Login Completed{is_new_user}` · `Auth Login Failed` | 로그인 화면 |
| `Onboarding Started` · `Onboarding Nickname Submitted` · `Onboarding Nickname Conflict` · `Onboarding Consents Agreed` · `Onboarding Completed` | 온보딩 |
| `Study Filter Tab Changed` · `Study Category Filtered` · `Study Searched` · `Study Card Clicked` · `Hero CTA Clicked` · `Event Card Clicked` | 탐색 |
| `Study Bookmarked` · `Study Unbookmarked` (`study_id`, `source`) | 하트 버튼 · 마이페이지 관심 스터디 |
| `Study Apply CTA Clicked` · `Study Apply External Opened` · `Study Apply Dialog Opened` · `Study Apply Slots Selected` · `Study Apply Submitted` · `Study Apply Completed` · `Study Apply Failed` · `Study Apply Dialog Dismissed` | 신청 |
| `My Discord Connected` | 신청 전 디스코드 연동 창 (연동 API 가 붙기 전까지는 목 연동) |
| `My Application Cancelled` · `My Profile Updated` | 마이페이지 |

정의만 있고 보내지 않는 것: `Study Apply Motivation Entered` — 신청 폼에 지원 동기 입력란이 아직 없다.

## 개인정보

- IP 수집 끔 (`trackingOptions.ipAddress: false`)
- Clarity 는 프로필 카드(이메일·사진·닉네임)를 `data-clarity-mask` 로 가린다
- 처리방침 기재 방식 · 쿠키 동의 · user_id 와 세션 녹화 결합 여부는 **법무 확인 필요**
