# Storybook Guide

## Table of Contents

- [개요](#개요)
- [실행](#실행)
- [파일 위치 및 네이밍](#파일-위치-및-네이밍)
- [스토리 기본 구조](#스토리-기본-구조)
- [Meta 작성법](#meta-작성법)
- [Story 작성법](#story-작성법)
- [args vs render](#args-vs-render)
- [decorators](#decorators)
- [다중 컴포넌트 스토리](#다중-컴포넌트-스토리)
- [자주 쓰는 패턴](#자주-쓰는-패턴)

---

## 개요

`@studyclub/ui` 패키지에 Storybook 9 (react-vite) 이 세팅되어 있다.
모든 UI 컴포넌트는 스토리 파일을 가져야 한다.

```
packages/ui/
├── src/
│   ├── Button.tsx
│   ├── Button.stories.tsx   ← 스토리
│   └── ...
├── .storybook/
│   ├── main.ts              ← Vite + Tailwind 설정
│   ├── preview.tsx          ← 글로벌 데코레이터 / 파라미터
│   └── index.css            ← Tailwind + 디자인 토큰 import
└── package.json
```

---

## 실행

```bash
# packages/ui 기준
cd frontend && npm run storybook --workspace=@studyclub/ui

# 또는 frontend 루트에서 turbo 태스크
cd frontend && npx turbo run storybook --filter=@studyclub/ui
```

브라우저: `http://localhost:6006`

---

## 파일 위치 및 네이밍

- 컴포넌트 파일과 **같은 디렉토리**, **같은 이름**에 `.stories.tsx` 확장자
- 예: `Button.tsx` → `Button.stories.tsx`

```
packages/ui/src/
├── Button.tsx
├── Button.stories.tsx
├── Card.tsx
└── Card.stories.tsx
```

---

## 스토리 기본 구조

```tsx
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

// 1. meta 선언 — satisfies Meta<typeof Component> 필수
const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    // 모든 스토리에 기본으로 적용될 props
    children: '버튼',
    variant: 'primary',
  },
} satisfies Meta<typeof Button>;

export default meta;

// 2. Story 타입 — 반드시 StoryObj<typeof meta> (컴포넌트가 아닌 meta 참조)
type Story = StoryObj<typeof meta>;

// 3. 스토리 export
export const Default: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};
```

### 왜 `satisfies Meta<typeof Component>`인가

| 패턴 | 차이 |
|---|---|
| `const meta: Meta<typeof Component> = {}` | 동작하지만 meta-level `args` 가 Story 타입에 반영 안 됨 |
| `const meta = {} satisfies Meta<typeof Component>` | meta `args` 가 Story 타입에 반영 → 스토리에서 필수 prop 생략 가능 |

**예시**: meta에 `args: { label: '기본' }` 이 있으면 각 스토리에서 `label` 을 다시 선언하지 않아도 타입 오류가 없다.

### 왜 `StoryObj<typeof meta>`인가

`StoryObj<typeof Button>` 으로 쓰면 meta-level `args` 가 타입에서 무시된다.
`StoryObj<typeof meta>` 를 써야 meta args 가 optional 로 처리되어 `Default: Story = {}` 같은 빈 스토리가 타입 오류 없이 동작한다.

---

## Meta 작성법

```ts
const meta = {
  // Storybook 사이드바 경로. 슬래시로 그룹화
  title: 'UI/Button',

  // 대상 컴포넌트. Controls / autodocs 자동 생성에 필요
  component: Button,

  // 'autodocs' 태그: Docs 탭에 자동 문서 페이지 생성
  tags: ['autodocs'],

  // 모든 스토리에 적용될 기본 props
  args: {
    children: '버튼',
    disabled: false,
  },

  // Controls 패널 커스터마이징
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
    },
    onClick: { action: 'clicked' },
  },

  // 레이아웃 설정: 'centered' | 'fullscreen' | 'padded'
  parameters: {
    layout: 'centered',
  },

  // 모든 스토리에 적용될 래퍼
  decorators: [
    (Story) => (
      <div className='w-72'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>;
```

### title 네이밍 규칙

```
UI/Button          ← @studyclub/ui 컴포넌트
UI/Field           ← 복합 컴포넌트 (Input + Select + Textarea)
```

---

## Story 작성법

### 빈 스토리 (meta args만으로 충분할 때)

```ts
export const Default: Story = {};
```

### args 오버라이드

```ts
export const Disabled: Story = {
  args: { disabled: true },
};

export const LongText: Story = {
  args: { children: '텍스트가 아주 긴 버튼입니다' },
};
```

### render 함수 (props 직접 제어)

args 시스템 없이 완전히 수동으로 렌더링해야 할 때 사용한다.

```ts
export const WithContent: Story = {
  render: () => (
    <Card>
      <p className='text-sm font-semibold'>알고리즘 스터디</p>
      <p className='mt-1 text-xs text-fg-muted'>매주 화요일 · 온라인</p>
    </Card>
  ),
};
```

### render + args (Controls와 연동)

Controls 패널 값을 받되 일부 props는 고정할 때:

```ts
export const DeltaUp: Story = {
  render: (args) => (
    <StatCard {...args} delta={12} deltaSuffix='명' deltaLabel='지난달 대비' />
  ),
};
```

### 스토리 이름 커스터마이징

export 이름이 길거나 가독성이 떨어질 때 `name` 필드로 사이드바 표시 이름을 변경한다.

```ts
export const InputWithError: Story = {
  name: 'Input / 오류 상태',
  render: () => <Input label='이메일' error='올바른 이메일을 입력해 주세요.' />,
};
```

---

## args vs render

| | `args` | `render` |
|---|---|---|
| Controls 패널 연동 | ✅ | ❌ (render 안에서 직접 넘길 때만) |
| 사용 시점 | 단순 prop 변경 | 복잡한 구조, 여러 컴포넌트 조합 |
| 권장 우선순위 | 1순위 | args로 표현 불가할 때 |

**원칙**: `args` 로 표현할 수 있으면 `args` 를 쓴다. `render` 는 레이아웃 조합이나 상태 시뮬레이션이 필요한 경우에만.

---

## decorators

### meta-level decorator (모든 스토리에 적용)

```ts
const meta = {
  title: 'UI/CapacityBar',
  component: CapacityBar,
  decorators: [
    (Story) => (
      <div className='w-64'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapacityBar>;
```

### story-level decorator (특정 스토리에만 적용)

```ts
export const Dashboard: Story = {
  render: () => <DashboardLayout />,
  decorators: [
    (Story) => (
      <div className='w-[960px]'>
        <Story />
      </div>
    ),
  ],
};
```

### 타입 오류 방지

`satisfies Meta<typeof Component>` 패턴을 쓰면 `(Story)` 파라미터 타입이 자동 추론된다.
별도의 타입 어노테이션 (`Story: React.FC`, `Story: Decorator`) 불필요.

```ts
// ✅ 올바름
decorators: [(Story) => <div><Story /></div>]

// ❌ 사용하지 않음
decorators: [(Story: React.FC) => <div><Story /></div>]
```

---

## 다중 컴포넌트 스토리

한 파일에서 여러 컴포넌트를 보여줄 때 (예: `Field.stories.tsx` — Input, Select, Textarea, FieldShell).
가장 대표적인 컴포넌트를 `component` 로 지정하고, 나머지는 `render` 에서 직접 사용한다.

```ts
import type { Meta, StoryObj } from '@storybook/react';

import { FieldShell, Input, Select, Textarea } from './Field';

const meta = {
  title: 'UI/Field',
  component: Input,           // 대표 컴포넌트
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className='w-80'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InputDefault: Story = {
  name: 'Input / 기본',
  render: () => <Input label='스터디 이름' placeholder='이름을 입력해 주세요' />,
};

export const SelectDefault: Story = {
  name: 'Select / 기본',
  render: () => (
    <Select label='지역' required>
      <option value='서울'>서울</option>
    </Select>
  ),
};
```

---

## 자주 쓰는 패턴

### 너비 고정 래퍼

좁은 컴포넌트(카드, 바 등)는 meta decorator에서 너비를 고정한다.

```ts
decorators: [(Story) => <div className='w-64'><Story /></div>]
```

### 모달 / 다이얼로그

화면 전체를 덮는 컴포넌트는 `layout: 'centered'` + Docs 탭 높이 지정.

```ts
parameters: {
  layout: 'centered',
  docs: { story: { height: '500px' } },
},
```

### 그리드 레이아웃 확인용 스토리

```ts
export const AllVariants: Story = {
  render: () => (
    <div className='grid grid-cols-3 gap-4'>
      <Badge variant='default'>기본</Badge>
      <Badge variant='success'>완료</Badge>
      <Badge variant='warning'>대기</Badge>
    </div>
  ),
};
```

### 인터랙티브 상태 (useState)

```ts
export const Controlled: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <Checkbox
        label='동의합니다'
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
    );
  },
};
```

> `render` 안에서 훅을 쓸 수 있다. Storybook이 함수형 컴포넌트처럼 실행한다.

---

## 체크리스트

새 컴포넌트를 `packages/ui/src/` 에 추가할 때:

- [ ] `ComponentName.stories.tsx` 파일 생성
- [ ] `satisfies Meta<typeof ComponentName>` 패턴 사용
- [ ] `type Story = StoryObj<typeof meta>` 선언
- [ ] `tags: ['autodocs']` 포함
- [ ] 주요 variant / 상태별 스토리 추가 (Default 포함 최소 2개)
- [ ] 너비가 중요한 컴포넌트는 decorator로 너비 고정
- [ ] `npm run storybook` 으로 로컬 확인 후 PR
