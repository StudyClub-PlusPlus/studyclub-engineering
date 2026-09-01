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
| UI 컴포넌트 | `src/components/` | StudyCard, Nav, Footer |

공유 컴포넌트 라이브러리 `@studyclub/ui` (`packages/ui`) 가 존재한다. 세 앱 모두 이 패키지에 의존하고 있으므로, **새 컴포넌트를 앱 로컬에 직접 만들기 전에 먼저 확인할 것**.

**`@studyclub/ui` 제공 컴포넌트**: `Button` `Badge` `Card` `FieldShell` `Input` `Select` `Textarea` `FilterChip` `Avatar` `StatCard` `CapacityBar` `Checkbox` `Modal` `EmptyState`

> `Input` · `Select` · `Textarea` · `FieldShell` 은 `Field.tsx` 에서 함께 export 된다.
> `FilterChip` 은 `Chip.tsx` 에서 export 된다.

```typescript
import { Button, Badge, Card } from '@studyclub/ui';
```

두 앱에 걸쳐 공유되는 새 컴포넌트는 `packages/ui/src/` 에 추가하고 `src/index.ts` 에 export 한다.
앱 전용(한 앱에서만 쓰이는) 컴포넌트는 해당 앱의 `src/components/` 에 작성한다.

## 네이밍 규칙

- 파일명: **PascalCase** (`StudyCard.tsx`, `EventBrowser.tsx`)
- 컴포넌트명 = 파일명 (1파일 1컴포넌트 원칙)
- 합성어: 도메인 + 역할 (`StudyCard`, `EventBrowser`, `NavAuth`)

## 컴포넌트 작성 패턴

### Server Component (기본)

Next.js App Router 에서 컴포넌트는 기본 Server Component.
데이터 fetch, 정적 렌더링에 적합.

```tsx
// src/components/StudyCard.tsx
import type { Study } from '@/models/Study';

export default function StudyCard({ study }: { study: Study }) {
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

제출이 있는 폼은 **`react-hook-form` + `zod` + `@hookform/resolvers`** 조합으로 작성한다.

- **Zod 스키마**로 타입과 검증 규칙을 한 곳에서 선언한다. `z.infer<typeof schema>`로 폼 타입을 자동 파생해 타입 중복을 없앤다.
- 조건부 검증(스터디 일정 유무 등)은 `.superRefine()`으로 표현한다.
- 커스텀 입력(버튼 그룹·토글 격자 등 DOM 입력이 아닌 필드)은 `watch` + `setValue`로 관리한다.

```tsx
// 스키마 — 컴포넌트 바깥에서 선언해 리렌더링마다 재생성되지 않게 한다
const profileSchema = z.object({
  name: z.string().min(1, '이름을 입력하세요.').refine((v) => v.trim().length > 0, '이름을 입력하세요.'),
  region: z.string() as z.ZodType<MemberRegion>,
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

**필터·검색 UI**(`StudyBrowser`, `EventBrowser` 등)는 제출이 없는 즉시 반응 상태라 `useState`로 충분하다 — RHF 대상이 아니다.

## 스타일링

- **Tailwind CSS** 사용 (postcss.config.mjs 설정 완료)
- 인라인 `className` 으로 스타일 적용
- 글로벌 스타일: `src/app/globals.css`
- 컴포넌트별 CSS 모듈은 사용하지 않음 (Tailwind 로 충분)

```tsx
<div className="flex items-center gap-4 p-4 rounded-lg border">
  <h3 className="text-lg font-semibold">{title}</h3>
</div>
```
