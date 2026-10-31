# Analytics — 이벤트 레지스트리

이벤트를 추가할 때 **코드 전에 이 파일에 먼저 행을 추가한다.**
네이밍 규칙·추가 절차는 [`README.md`](README.md) 참고.
타입 정의는 `frontend/apps/core-front/src/lib/analytics.ts` 참고.

---

## 카테고리 정의

| 카테고리      | 설명                                       |
| ------------- | ------------------------------------------ |
| `Navigation`  | 화면 진입 · 페이지 전환                    |
| `Auth`        | 로그인 · 회원가입 · 로그아웃               |
| `Onboarding`  | 가입 후 첫 설정 흐름                       |
| `Discovery`   | 스터디 · 행사 탐색 · 검색 · 필터 · 카드 클릭 |
| `Study Apply` | 스터디 신청 퍼널 (활성화 `Activated` 포함)  |
| `Study Room`  | 참여 중인 스터디(스터디룸)에서 하는 행동    |
| `User`        | 로그인 사용자 행동 (마이페이지)            |

Amplitude 데이터 탭의 이벤트 카테고리와 같은 이름을 쓴다. 디스코드 계정 연동(`My Discord Connected` · `Discord Connect Failed`)은 어느 화면에서 났든 `Onboarding` 이다 — 대부분 온보딩에서 연동하고, 화면은 `source` 로 가른다.

---

## 공통 속성 (모든 이벤트 자동 포함)

enrichment plugin이 자동 주입 — 개별 이벤트에 별도 명시 불필요.

| 속성            | 값                                     | 주입 방식                 |
| --------------- | -------------------------------------- | ------------------------- |
| `service`       | `studyclub`                            | `amplitude.ts` enrichment |
| `env`           | `production` \| `stage` \| `development` | `amplitude.ts` enrichment |
| `event_version` | `1.0.0`                                | `amplitude.ts` enrichment |
| `platform`      | `web`                                  | `amplitude.ts` enrichment |
| `locale`        | `ko` \| `en`                           | `amplitude.ts` enrichment |

서버 이벤트(`User Signed Up` 정본 · `Activated`)는 `platform=server` 다 — [트래킹 플랜](../../specs/analytics/spec.md).

---

## 이벤트 목록

### Navigation

| 이벤트명      | 설명                         | 추적 위치                        | 주요 속성                                                                                   | 구현 |
| ------------- | ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- | ---- |
| `Page Viewed` | 전체 페이지 공통 진입 (범용) | `src/components/PageViewTracker.tsx` | `page_name`, `locale`, `study_id?` (study_detail · study_room_*), `current_category?` (studies_list), `next_path?` / `referrer?` (login) | ✅   |

`page_name` 값 (`pathToPageName`):

| 화면 | `page_name` |
|---|---|
| 랜딩 · 스터디 목록 · 스터디 상세 | `landing` · `studies_list` · `study_detail` |
| 행사 목록 · 행사 상세 | `events_list` · `event_detail` |
| 공지 목록 · 공지 상세 | `notices_list` · `notice_detail` |
| 소개 · 가이드 · 약관 · 처리방침 | `about` · `guide` · `terms` · `privacy` |
| 로그인 · 온보딩 | `login` · `onboarding` |
| 마이페이지 · 내 스터디(`/my/joined`) · 찜한 스터디(`/my/saved`) · 탈퇴(`/my/leave`) | `my_page` · `my_studies` · `saved_studies` · `account_leave` |
| 스터디룸 일정 · 출석 · 공지 (`/my/joined/{id}/schedule[/attendance\|/notice]`) | `study_room_schedule` · `study_room_attendance` · `study_room_notice` |

곧장 다른 화면으로 넘기는 경로(`/my/joined/{id}`, `/my/joined/{id}/attendance`)는 세지 않는다 — 도착한 화면에서 한 번만.

### Auth

| 이벤트명                    | 설명                              | 추적 위치              | 주요 속성                      | 구현 |
| --------------------------- | --------------------------------- | ---------------------- | ------------------------------ | ---- |
| `Auth Google Login Clicked` | 구글 로그인 버튼 클릭 + 팝업 시도 | `startLogin()` 내      | `popup_blocked`                | ✅   |
| `Auth Apple Login Clicked`  | 애플 로그인 버튼 클릭 + 팝업 시도 | `startAppleLogin()` 내 | `popup_blocked`                | ✅   |
| `Auth OAuth Cancelled`      | OAuth 팝업 취소                   | `onMessage` error 분기 | `error`                        | ✅   |
| `Auth Login Completed`      | 로그인 완료                       | `exchange()` 성공 직후 | `is_new_user`, `next_path`     | ✅   |
| `Auth Login Failed`         | 로그인 실패                       | `exchange()` catch     | `error_message`, `http_status` | ✅   |
| `User Logged In`            | 온보딩을 마친 회원의 로그인 완료 (공통 규약 이벤트, GA4 `login`) | `exchange()` 성공 직후 | `method` (`google` \| `apple`) | ✅   |

### Onboarding

