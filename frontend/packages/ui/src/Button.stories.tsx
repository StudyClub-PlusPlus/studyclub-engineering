import type { StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'UI/Button',
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
      options: ['primary', 'tonal', 'secondary', 'ghost', 'destructive'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { render: (args) => <Button {...args} variant='primary' /> };
export const Tonal: Story = { render: (args) => <Button {...args} variant='tonal' /> };
export const Secondary: Story = { render: (args) => <Button {...args} variant='secondary' /> };
export const Ghost: Story = { render: (args) => <Button {...args} variant='ghost' /> };
export const Destructive: Story = { render: (args) => <Button {...args} variant='destructive' /> };
export const Loading: Story = { render: (args) => <Button {...args} loading /> };
export const Disabled: Story = { render: (args) => <Button {...args} disabled /> };

export const AllVariants: Story = {
  render: () => (
    <div className='flex flex-wrap gap-3'>
      {(['primary', 'tonal', 'secondary', 'ghost', 'destructive'] as const).map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      ))}
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
