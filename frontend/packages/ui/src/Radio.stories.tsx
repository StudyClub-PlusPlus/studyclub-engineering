import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Radio } from './Radio';

const meta = {
  title: 'UI/Radio',
  component: Radio,
  tags: ['autodocs'],
  args: { label: '온라인', name: 'demo' },
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Group: Story = {
  name: '묶음 (하나만 고르기)',
  render: () => {
    const [value, setValue] = useState('online');
    return (
      <fieldset className='flex flex-col gap-2'>
        <legend className='mb-2 type-label-lg text-ink'>참여 방식</legend>
        {[
          ['online', '온라인'],
          ['offline', '오프라인'],
          ['both', '둘 다'],
        ].map(([v, label]) => (
          <Radio key={v} name='mode' value={v} label={label} checked={value === v} onChange={() => setValue(v)} />
        ))}
      </fieldset>
    );
  },
};

export const WithDescription: Story = {
  name: '설명',
  render: () => (
    <div className='flex flex-col gap-3'>
      <Radio name='confirm' label='자동 확정' description='신청하면 바로 참석이 확정됩니다' defaultChecked />
      <Radio name='confirm' label='운영자 승인' description='운영자가 승인해야 참석이 확정됩니다' />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => <Radio name='d' label='마감된 선택지' disabled />,
};
