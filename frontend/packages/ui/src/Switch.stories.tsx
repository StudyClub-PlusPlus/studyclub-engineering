import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Switch } from './Switch';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: { label: '알림 받기', checked: false },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [on, setOn] = useState(args.checked);
    return <Switch {...args} checked={on} onCheckedChange={setOn} />;
  },
};

export const Success: Story = {
  name: '공개 (success)',
  render: () => {
    const [on, setOn] = useState(true);
    return <Switch label='사이트 공개' tone='success' checked={on} onCheckedChange={setOn} />;
  },
};

export const Blocked: Story = {
  name: '막힘 (이유 표시)',
  render: () => (
    <div className='flex flex-col items-start gap-1'>
      <Switch label='사이트 공개' tone='success' checked={false} aria-disabled aria-describedby='reason' />
      <p id='reason' className='type-label-sm text-fg-muted'>
        신청 폼을 먼저 연결하세요.
      </p>
    </div>
  ),
};
