# @studyclub/ui · 컴포넌트 작성 가이드

> `design-system.md` §9의 구현 규칙 요약. 새 컴포넌트를 만들기 전 전체 스펙은
> `packages/design/docs/design-system.md` 를 먼저 읽을 것.
> 시각 레퍼런스: `packages/design/docs/styleguide.html` (브라우저에서 열기).

---

## 1. 파일 명명 · 위치

```
packages/ui/src/
  MyComponent.tsx          # 컴포넌트 본체
  MyComponent.stories.tsx  # Storybook (stories-guide.md 참고)
  index.ts                 # 추가 후 여기에 export 등록 필수
```

- 파일명과 컴포넌트명은 **PascalCase** 일치.
- 단일 파일에 관련 타입·헬퍼를 함께 두어도 된다(파일이 300줄 미만일 때).

---

## 2. 절대 금지 사항

| 금지 | 올바른 대안 |
|---|---|
| `color: #4856F5` (raw HEX) | `color: var(--color-brand)` |
| `background: rgb(72,86,245)` | `bg-brand` (Tailwind 유틸) |
| `border-radius: 8px` | `rounded-control` (`var(--radius-control)`) |
| `const cls = 'bg-' + name` (동적 조합) | 전체 클래스명을 정적 문자열로 나열 |
| `import '../tokens.css'` (패키지 내 CSS import) | 앱 globals.css 에서 import — 컴포넌트는 Tailwind 클래스만 사용 |

> **왜 동적 조합 금지?** Tailwind v4 는 소스를 정적 스캔해 사용된 클래스만 번들에 포함한다.
> `'bg-' + variant` 처럼 쪼개면 해당 유틸이 번들에서 빠져 런타임에 스타일이 없어진다.

---

## 3. 토큰 사용 규칙

### 3-1. Tailwind 유틸 vs CSS 변수

컴포넌트 JSX 클래스에는 **Tailwind 유틸**을 쓴다. 인라인 스타일이 꼭 필요한 경우(애니메이션, 동적 width 등)만 `style={{ ... }}` + `var(--token)` 를 쓴다.

```tsx
// ✅ Tailwind 유틸
<div className="bg-brand text-on-brand rounded-control" />

// ✅ 인라인 style 이 불가피할 때
<div style={{ width: `${pct}%`, background: 'var(--color-brand)' }} />

// ❌ 인라인에 HEX 직접
<div style={{ background: '#4856F5' }} />
```

### 3-2. 색 토큰 계층

```
Primitive  → --color-primary-600, --color-neutral-200 ...   (tokens.css §1)
Semantic   → --color-brand, --color-fg-muted, --color-border ... (tokens.css §2)
Domain     → --color-recruiting-bg/fg/dot, --color-captain-bg/fg ... (tokens.css §2)
```

컴포넌트는 **Semantic / Domain 계층만** 참조한다. Primitive 를 직접 쓰는 것은 Avatar 역할 링, disabled 색 등 꼭 필요한 경우에 한한다.

### 3-3. 주요 Semantic 토큰 → Tailwind 유틸 대응표

| 토큰 | Tailwind 유틸 | 용도 |
|---|---|---|
| `--color-brand` | `bg-brand` / `text-brand` | 주요 액션 배경 |
| `--color-brand-hover` | `hover:bg-brand-hover` | 버튼 hover |
| `--color-on-brand` | `text-on-brand` | 브랜드 배경 위 흰 텍스트 |
| `--color-brand-subtle` | `bg-brand-subtle` | Tonal 배경 |
| `--color-fg` | `text-fg` | 기본 본문 |
| `--color-fg-muted` | `text-fg-muted` | 약한 설명 텍스트 |
| `--color-fg-placeholder` | `text-fg-placeholder` | placeholder / disabled |
| `--color-bg` | `bg-bg` | 카드·모달 흰 배경 |
| `--color-surface-1/2/3` | `bg-surface-1/2/3` | 앱 배경 단계 |
| `--color-border` | `border-border` | 장식 구분선 |
| `--color-border-strong` | `border-border-strong` | 입력 resting 보더 |
| `--radius-control` | `rounded-control` | 버튼·입력 |
| `--radius-card` | `rounded-card` | 카드 |
| `--radius-pill` | `rounded-pill` | 뱃지·칩 |
| `--radius-modal` | `rounded-modal` | 모달 |
| `--shadow-xs/sm/md/lg/xl` | `shadow-xs` 등 | 엘리베이션 |
| `--ring` | `shadow-(--ring)` | 포커스 링 |
| `--duration-fast` | `duration-fast` | 150ms micro |
| `--duration-base` | `duration-base` | 250ms 기본 전환 |
| `--ease-out` | `ease-out` | 등장 이징 |

