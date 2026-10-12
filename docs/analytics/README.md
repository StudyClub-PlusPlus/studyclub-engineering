# Analytics — Amplitude 연동 가이드

StudyClub++ 프론트엔드 분석 도구로 **Amplitude**를 사용한다.
이벤트 목록은 [`events.md`](events.md)에서 관리한다.

---

## 설치 위치

| 항목 | 위치 |
|---|---|
| SDK 초기화 | `frontend/apps/core-front/src/lib/amplitude.ts` |
| 앱 진입 마운트 | `frontend/apps/core-front/src/app/providers.tsx` — `<AmplitudeInit />` |
| API 키 템플릿 | 루트 `.env.example` — `NEXT_PUBLIC_AMPLITUDE_API_KEY=` 항목 (이미 포함) |
| API 키 (로컬) | 루트 `.env` (gitignore 대상) — `cp .env.example .env` 후 값 채움 |
| API 키 (배포) | GitHub Actions Secret → `NEXT_PUBLIC_AMPLITUDE_API_KEY` |

> 로컬에서 Next.js가 루트 `.env`를 읽으려면 앱 폴더에 심링크가 필요하다.
> ONBOARDING.md에 이미 포함된 단계다:
> ```bash
> ln -sfn ../../../.env frontend/apps/core-front/.env.local
> ```
> API 키는 Amplitude 인제스트 키로 **클라이언트 노출이 설계 의도**이지만,
> 공개 레포이므로 `.env`에 두고 절대 커밋하지 않는다.

---

## Environment 분리

모든 이벤트에 `environment` 속성이 자동으로 붙는다 (`amplitude.ts` enrichment plugin).

| 실행 방식 | `environment` 값 |
|---|---|
| `next dev` | `development` |
| `next build` + 배포 | `production` |

Amplitude 대시보드에서 `environment = production` 필터로 로컬 테스트 이벤트를 제외할 수 있다.

---

## 네이밍 컨벤션

### 이벤트명 — Title Case

```
Viewed Home Page       ✅
viewed_home_page       ❌
viewHomePage           ❌
```

- **과거형 동사 + 목적어** 패턴: `Viewed`, `Clicked`, `Submitted`, `Signed Up`, `Completed`
- 화면 진입은 `Viewed <Page Name>`
- 버튼·링크 클릭은 `Clicked <Element Name>`
- 폼 제출은 `Submitted <Form Name>`

### 이벤트 속성명 — snake_case

```typescript
amplitude.track('Submitted Study Application', {
  study_id: '123',        // ✅
  study_name: 'React',    // ✅
  studyId: '123',         // ❌
  StudyId: '123',         // ❌
});
```

- 값이 ID면 `_id` suffix: `study_id`, `user_id`
- 카테고리·타입은 `_type`, `_category`: `study_category`
- Boolean은 `is_` prefix: `is_logged_in`

### 공통 속성 (모든 이벤트에 자동 포함)

| 속성 | 값 | 주입 방식 |
|---|---|---|
| `environment` | `production` \| `development` | enrichment plugin 자동 주입 |

---

## 이벤트 추가 방법

1. **[`events.md`](events.md)에 먼저 행을 추가한다** — 코드보다 스펙이 먼저
2. 해당 컴포넌트/페이지에 `amplitude.track()` 호출 추가
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
