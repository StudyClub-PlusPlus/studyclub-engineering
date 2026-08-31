import type { Meta, StoryObj } from '@storybook/react';

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