| 이벤트명                        | 설명             | 추적 위치                        | 주요 속성                                            | 구현           |
| ------------------------------- | ---------------- | -------------------------------- | ---------------------------------------------------- | -------------- |
| `Onboarding Started`            | 온보딩 화면 진입 | `OnboardingForm` mount           | `suggested_nickname`                                 | ✅             |
| `Onboarding Nickname Submitted` | 닉네임 입력 제출 | `PATCH /auth/onboarding` 호출 전 | `used_suggested_name`, `nickname_length`             | ✅             |
| `Onboarding Nickname Conflict`  | 닉네임 중복 발생 | API 응답 `CONFLICT` 분기         | `attempt_count`                                      | ✅             |
| `Onboarding Consents Agreed`    | 약관 동의 완료   | 동의 체크 단계                   | `terms_agreed`, `privacy_agreed`, `marketing_agreed` | ✅             |
| `Onboarding Completed`          | 온보딩 최종 완료 | 온보딩 완료 직후                 | `time_to_complete_sec`, `marketing_agreed`           | ✅             |
| `User Signed Up`                | 가입 확정 (공통 규약 이벤트). **서버가 정본**(`user.registered` 커밋 뒤, GA4 `sign_up`), 프론트는 퍼널용 Amplitude 사본 | 온보딩 완료 직후 · 서버 `AnalyticsEventListener` | `method`, `signup_surface` | ✅ |
| `Onboarding Discord Skipped`    | 온보딩 디스코드 단계 「건너뛰기」 | `OnboardingDiscord` `skip()` | `after_not_in_guild` (서버 미가입 안내를 본 뒤였나) | ✅ |
| `My Discord Connected`          | 디스코드 계정 연동 성공 — 연동 API 204 | `lib/discord.ts` `linkDiscord()` 안에서만 | `source` (`onboarding` \| `apply_gate` \| `my_page`) | ✅ |
| `Discord Connect Failed`        | 디스코드 계정 연동 실패 — 팝업 단계 · 연동 API 단계 모두 | `lib/discord.ts` `linkDiscord()` 안에서만 | `source`, `reason` (`cancelled` \| `popup_blocked` \| `not_in_guild` \| `already_linked` \| `session_expired` \| `error`), `http_status` | ✅ |

### Discovery

| 이벤트명                   | 설명                         | 추적 위치                           | 주요 속성                                               | 구현 |
| -------------------------- | ---------------------------- | ----------------------------------- | ------------------------------------------------------- | ---- |
| `Hero CTA Clicked`         | 랜딩 히어로 CTA 클릭         | `src/components/HeroCTAButton.tsx`  | `cta_type` (`discord` \| `studies`)                     | ✅   |
| `Study Filter Tab Changed` | 모집 상태 탭 전환 (`all` · `recruiting` · `ongoing` · `closed`). 새 조건의 결과가 로드된 뒤 발화 — `result_count` 는 바뀐 뒤의 결과 수 | `StudyBrowser.tsx` 탭 버튼 | `tab`, `result_count`, `category` | ✅   |
| `Study Category Filtered`  | 카테고리 칩 선택. 결과 로드 후 발화 | `StudyBrowser.tsx` FilterOption     | `category`, `result_count`, `tab`                                             | ✅   |
| `Study Searched`           | 검색어 입력 커밋. 결과 로드 후 발화, 같은 검색어 재입력은 안 보냄 | `StudyBrowser.tsx` `commitSearch()` | `query_length`, `result_count`, `has_results`                                 | ✅   |
| `Study Card Clicked`       | 스터디 카드 클릭             | `src/components/StudyListCard.tsx`      | `study_id`, `study_title_ko`, `study_category`, `study_status`, `source`, `card_position` | ✅   |
| `Study Bookmarked`         | 북마크 추가                  | `BookmarkButton` toggle             | `study_id`, `source`                                                          | ⬜ (하트 버튼이 화면에 없다 — `BookmarkButton` 은 어디서도 그리지 않는다) |
| `Study Unbookmarked`       | 북마크 해제                  | 찜한 스터디 `handleUnbookmark()` (`source=saved_page`) · `BookmarkButton` | `study_id`, `source`                                 | ✅ (찜한 스터디만) |
| `Event Card Clicked`       | 행사 행 클릭                 | `src/components/EventCard.tsx` `EventRow` | `event_id`, `event_title_ko`, `source` (`landing` \| `events_list`) | ✅   |

### Study Apply

