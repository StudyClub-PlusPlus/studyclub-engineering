# @studyclub/ui · Storybook Stories 작성 가이드

> Storybook 9 + `@storybook/react-vite` 기준.
> 실제 예시는 `src/*.stories.tsx` 파일을 함께 보면서 읽는다.

---

## 1. 파일 명명 · 위치

```
packages/ui/src/
  MyComponent.tsx
  MyComponent.stories.tsx  ← 컴포넌트와 같은 디렉터리에 위치
```

---

## 2. 기본 구조

모든 stories 파일은 **`meta` export default + named Story export** 패턴을 따른다.

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './MyComponent';

// ① meta — 컴포넌트 정보 + 공통 args
const meta = {
  title: 'UI/MyComponent',       // Storybook 사이드바 경로
  component: MyComponent,         // autodocs 소스 추출 대상
  tags: ['autodocs'],             // Controls 패널 자동 생성
  args: {                         // 모든 Story 의 기본값
    children: '텍스트',
  },
  argTypes: {                     // Controls UI 힌트
    variant: {
      control: 'select',
      options: ['primary', 'secondary'],
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// ② Named story exports
export const Default: Story = {
  render: (args) => <MyComponent {...args} />,
};
```

### `satisfies Meta<typeof Component>` vs 단순 객체

- `component` 키가 있으면 `satisfies Meta<typeof X>` 를 쓴다 → 타입 추론 + autodocs.
- `component` 키 없이 `args` 공유만 할 때는 단순 객체로 둬도 된다 (Badge.stories.tsx 패턴).

---

## 3. `meta` 필드 레퍼런스

| 필드 | 타입 | 설명 |
|---|---|---|
| `title` | `string` | `'UI/ComponentName'` 형식 고정. 사이드바 그룹핑. |
| `component` | `ComponentType` | 자동 문서화(autodocs) 소스. 생략하면 Props 테이블 없음. |
| `tags` | `string[]` | `['autodocs']` — Controls 패널과 Props 표 자동 생성. |
| `args` | `Partial<Props>` | 모든 Story 에서 공유하는 기본값. |
| `argTypes` | `ArgTypes` | Controls 위젯 타입 힌트 (`select`, `boolean`, `text`, `number`, `color`). |
| `decorators` | `Decorator[]` | Story 를 감싸는 래퍼. 컨테이너 폭 제한, 테마 주입 등. |
| `parameters` | `Parameters` | Storybook 애드온 설정. 레이아웃(`centered`, `fullscreen`, `padded`). |

---

## 4. Story 작성 패턴

### 4-1. `render` 함수 vs `args` 자동 렌더

```tsx
// ① render 명시 — 추가 래핑 또는 고정값이 필요할 때 (권장)
export const Primary: Story = {
  render: (args) => <Button {...args} variant='primary' />,
};

// ② args 만 — 단순 prop 변경
export const Disabled: Story = {
  args: { disabled: true },
};
```

Story 안에서 특정 prop 을 고정하거나 여러 인스턴스를 나열해야 하면 **항상 `render`** 를 쓴다.

### 4-2. 모든 Variant 한 화면에 보여주기

```tsx
export const AllVariants: Story = {
  render: () => (
    <div className='flex flex-wrap gap-3'>
      {(['primary', 'tonal', 'secondary', 'ghost', 'destructive'] as const).map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  ),
};
```

### 4-3. 그룹 비교 (도메인 전체)

```tsx
export const StudyStatus: Story = {
  render: () => (
    <div className='flex flex-wrap gap-2'>
      <Badge tone='recruiting' dot>모집중</Badge>
      <Badge tone='closingsoon' dot>마감임박</Badge>
      <Badge tone='inprogress' dot>진행중</Badge>
      <Badge tone='closed' dot>마감</Badge>
      <Badge tone='ended' dot>종료</Badge>
    </div>
  ),
};
```

### 4-4. 컨테이너 폭 제한 (decorator)

카드·입력처럼 부모 폭에 반응하는 컴포넌트는 decorator 로 폭을 고정한다.

```tsx
const meta = {
  // ...
  decorators: [
    (Story) => (
      <div className='w-72'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;
```

Story 단위로 decorator 를 붙여야 할 때는 해당 Story 의 `decorators` 배열에 추가한다.

```tsx
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

### 4-5. 상태 시뮬레이션 (hover · focus · disabled)

```tsx
export const Disabled: Story = {
  render: (args) => <Button {...args} disabled>모집마감</Button>,
};

export const Loading: Story = {
  render: (args) => <Button {...args} loading>처리중</Button>,
};

export const ErrorState: Story = {
  render: () => (
    <Input
      label='이메일'
      error='올바른 이메일 형식이 아니에요'
      defaultValue='bad-email'
    />
  ),
};
```

### 4-6. 복합 레이아웃 Story

컴포넌트를 실제 화면처럼 조합한 Story. `WithContent` / `Dashboard` 등 이름을 쓴다.

```tsx
export const Dashboard: Story = {
  render: () => (
    <div className='grid grid-cols-2 gap-3'>
      <StatCard label='전체 회원' value='1,284' delta={42} deltaSuffix='명' deltaLabel='이번 달' />
      <StatCard label='활성 스터디' value='18' sub='진행중 기준' />
      <StatCard label='출석률' value='73%' delta={-5} deltaSuffix='%p' deltaLabel='전주 대비' />
      <StatCard label='신청 대기' value='7' />
    </div>
  ),
};
```

---

## 5. argTypes 제어 위젯 레퍼런스

```tsx
argTypes: {
  // 드롭다운 선택
  variant: { control: 'select', options: ['primary', 'secondary'] },

  // 토글
  disabled: { control: 'boolean' },
  loading:  { control: 'boolean' },

  // 텍스트 입력
  label:    { control: 'text' },

  // 숫자 슬라이더
  delta:    { control: { type: 'range', min: -100, max: 100 } },

  // 색상 피커
  color:    { control: 'color' },

  // Controls 패널에서 숨기기 (내부 prop)
  className: { table: { disable: true } },
}
```

---

## 6. 도메인 데이터 활용

mock 패키지의 실 데이터를 연결해 현실감 있는 Story 를 만든다.

```tsx
import { studies } from '@studyclub/mock';

export const RealData: Story = {
  render: () => (
    <div className='grid gap-4'>
      {studies.slice(0, 3).map((s) => (
        <Card key={s.id} interactive>
          <p className='text-sm font-semibold'>{s.title}</p>
          <Badge tone={s.status === 'recruiting' ? 'recruiting' : 'inprogress'} dot>
            {s.status}
          </Badge>
        </Card>
      ))}
    </div>
  ),
};
```

---

## 7. 스토리 네이밍 컨벤션

| 이름 | 의미 |
|---|---|
| `Default` | 가장 기본적인 형태. args 기본값 그대로. |
| `Primary` / `Tonal` / `Secondary` ... | variant 별 단독 스토리. |
| `AllVariants` | 모든 variant 한 화면 나열. |
| `AllSizes` | 모든 size 한 화면 나열. |
| `Disabled` / `Loading` / `Error` | 상태별 스토리. |
| `WithContent` / `WithIcon` / `WithSub` | 슬롯/prop 조합 예시. |
| `Dashboard` / `StudyList` | 복합 레이아웃 — 실제 화면 맥락. |
| `RealData` | mock 패키지 데이터 연결. |

---

## 8. 체크리스트 — stories PR 전 확인

- [ ] `title: 'UI/ComponentName'` 형식 사용
- [ ] `tags: ['autodocs']` 포함
- [ ] `Default` Story 반드시 존재
- [ ] 주요 variant / size / 상태(disabled, error 등) Story 커버
- [ ] 도메인 컴포넌트(Badge, CapacityBar 등)는 전체 tone/state 나열 Story 포함
- [ ] 폭 의존 컴포넌트에 `decorator` 로 컨테이너 고정
- [ ] raw HEX / raw rgba 없음 (컴포넌트 규칙 동일 적용)
