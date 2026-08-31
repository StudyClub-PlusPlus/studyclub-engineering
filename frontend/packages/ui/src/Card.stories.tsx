import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  args: {
    children: '카드 본문 내용이 여기에 들어갑니다.',
    interactive: false,
    padding: 'md' as const,
  },
  argTypes: {
    padding: { control: 'select', options: ['none', 'md', 'lg'] },
  },
  decorators: [
    (Story) => (
      <div className='w-72'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Card {...args} />,
};

export const Interactive: Story = {
  render: (args) => (
    <Card {...args} interactive>
      호버하면 살짝 떠오릅니다.
    </Card>
  ),
};

export const PaddingNone: Story = {
  render: (args) => (
    <Card {...args} padding='none'>
      <div className='p-4 text-sm'>padding="none" — 직접 내부에서 패딩 제어</div>
    </Card>
  ),
};

export const PaddingLg: Story = {
  render: (args) => <Card {...args} padding='lg' />,
};

export const WithContent: Story = {
  render: () => (
    <Card interactive className='w-72'>
      <p className='text-sm font-semibold text-neutral-900'>알고리즘 스터디</p>
      <p className='mt-1 text-xs text-fg-muted'>매주 화요일 · 온라인</p>
    </Card>
  ),
};