| 이벤트명                         | 설명                                 | 추적 위치                            | 주요 속성                                                                      | 구현        |
| -------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------ | ----------- |
| `Study Apply CTA Clicked`        | 신청하기 버튼 클릭                   | `ApplyButton.tsx` `requestApply()`   | `study_id`, `study_title_ko`, `study_category`, `study_status`, `has_external_form` | ✅          |
| `Study Apply External Opened`    | 외부 폼 링크 이탈                    | `ApplyButton` 외부 링크 클릭         | `study_id`, `study_title_ko`                                                                          | ✅          |
| `Study Apply Dialog Opened`      | 신청 다이얼로그 열림                 | `ApplyDialog` form 로드 후           | `study_id`, `has_fixed_schedule`, `my_region`                                                         | ✅          |
| `Study Apply Slots Selected`     | 가능 시간 선택 변경 (debounce 500ms) | `ApplyDialog` days useEffect         | `study_id`, `selected_slots_count`, `selected_days`, `region`                       | ✅          |
| `Study Apply Motivation Entered` | 지원 동기 입력 완료                  | `ApplyDialog` motivation blur/submit | `study_id`, `motivation_length`                                                                       | ⬜ (미구현) |
| `Study Apply Submitted`          | 신청 제출 (API 호출 전)              | 검증 통과 후 API 호출 직전           | `study_id`, `study_title_ko`, `study_category`, `study_status`, `has_fixed_schedule`, `selected_slots_count`, `region`, `schedule_confirmed` | ✅          |
| `Study Apply Completed`          | 신청 완료 확정                       | `setDone(true)` 직후                 | `study_id`, `study_title_ko`, `study_category`, `study_status`, `apply_type`                          | ✅          |
| `Study Apply Failed`             | 신청 실패                            | `submit()` catch                     | `study_id`, `error_type`, `validation_field`                                                          | ✅          |
| `Study Apply Dialog Dismissed`   | 신청 중 다이얼로그 닫기              | `close()` (done=false)               | `study_id`, `interaction_step`                                                                        | ✅          |
| `Activated`                      | 계정의 **첫** 신청 저장 (공통 규약 이벤트, 서버, GA4 `activated`) | 서버 `AnalyticsEventListener` (`study_application.submitted`) | `activation_action` (`study_applied`), `study_id` | ✅ |

### Study Room

| 이벤트명                        | 설명                              | 추적 위치                         | 주요 속성                          | 구현 |
| ------------------------------- | --------------------------------- | --------------------------------- | ---------------------------------- | ---- |
| `Study Presenter Registered`    | 회차 발표자 신청 성공             | `ScheduleTab.tsx` `sign()` API 성공 뒤 | `study_id`, `meeting_id`, `slot` (1 \| 2) | ✅ |
| `Study Presenter Unregistered`  | 회차 발표자 신청 취소 성공        | `ScheduleTab.tsx` `sign()` API 성공 뒤 | `study_id`, `meeting_id`, `slot`   | ✅ |
| `Study Discord Opened`          | 정보 카드 「디스코드」 버튼 (스터디 채널로 이동) | `StudyInfoCard.tsx`        | `study_id`                         | ✅ |

### User

| 이벤트명                   | 설명               | 추적 위치           | 주요 속성                      | 구현           |
| -------------------------- | ------------------ | ------------------- | ------------------------------ | -------------- |
| `My Application Cancelled` | 신청 취소          | —                   | `study_id`, `applied_at`, `days_since_apply` | ⬜ (신청 취소 화면 없음 — 타입에도 없다) |
| `My Profile Updated`       | 프로필 수정 완료   | 프로필 저장 성공 후 | `changed_fields`, `new_region` | ✅             |

탈퇴 완료 이벤트는 보내지 않는다 — 사유를 계정과 잇지 않는 정책 때문 ([user-leave §퍼널·계측](../../specs/user-leave/spec.md#퍼널계측)).

---

## 유저 프로퍼티 (identify)

`user_id` 는 회원 번호다 (이메일·이름 아님). 세션 user 가 바뀔 때마다 `syncAnalyticsUser()` 가 맞추고, 로그아웃하면 `reset()` 한다 — [`README.md`](README.md) §사용자 식별.

| 속성                     | 타입           | 설정 시점                                         | 구현 |
| ------------------------ | -------------- | ------------------------------------------------- | ---- |
| `user_locale`            | `'ko' \| 'en'` | 앱 초기화 / locale 변경 시 (`PageViewTracker`)    | ✅   |
| `user_region`            | `string`       | 세션 user 변경 시 — 로그인 · 온보딩 완료 · 프로필 수정 | ✅   |
| `is_onboarding_complete` | `boolean`      | 세션 user 변경 시                                 | ✅   |
| `discord_connected`      | `boolean`      | 디스코드 연결/해제 시                             | ⬜   |
| `applications_count`     | `number`       | `Study Apply Completed` 마다 increment            | ⬜   |
| `bookmarks_count`        | `number`       | 북마크 변경 시                                    | ⬜ (기능 미구현) |

---

## 핵심 퍼널

### 스터디 신청 퍼널

```
Page Viewed (page_name = landing)
  → Page Viewed (page_name = studies_list)
  → Study Card Clicked
  → Page Viewed (page_name = study_detail)
  → Study Apply CTA Clicked
  → Study Apply Completed
```

### 디스코드 연동 관문 (신청 직전)

```
Study Apply CTA Clicked
  → My Discord Connected (source = apply_gate)   ← 실패는 Discord Connect Failed (reason 으로 원인)
  → Study Apply Dialog Opened
  → Study Apply Completed
```
