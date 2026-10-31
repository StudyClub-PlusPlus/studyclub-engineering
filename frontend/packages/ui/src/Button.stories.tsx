import type { Meta, StoryObj } from '@storybook/react-vite';
import { Search } from 'lucide-react';
import { Button, IconButton } from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: '버튼',
    variant: 'primary' as const,
    size: 'md' as const,
    loading: false,
    disabled: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'danger', 'destructive'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    state: { control: 'select', options: ['default', 'error'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { render: (args) => <Button {...args} variant='primary' /> };
export const Secondary: Story = { render: (args) => <Button {...args} variant='secondary' /> };
export const Tertiary: Story = { render: (args) => <Button {...args} variant='tertiary' /> };
export const Danger: Story = { render: (args) => <Button {...args} variant='danger' /> };
export const Destructive: Story = { render: (args) => <Button {...args} variant='destructive' /> };
export const Loading: Story = {
  render: (args) => (
    <div className='flex items-center gap-2'>
      <Button {...args} loading />
      <span role='status' className='type-body-sm text-fg-muted'>처리 중…</span>
    </div>
  ),
};
export const Disabled: Story = { render: (args) => <Button {...args} disabled /> };

export const LongKoreanLabel: Story = {
  render: (args) => (
    <Button {...args} size='lg' className='w-full sm:w-auto'>
      스터디 참여 신청 내용을 저장하기
    </Button>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className='flex flex-wrap gap-3'>
      {(['primary', 'secondary', 'tertiary', 'danger', 'destructive'] as const).map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  ),
};

export const Error: Story = {
  render: (args) => (
    <div className='space-y-2'>
      <Button {...args} state='error' aria-describedby='button-error'>
        저장
      </Button>
      <p id='button-error' role='alert' className='type-body-sm text-danger-fg'>
        저장하지 못했어요. 잠시 후 다시 시도해 주세요.
      </p>
    </div>
  ),
};

export const StateMatrix: Story = {
  render: () => (
    <div className='flex flex-col gap-6 p-3'>
      {(['primary', 'secondary', 'tertiary', 'danger', 'destructive'] as const).map((variant) => (
        <div key={variant} className='flex flex-wrap items-center gap-4'>
          <span className='type-label-sm'>{variant}</span>
          <Button variant={variant}>저장</Button>
          <Button variant={variant} state='error'>
            저장
          </Button>
          <Button variant={variant} disabled>
            저장
          </Button>
          <Button variant={variant} loading>
            저장
          </Button>
        </div>
      ))}
    </div>
  ),
};

export const IconButtons: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4 p-3'>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <IconButton key={size} size={size} variant='tertiary' aria-label='검색' icon={<Search />} />
      ))}
      <IconButton aria-label='검색' icon={<Search />} loading />
      <IconButton aria-label='검색' icon={<Search />} state='error' />
      <IconButton aria-label='검색' icon={<Search />} disabled />
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className='flex items-center gap-3'>
      {(['sm', 'md', 'lg'] as const).map((s) => (
        <Button key={s} size={s}>
          {s}
        </Button>
      ))}
    </div>
  ),
};
