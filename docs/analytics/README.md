# Analytics — Amplitude 연동 가이드

StudyClub 프론트엔드 분석 도구로 **Amplitude**를 사용한다.
이벤트 목록은 [`events.md`](events.md)에서 관리한다.

---

## 설치 위치

| 항목 | 위치 |
|---|---|
| SDK 초기화 | `frontend/apps/core-front/src/lib/amplitude.ts` |
| 앱 진입 마운트 | `frontend/apps/core-front/src/app/providers.tsx` — `<AmplitudeInit />` |
| API 키 템플릿 | 루트 `.env.example` — `NEXT_PUBLIC_AMPLITUDE_API_KEY=` 항목 (이미 포함) |
| API 키 (로컬) | 루트 `.env` (gitignore 대상) — `cp .env.example .env` 후 값 채움 |
| API 키 (배포) | GitHub Actions **Environment** 시크릿 `NEXT_PUBLIC_AMPLITUDE_API_KEY` — `stage` · `production` 에 같은 이름으로, 값은 환경마다 다르다 (`STAGE_` 접두사 쓰지 않음) |

> 로컬에서 Next.js가 루트 `.env`를 읽으려면 앱 폴더에 심링크가 필요하다.
> ONBOARDING.md에 이미 포함된 단계다:
> ```bash
> ln -sfn ../../../.env frontend/apps/core-front/.env.local
> ```
> API 키는 Amplitude 인제스트 키로 **클라이언트 노출이 설계 의도**이지만,
> 공개 레포이므로 `.env`에 두고 절대 커밋하지 않는다.

---

## 환경 분리 — 프로젝트(키)로 가른다

stage 와 production 은 **Amplitude 프로젝트가 다르다.** 키가 다르니 이벤트가 섞이지 않는다 — 이벤트 속성으로 환경을 구분하지 않는다.

| 실행 방식 | 들어가는 곳 |
|---|---|
| 로컬 `next dev` | `.env` 에 넣은 키의 프로젝트 — **stage 키를 쓴다** |
| `develop` 배포 (stage) | stage 프로젝트 |
| `main` 배포 (production) | production 프로젝트 |

키가 비어 있으면 SDK 를 아예 부르지 않는다 (`analyticsEnabled`). 로컬에서 분석이 필요 없으면 비워 둔다.

---

## 네이밍 컨벤션

### 이벤트명 — Title Case, `<대상> <과거형 동사>`

```
Study Card Clicked     ✅
Clicked Study Card     ❌  (동사가 앞)
study_card_clicked     ❌
```

- **대상(명사) + 과거형 동사** 패턴 — 같은 대상의 이벤트가 목록에서 한데 모인다 (`Study Apply …`, `Onboarding …`)
- 화면 진입은 이벤트를 따로 만들지 않는다 — `Page Viewed` 하나에 `page_name` 으로 가른다
- 클릭은 `<Element> Clicked`, 제출은 `<Form> Submitted`, 확정은 `<Flow> Completed`

### 이벤트 속성명 — snake_case

```typescript
track({
  name: 'Study Apply Submitted',
  props: {
    study_id: '123',        // ✅
    study_title_ko: 'React', // ✅
    // studyId: '123',      // ❌
  },
});
```

- 값이 ID면 `_id` suffix: `study_id`
- 카테고리·타입은 `_type`, `_category`: `study_category`
- Boolean은 `is_` / `has_` prefix: `is_new_user`, `has_results`
- **개인정보는 넣지 않는다** — 이메일·이름·닉네임 원문·자유 입력 원문 금지. 길이·개수·여부로 바꿔 보낸다 (`nickname_length`, `query_length`)

### 공통 속성 (모든 이벤트에 자동 포함)

| 속성 | 값 | 주입 방식 |
|---|---|---|
| `platform` | `web` | enrichment plugin 자동 주입 |
| `locale` | `ko` \| `en` | enrichment plugin 자동 주입 (URL 앞 경로) |

---

## 이벤트 추가 방법

1. **[`events.md`](events.md)에 먼저 행을 추가한다** — 코드보다 스펙이 먼저
2. 해당 컴포넌트/페이지에서 `@/lib/analytics` 의 `track()` 호출 추가 — SDK 를 직접 부르지 않는다 (이벤트 이름·속성이 `AnalyticsEvent` 타입으로 검사된다)
   - 화면 진입 이벤트 → `PageViewTracker`가 `page_name` 속성으로 자동 처리. 페이지별 추가 속성이 필요하면 `PageViewTracker.tsx`의 `extra` 블록에 추가
   - 인터랙션 이벤트 → 해당 핸들러의 성공 지점에서 호출
3. PR 설명에 "어떤 이벤트를 어디서 추적하는지" 명시

```typescript
// 예시 — 버튼 클릭 이벤트
import { track } from '@/lib/analytics';

track({ name: 'Study Card Clicked', props: { study_id: '123', card_position: 0, source: 'studies_list' } });
```

---

## Autocapture

`sessions: true` 만 활성화. 나머지(`pageViews`, `elementInteractions`, `formInteractions`, `webVitals`)는 비활성화.

- ✅ 세션 시작/종료 자동 수집
- ❌ 페이지 뷰 — `PageViewTracker` 컴포넌트(`src/components/PageViewTracker.tsx`)가 담당
- ❌ 클릭/폼 — 명시적 이벤트로만 추적

명시적 이벤트는 **비즈니스 의미가 있는 순간**에만 추가한다.

---

## 사용자 식별

| 무엇 | 어떻게 |
|---|---|
| `user_id` | 회원 번호(`SessionUser.id`) 문자열. **이메일·이름은 보내지 않는다** |
| 맞추는 곳 | `providers.tsx` 의 `AmplitudeInit` — 세션 user 가 바뀔 때 쏘는 `USER_CHANGED_EVENT` 를 듣고 `syncAnalyticsUser()` 를 부른다. 로그인·로그아웃·프로필 저장·401 세션 만료가 모두 이 이벤트를 쏜다 |
| 로그아웃 | `amplitude.reset()` — 기기 id 까지 새로 받아 같은 브라우저의 다음 사람과 이어지지 않게 한다 |
| `minIdLength: 1` | 회원 번호가 짧아서 필요하다. 기본값(5자)이면 로그인 사용자가 전부 익명으로 남는다 |
| IP | `trackingOptions.ipAddress: false` — 수집하지 않는다 |

## 개인정보 처리방침

Amplitude(미국)는 **수탁자이자 국외 이전 대상**이다. 방침 제7조·제8조에 행이 있다 — 이전 항목을 바꾸면(새 속성에 회원 정보가 들어가면) 방침도 같은 PR 에서 고친다.
