import type { Meta, StoryObj } from '@storybook/react';

import { Tabs } from './Tabs';

const sampleTabs = [
  {
    key: 'overview',
    label: '개요',
    content: <div className='p-4 text-sm text-fg'>스터디 상세 설명과 커리큘럼을 확인할 수 있습니다.</div>,
  },
  {
    key: 'curriculum',
    label: '커리큘럼',
    badge: 8,
    content: <div className='p-4 text-sm text-fg'>총 8주차 학습 계획이 포함되어 있습니다.</div>,
  },
  {
    key: 'reviews',
    label: '후기',
    badge: 12,
    content: <div className='p-4 text-sm text-fg'>수강생들의 솔직한 후기 목록입니다.</div>,
  },
  {
    key: 'faq',
    label: '자주 묻는 질문',
    content: <div className='p-4 text-sm text-fg'>참여 방법, 진행 방식 등에 대한 안내입니다.</div>,
  },
  {
    key: 'disabled',
    label: '비활성 탭',
    disabled: true,
  },
];

const meta = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  args: {
    items: sampleTabs,
    defaultActiveKey: 'overview',
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className='max-w-xl'>
      <Tabs {...args} />
    </div>
  ),
};
