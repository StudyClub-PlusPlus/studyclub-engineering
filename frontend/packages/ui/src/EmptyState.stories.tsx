import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';
import { EmptyState } from './EmptyState';

const PlusIcon = () => (
  <svg className='h-10 w-10' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
  </svg>
);

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    title: '아직 스터디가 없어요',
    description: '첫 번째 스터디를 만들어 보세요.',
  },
  decorators: [
    (Story) => (
      <div className='w-96'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <EmptyState title='아직 스터디가 없어요' description='첫 번째 스터디를 만들어 보세요.' />,
};

export const WithIcon: Story = {
  render: () => (
    <EmptyState title='아직 스터디가 없어요' description='첫 번째 스터디를 만들어 보세요.' icon={<PlusIcon />} />
  ),
};

export const WithAction: Story = {
  render: () => (
    <EmptyState
      title='아직 스터디가 없어요'
      description='첫 번째 스터디를 만들어 보세요.'
      action={<Button size='sm'>스터디 만들기</Button>}
    />
  ),
};

export const Full: Story = {
  render: () => (
    <EmptyState
      title='아직 스터디가 없어요'
      description='첫 번째 스터디를 만들어 보세요.'
      icon={<PlusIcon />}
      action={<Button size='sm'>스터디 만들기</Button>}
    />
  ),
};

export const NoDescription: Story = {
  render: () => <EmptyState title='아직 스터디가 없어요' />,
};
