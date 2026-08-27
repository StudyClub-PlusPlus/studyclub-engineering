import type { Meta, StoryObj } from '@storybook/react';

import { StatCard } from './StatCard';

const meta = {
  title: 'UI/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  args: {
    label: '전체 회원',
    value: '1,284',
  },
  decorators: [
    (Story) => (
      <div className='w-56'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <StatCard label='전체 회원' value='1,284' />,
};

export const DeltaUp: Story = {
  render: (args) => (
    <StatCard {...args} label='이번 달 신규' value='42' delta={12} deltaSuffix='명' deltaLabel='지난달 대비' />
  ),
};

export const DeltaDown: Story = {
  render: (args) => (
    <StatCard {...args} label='출석률' value='73%' delta={-5} deltaSuffix='%p' deltaLabel='지난 주 대비' />
  ),
};

export const WithSub: Story = {
  render: (args) => <StatCard {...args} label='활성 스터디' value='18' sub='전체 코호트 기준' />,
};

export const WithIcon: Story = {
  render: (args) => (
    <StatCard
      {...args}
      label='신청 대기'
      value='7'
      icon={
        <svg className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
        </svg>
      }
    />
  ),
};

export const Dashboard: Story = {
  render: () => (
    <div className='grid grid-cols-2 gap-3'>
      <StatCard label='전체 회원' value='1,284' delta={42} deltaSuffix='명' deltaLabel='이번 달' />
      <StatCard label='활성 스터디' value='18' sub='진행중 기준' />
      <StatCard label='출석률' value='73%' delta={-5} deltaSuffix='%p' deltaLabel='전주 대비' />
      <StatCard label='신청 대기' value='7' />
    </div>
  ),
  decorators: [
    (Story) => (
      <div className='w-96'>
        <Story />
      </div>
    ),
  ],
};
