import type { Meta, StoryObj } from '@storybook/react';
import { CalendarClock, Globe, Rocket } from 'lucide-react';

import { StudyCard } from './StudyCard';

const meta = {
  title: 'UI/StudyCard',
  component: StudyCard,
  tags: ['autodocs'],
  args: {
    href: '#',
    category: '소프트웨어 개발',
    badge: { label: '모집중 D-5', dotClassName: 'bg-recruiting-dot' },
    title: 'React 딥다이브 스터디 — 리액트 내부 원리와 최적화',
    summary: '리액트 19의 신규 기능과 Fiber 아키텍처, 렌더링 최적화를 깊이 있게 학습합니다.',
    details: [
      { icon: CalendarClock, label: '매주 목 20:00 · 8주 과정' },
      { icon: Globe, label: '한국 시간 (KST)' },
      { icon: Rocket, label: '시작 예정일 11/03' },
    ],
  },
  argTypes: {
    category: {
      control: 'select',
      options: [
        'AI · ML',
        '알고리즘',
        '데이터',
        '소프트웨어 개발',
        '커리어',
        '북클럽',
        '어학',
        '라이프스타일',
        '기획 · PM',
        '비즈니스',
        '기타',
      ],
    },
    title: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className='max-w-sm'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StudyCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ClosingSoon: Story = {
  args: { category: 'AI · ML', badge: { label: '마감임박 D-1', dotClassName: 'bg-closingsoon-dot' } },
};

export const InProgress: Story = {
  args: { category: '북클럽', badge: { label: '진행중', dotClassName: 'bg-inprogress-dot' } },
};

export const Closed: Story = {
  args: { category: '어학', badge: { label: '모집 마감', dotClassName: 'bg-closed-dot' } },
};
