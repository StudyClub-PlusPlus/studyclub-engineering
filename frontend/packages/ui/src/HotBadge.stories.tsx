import type { Meta, StoryObj } from '@storybook/react';

import { HotBadge } from './HotBadge';

const meta = {
  title: 'UI/HotBadge',
  component: HotBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof HotBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: '기본',
  render: () => <HotBadge />,
};

export const OnColor: Story = {
  name: '컬러 배너 위',
  render: () => (
    <div
      className='flex h-20 w-48 items-start p-3'
      style={{ background: 'linear-gradient(120deg, #4f46e5, #818cf8)' }}
    >
      <HotBadge />
    </div>
  ),
};

export const OnDark: Story = {
  name: '어두운 배경 위',
  render: () => (
    <div className='flex h-20 w-48 items-start bg-neutral-900 p-3'>
      <HotBadge />
    </div>
  ),
};
