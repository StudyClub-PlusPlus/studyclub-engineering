import type { Meta, StoryObj } from '@storybook/react';
import { Bookmark, Sparkles } from 'lucide-react';

import { Badge } from './Badge';
import { Button } from './Button';
import { StudyCard } from './StudyCard';

const meta = {
  title: 'UI/StudyCard',
  component: StudyCard,
  tags: ['autodocs'],
  args: {
    category: '개발',
    categoryColor: 'var(--color-chart-1)',
    categoryIcon: <Sparkles size={13} />,
    badge: <Badge tone='recruiting'>모집중</Badge>,
    bookmark: (
      <button
        type='button'
        aria-label='북마크'
        className='grid h-8 w-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
      >
        <Bookmark size={16} />
      </button>
    ),
    title: 'React 딥다이브 스터디 — 리액트 내부 원리와 최적화',
    schedule: '매주 목 20:00 · 8주 과정',
    summary: '리액트 19의 신규 기능과 Fiber 아키텍처, 렌더링 최적화를 깊이 있게 학습합니다.',
    currentMembers: 6,
    maxMembers: 8,
    views: 124,
    action: (
      <Button size='sm' variant='primary'>
        신청하기
      </Button>
    ),
  },
  argTypes: {
    category: { control: 'text' },
    categoryColor: {
      control: 'select',
      options: [
        'var(--color-chart-1)',
        'var(--color-chart-2)',
        'var(--color-chart-3)',
        'var(--color-chart-4)',
        'var(--color-chart-5)',
        'var(--color-chart-6)',
        'var(--color-brand)',
      ],
      labels: {
        'var(--color-chart-1)': 'chart-1 — indigo',
        'var(--color-chart-2)': 'chart-2 — amber',
        'var(--color-chart-3)': 'chart-3 — teal',
        'var(--color-chart-4)': 'chart-4 — magenta',
        'var(--color-chart-5)': 'chart-5 — green',
        'var(--color-chart-6)': 'chart-6 — coral',
        'var(--color-brand)':   'brand — primary',
      },
    },
    title: { control: 'text' },
    currentMembers: { control: 'number' },
    maxMembers: { control: 'number' },
    views: { control: 'number' },
  },
} satisfies Meta<typeof StudyCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className='max-w-sm'>
      <StudyCard {...args} />
    </div>
  ),
};

export const ClosingSoon: Story = {
  render: (args) => (
    <div className='max-w-sm'>
      <StudyCard
        {...args}
        badge={<Badge tone='closingsoon'>마감임박</Badge>}
        currentMembers={7}
        maxMembers={8}
      />
    </div>
  ),
};

export const InProgress: Story = {
  render: (args) => (
    <div className='max-w-sm'>
      <StudyCard
        {...args}
        badge={<Badge tone='inprogress'>진행중</Badge>}
        currentMembers={8}
        maxMembers={8}
        action={
          <Button size='sm' variant='secondary' disabled>
            모집 마감
          </Button>
        }
      />
    </div>
  ),
};
