import type { Meta, StoryObj } from '@storybook/react-vite';

import { CapacityBar } from './CapacityBar';

const meta = {
  title: 'UI/CapacityBar',
  component: CapacityBar,
  tags: ['autodocs'],
  args: {
    taken: 6,
    total: 10,
    showLabel: false,
  },
  decorators: [
    (Story) => (
      <div className='w-64'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapacityBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <CapacityBar taken={6} total={10} />,
};

export const WithLabel: Story = {
  render: () => <CapacityBar taken={6} total={10} showLabel />,
};

export const WarnThreshold: Story = {
  render: () => <CapacityBar taken={8} total={10} showLabel />,
};

export const Full: Story = {
  render: () => <CapacityBar taken={10} total={10} showLabel />,
};

/** 목표 대비 진행 — 경고색 없이 primary, 목표를 채우면 success */
export const Goal: Story = {
  render: () => (
    <div className='space-y-3'>
      <CapacityBar variant='goal' taken={240} total={720} showLabel label='4시간 / 12시간' />
      <CapacityBar variant='goal' taken={660} total={720} showLabel label='11시간 / 12시간' />
      <CapacityBar variant='goal' taken={760} total={720} showLabel label='12시간 40분 / 12시간 — 달성' />
    </div>
  ),
};

export const Empty: Story = {
  render: () => <CapacityBar taken={0} total={10} showLabel />,
};

export const AllLevels: Story = {
  render: () => (
    <div className='flex w-64 flex-col gap-4'>
      <CapacityBar taken={2} total={10} showLabel label='정원 20%' />
      <CapacityBar taken={5} total={10} showLabel label='정원 50%' />
      <CapacityBar taken={8} total={10} showLabel label='정원 80% — 마감임박' />
      <CapacityBar taken={10} total={10} showLabel label='정원 100%' />
    </div>
  ),
};
