# Component Guide

## Table of Contents

- [컴포넌트 분류](#컴포넌트-분류)
- [네이밍 규칙](#네이밍-규칙)
- [컴포넌트 작성 패턴](#컴포넌트-작성-패턴)
- [스타일링](#스타일링)

## 컴포넌트 분류

| 구분 | 위치 | 예시 |
|------|------|------|
| 페이지 | `src/app/**/page.tsx` | 라우트 엔트리 |
| 레이아웃 | `src/app/**/layout.tsx` | 공통 레이아웃 |
| 공용 UI | `frontend/packages/ui/src/` | StudyCard, Button, Modal |
| 기능 전용 UI | `src/features/<기능>/` | 신청 폼·출석부·알림 편집 |
| 앱 공통 UI | `src/components/` | AppShell, Footer |

공유 컴포넌트 라이브러리 `@studyclub/ui` (`packages/ui`) 가 존재한다. 세 앱 모두 이 패키지에 의존하고 있으므로, **새 컴포넌트를 앱 로컬에 직접 만들기 전에 먼저 확인할 것**.

**`@studyclub/ui` 제공 컴포넌트**: `Button` `Badge` `Card` `FieldShell` `Input` `Select` `Textarea` `FilterChip` `Avatar` `StatCard` `CapacityBar` `Checkbox` `Modal` `EmptyState` `Toaster` `StudyCard` `AttendanceTable` `Tabs` `Nav` `Segmented` `Pagination`

> `Input` · `Select` · `Textarea` · `FieldShell` 은 `Field.tsx` 에서 함께 export 된다.
> `FilterChip` 은 `Chip.tsx` 에서 export 된다.
> `Toaster` · `toast` 는 `Toast.tsx` 에서 함께 export 된다.
> `StudyCard` · `AttendanceTable` · `Tabs` · `Nav` · `Segmented` · `Pagination` 은 각각 해당 파일에서 export 된다.

```typescript
import { Button, Badge, Card, StudyCard, Tabs } from '@studyclub/ui';
```

두 앱에 걸쳐 공유되는 새 컴포넌트는 `packages/ui/src/` 에 추가하고 `src/index.ts` 에 export 한다.
앱 전용 컴포넌트 중 한 기능에서만 쓰는 것은 `src/features/<기능>/`, 여러 기능이 공유하는 것은 `src/components/`에 둔다.

UI에서 사용하는 공용 타입은 `@studyclub/types`, 계산 함수·상수는 `@studyclub/utils`에서 가져온다. 타입을 얻기 위해 `@studyclub/mock`을 import하거나 공용 유틸을 컴포넌트 파일에 복제하지 않는다.

## 네이밍 규칙

- 파일명: **PascalCase** (`StudyCard.tsx`, `EventBrowser.tsx`). 컴포넌트가 아닌 파일(훅·유틸)은 kebab-case — [이름 규칙](project-structure.md#파일-배치-규칙--기능-옆에-둔다)
- 컴포넌트명 = 파일명 (1파일 1컴포넌트 원칙)
- 합성어: 도메인 + 역할 (`StudyCard`, `EventBrowser`, `NavAuth`)

## 컴포넌트 작성 패턴

### Server Component (기본)

Next.js App Router 에서 컴포넌트는 기본 Server Component.
데이터 fetch, 정적 렌더링에 적합.

```tsx
// 기능 전용 표시 컴포넌트 예시. 공용 StudyCard는 @studyclub/ui에서 가져온다.
type StudySummary = { title: string; description: string };

export default function StudySummaryText({ study }: { study: StudySummary }) {
  return (
    <div>
      <h3>{study.title}</h3>
      <p>{study.description}</p>
    </div>
  );
}
```

### Client Component

인터랙션(state, effect, 이벤트 핸들러)이 필요할 때만 `'use client'` 사용.

```tsx
'use client';

import { useState } from 'react';

export default function Tabs({ items }: { items: string[] }) {
  const [active, setActive] = useState(0);
  // ...
}
```

**원칙**: `'use client'` 는 가능한 말단(leaf) 컴포넌트에만. 상위 레이아웃/페이지는 Server Component 유지.

## 폼 유효성 검사

제출 폼은 **`react-hook-form` + `zod` + `@hookform/resolvers`** 조합으로 작성한다. RHF가 입력 상태·초기화·제출을 관리하고 `zodResolver`가 제출값을 검증한다. `z.infer`는 TypeScript 타입을 추론하고, Zod의 런타임 검증은 실제 입력값을 검사한다. 서버의 권한·최종 검증은 별도로 유지한다.

- **Zod 스키마**로 타입과 검증 규칙을 한 곳에서 선언한다. `z.infer<typeof schema>`로 폼 타입을 자동 파생해 타입 중복을 없앤다.
- 조건부 검증(스터디 일정 유무 등)은 `.superRefine()`으로 표현한다.
- 커스텀 입력(버튼 그룹·토글 격자 등 DOM 입력이 아닌 필드)은 `watch` + `setValue`로 관리한다.

```tsx
// 스키마 — 컴포넌트 바깥에서 선언해 리렌더링마다 재생성되지 않게 한다
const profileSchema = z.object({
  name: z.string().min(1, '이름을 입력하세요.').refine((v) => v.trim().length > 0, '이름을 입력하세요.'),
  region: z.enum(['KR', 'NA', 'ETC']),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// 컴포넌트
const { register, handleSubmit, formState: { errors }, reset, watch, setValue } =
  useForm<ProfileFormValues>({
    defaultValues: { name, region },
    resolver: zodResolver(profileSchema),
  });

// 표준 입력 — register() 스프레드 (React 19에서 ref가 일반 prop이므로 forwardRef 불필요)
<Input {...register('name')} label='이름' error={errors.name?.message} />

// 커스텀 입력 — watch + setValue
const draftRegion = watch('region');
<button onClick={() => setValue('region', r.key)} aria-pressed={draftRegion === r.key} />

// 다이얼로그 재오픈 시 초기화
useEffect(() => {
  if (!open) return;
  reset({ name, region });
}, [open, name, region, reset]);
```

조건부 스키마가 필요할 때는 `useMemo`로 감싸 prop 변화에 반응하게 한다.

```tsx
const schema = useMemo(() => makeSchema(Boolean(fixedSchedule), locale), [fixedSchedule, locale]);
const { ... } = useForm({ resolver: zodResolver(schema) });
```

**필터·검색 UI**(`StudyBrowser`, `EventBrowser` 등)는 제출이 없는 즉시 반응 상태라 RHF 대상이 아니다. 값은 `useState` 가 아니라 **URL 쿼리**에 둔다 — [필터·검색·페이지는 URL 에](api-integration.md#필터검색페이지는-url-에).

### 적용 범위 (2026-10-31)

| 앱 | RHF + Zod 사용 폼 |
|---|---|
| core-front | 온보딩, 프로필, 스터디 신청, 탈퇴 사유, 회차 추가, 스터디 공지 작성, 스터디 규칙 편집 |
| back-office-front | 스터디 등록·다음 기수·정보 수정, 행사 등록·수정, Discord 연결, 사이트 공지, 알림 템플릿, 신청 폼 편집, 반 편집, 회차 추가·킥오프·스터디 시간·규칙 편집 |

백오피스 `validateStudyForm`·`validateEventForm`·`validateSiteNoticeForm`은 기존 호출부와 테스트용 진입점을 유지하되 내부에서 Zod 스키마를 사용한다. 시간대·반복·DST 검사 등 도메인 계산은 `superRefine`에서 기존 검사기를 호출해 미리보기와 저장의 규칙을 맞춘다. 닉네임 중복 조회와 서버 오류 처리도 유지한다.

출석·참여자·일정 표의 여러 행을 함께 저장하는 변경 집합은 기존 도메인 상태로 관리한다. 표의 선택·중단 예정·삭제 확인을 일반 입력 폼과 혼합하지 않는다. OAuth 로그인 버튼, 필터·검색, 파일 업로드의 전송 상태도 각각의 흐름에 둔다.

- 커스텀 입력은 `setValue`에 `shouldDirty`·`shouldValidate`를 필요한 시점에 지정한다. 같은 입력값을 RHF와 `useState` 양쪽에 보관하지 않는다.
- 서버가 바뀐 초기값을 주거나 창을 다시 열 때 `reset`한다. 제출 실패는 입력을 보존한다.
- resolver 검증은 비동기이므로 테스트에서도 제출 후 화면 변화를 기다린다. 중복 요청은 처리 중 잠금과 제출 가드로 막는다.
- Node 26의 전역 Web Storage와 jsdom이 충돌하는 테스트 환경에서는 `NODE_OPTIONS=--no-experimental-webstorage pnpm run test`로 jsdom 저장소를 사용한다.

## 스타일링

- **Tailwind CSS v4 (CSS-first)** 기반 스타일링
- **정본 CSS 임포트**: 각 앱의 `src/app/globals.css`는 `@studyclub/design`의 정본 CSS를 로드하고, `@source`로 공용 UI 컴포넌트를 스캔합니다.
  ```css
  /* core-front / playground */
  @import '@studyclub/design/core.css';
  @source "../../../../packages/ui/src";

  /* back-office-front */
  @import '@studyclub/design/console.css';
  @source "../../../../packages/ui/src";
  ```
- **토큰 사용 철칙**: raw HEX 리터럴(예: `#4856F5`) 사용 절대 금지. 반드시 `@studyclub/design`의 Semantic 토큰 유틸리티(`bg-brand`, `text-fg`, `text-fg-muted`, `border-border`, `rounded-control` 등)를 사용합니다.
- 인라인 `className` 으로 스타일 적용하며, 컴포넌트별 CSS 모듈은 사용하지 않습니다.

```tsx
<div className="flex items-center gap-4 p-4 rounded-card border border-border bg-bg shadow-sm">
  <h3 className="text-lg font-semibold text-fg">{title}</h3>
</div>
```

## 화면 변경 확인

공용 컴포넌트는 Storybook에서, 라우트·모달·오류 상태는 [화면 카탈로그](e2e-guide.md)에서 확인한다.
컴포넌트·스타일을 수정했다면 레포 루트에서 `node scripts/check-component-drift.mjs`를 실행한다.
스크린샷은 의도한 상태를 확인한 뒤 갱신하며 이미지 비교 통과와 PRD 완료 기준 충족을 구분한다.

폼의 스키마와 값 타입은 기능의 `form-schema.ts` 또는 `schema.ts`에 함께 둔다. 컴포넌트에서 같은 타입을 수기로 중복 선언하지 않는다. `TemplateDialog`의 제목 길이·본문 UTF-8 바이트 제한은 UI 입력 제한과 제출 스키마에 모두 적용한다. 따라서 서버에서 읽어 초기화한 값도 저장 전에 같은 검증을 받는다.

스터디 등록·수정은 같은 `features/studies/form-schema.ts`를 사용한다. 제목은 trim 후 최대 60자, 한 줄 소개는 trim 후 최대 255자, Discord·드라이브 URL은 최대 2,048자로 검증한다. 현재 백오피스 카운터는 카드 표시 권장 길이(제목 24자·소개 25자)를 기준으로 표시하며, 실제 저장 최대치와는 다르다. playground의 제목 폭 40 규칙과도 차이가 있다. 이번 작업에서 카운터 UI와 제목 폭 정책은 변경하지 않았다. 권장치 초과만으로 저장을 막지 않으며, 최대치 초과는 해당 필드 오류를 보여 주고 API 요청을 막는다.