---

## 4. 컴포넌트 작성 패턴

### 4-1. 기본 골격

```tsx
'use client'; // 인터랙션이 있을 때만

import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/** design-system.md §9-X 참조. 한 줄 설명. */
export interface MyComponentProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'a' | 'b';
}

export function MyComponent({ variant = 'a', className, children, ...rest }: MyComponentProps) {
  return (
    <div
      {...rest}
      className={cx(
        '/* 공통 기반 클래스 */',
        variant === 'a' && '/* variant a 클래스 */',
        variant === 'b' && '/* variant b 클래스 */',
        className, // 외부 override — 항상 마지막
      )}
    >
      {children}
    </div>
  );
}
```

### 4-2. Variant 맵 패턴 (선택지가 3개 이상일 때)

```tsx
// ✅ 문자열 전체를 맵에 넣는다 — Tailwind 정적 스캔을 보장
const VARIANT: Record<MyVariant, string> = {
  primary:     'bg-brand text-on-brand hover:bg-brand-hover',
  secondary:   'bg-bg border border-border-strong text-neutral-800 hover:bg-surface-1',
  destructive: 'bg-error-600 text-on-brand hover:bg-error-700',
};

// 사용
className={cx(BASE, VARIANT[variant], className)}
```

### 4-3. 크기(Size) 맵 패턴

```tsx
const SIZE: Record<MySize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};
```

### 4-4. 상태 색 (도메인 토큰) 패턴

도메인 색(스터디 상태, 역할, 출석)은 `--color-{상태}-bg/fg/dot` 패턴을 따른다.

```tsx
const TONE: Record<BadgeTone, { chip: string; dot: string }> = {
  recruiting: {
    chip: 'bg-recruiting-bg text-recruiting-fg',
    dot:  'bg-recruiting-dot',
  },
  inprogress: {
    chip: 'bg-inprogress-bg text-inprogress-fg',
    dot:  'bg-inprogress-dot',
  },
  // ...
};
```

> **색 + 텍스트 + 아이콘 3중 인코딩 원칙**: 상태를 색만으로 구분하지 않는다.
> 반드시 텍스트 라벨을 함께 제공한다.

---

## 5. 접근성 체크리스트

| 항목 | 구현 방법 |
|---|---|
| 포커스 링 | `focus-visible:outline-none focus-visible:shadow-(--ring)` |
| 에러 포커스 링 | `focus:shadow-(--ring-error)` |
| 비활성 | `disabled:bg-neutral-200 disabled:text-neutral-400 disabled:pointer-events-none` |
| 상태 전달 | `aria-pressed`, `aria-invalid`, `aria-label`, `aria-busy` |
| 색맹 대응 | 상태 색은 반드시 텍스트/아이콘 함께 (`dot` + 텍스트) |
| 터치 타깃 44px | sm 버튼: `::after` 절대 패딩으로 hit-area 확장 |
| 모션 접근성 | `prefers-reduced-motion` 은 `tokens.css` 베이스 레이어가 전역 처리 |

---

## 6. `cx` 유틸리티

`clsx` + `tailwind-merge` 래퍼. 조건부 클래스 병합과 Tailwind 충돌 해소를 한번에 처리한다.

```tsx
import { cx } from './cx';

// 조건부 클래스
cx('base', isActive && 'active-class', className)

// Tailwind 충돌 해소 (p-4 vs p-2 → 뒤에 온 p-2 이김)
cx('p-4', className) // className='p-2' → 결과: 'p-2'
```

---

## 7. 도메인 컴포넌트 구현 가이드

### 7-1. Button (§9-1)

```
h-8 / h-10 / h-12  (sm/md/lg)
rounded-control (8px)
disabled → bg-neutral-200 / text-neutral-400 / shadow-none
loading  → <Spinner /> + aria-busy + 폭 고정
sm       → ::after 44px 터치 타깃
```

### 7-2. Input / Select / Textarea (§9-2)

```
h-10, px-3.5, rounded-control, bg-bg
border-border-strong resting
focus  → border-brand + shadow-(--ring)
error  → border-error-600 + shadow-(--ring-error)
disabled → bg-surface-2, text-neutral-400
placeholder → text-fg-placeholder
```

### 7-3. Card (§9-3)

```
bg-bg, border border-border, rounded-card, shadow-xs
interactive hover → shadow-md + translateY(-2px) (duration-base/ease-out)
```

### 7-4. Badge / Status Pill (§9-4)

```
rounded-pill, px-2 py-0.5, text-xs font-medium
tonal: bg {semantic}-bg / text {semantic}-fg
선행 dot: h-1.5 w-1.5 rounded-full bg {semantic}-dot
```

### 7-5. CapacityBar 정원 진행바 (§9-5)

```
트랙: bg-surface-3, h-1.5, rounded-pill
채움: bg-brand  →  80%↑이면 bg-warning-500 (마감임박 승격)
```

### 7-6. StatCard (§9-7)

```
라벨: text-sm text-fg-muted
값:   text-3xl font-bold + .stat-value (tabular-nums)
델타: delta > 0 → text-success-700 ▲ / delta < 0 → text-error-700 ▼
```

### 7-7. Modal (§9-8)

```
fixed inset-0 z-50
오버레이: style={{ background: 'var(--overlay)' }}  ← CSS var 직접 사용
패널: bg-bg, rounded-t-modal (모바일) / rounded-modal (sm+), shadow-xl
등장: animate-[fadeIn_var(--duration-base)_var(--ease-out)]
Esc 닫기 · body scroll lock · 포커스 트랩 구현 필수
```

### 7-8. StudyCard (§9-5)

```
상단 카테고리 컬러 스트립 4px (categoryColor)
헤더: 카테고리 칩 + 상태 뱃지(Badge) + 북마크
타이틀: text-xl font-semibold neutral-900 (2줄 말줄임)
일정/요약: text-sm text-fg-muted / text-fg-secondary
메타: 인원(👥 6/8명 tabular-nums) · 조회수(👁 124) · 신청 액션 버튼
정원 진행바: CapacityBar 연동 (80%↑ warning-500 승격)
```

### 7-9. AttendanceTable (§9-6)

```
좌측 멤버 열 고정(sticky left-0) + 상단 세션 행 고정
셀 = 출석 chip: 출석(present) → 지각(late) → 결석(absent) → 휴가(excused) → 미체크 순환
행 높이: normal 52px / compact 44px (콘솔 밀도)
출석률 열: tabular-nums + 임계 색(≥80 success / 60–79 warning / <60 error) 즉시 집계
```

### 7-10. Tabs (§9-8)

```
언더라인형 탭
active: text-primary-700 font-semibold + 2px underline bg-brand
inactive: text-fg-muted hover:text-fg font-medium
뱃지(badge) 지원, controlled/uncontrolled 대응
```

### 7-11. Nav (§9-8)

```
사이트: variant="site" 상단 가로 네비 (bg-bg/95, border 하단, backdrop-blur)
콘솔: variant="sidebar" 좌측 사이드바 (bg-surface-1, active: bg-brand-subtle text-primary-700)
```

### 7-12. Segmented & Pagination (§9-8)

```
Segmented: track bg-surface-2, active bg-bg shadow-xs, rounded/pill 형태 지원
Pagination: 7칸 창(gap …), active bg-surface-2 font-bold text-fg
```

---

## 8. index.ts 등록

새 컴포넌트를 만든 뒤 반드시 `src/index.ts` 에 export 를 추가한다.

```ts
// src/index.ts
export { MyComponent } from './MyComponent';
export type { MyComponentProps } from './MyComponent';
```

---

## 9. 체크리스트 — PR 전 확인

- [ ] raw HEX / raw rgba() 없음
- [ ] `bg-` / `text-` / `border-` 클래스명이 정적 문자열로만 조립됨
- [ ] `className` prop 을 마지막 인자로 `cx()` 에 전달
- [ ] 포커스 링(`focus-visible:shadow-(--ring)`) 적용
- [ ] disabled 상태 처리 (`disabled:bg-neutral-200 disabled:text-neutral-400`)
- [ ] 상태 전달에 색+텍스트 병행 (색맹 대응)
- [ ] `index.ts` export 추가
- [ ] `*.stories.tsx` 파일 생성 (stories-guide.md 참고)
