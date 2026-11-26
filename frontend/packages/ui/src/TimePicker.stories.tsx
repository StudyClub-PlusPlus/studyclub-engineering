import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { TimePicker } from './TimePicker';
import type { TimePickerProps } from './TimePicker';

function Controlled(props: Partial<TimePickerProps>) {
  const [value, setValue] = useState(props.value ?? '');
  return <TimePicker {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: 'UI/TimePicker',
  component: TimePicker,
  tags: ['autodocs'],
  args: { value: '', onChange: () => {} },
  render: (args) => (
    <div style={{ width: 200, minHeight: 340 }}>
      <Controlled {...args} />
    </div>
  ),
} satisfies Meta<typeof TimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: '시작 시각', value: '20:30', required: true } };
export const Empty: Story = { args: { label: '시작 시각', value: '', helper: '칸에 2030 처럼 쳐도 된다' } };
export const OffStep: Story = {
  args: { label: '시작 시각', value: '19:07', helper: '간격에 안 맞는 분도 목록에 남는다' },
};
export const QuarterStep: Story = { args: { label: '시작 시각', value: '09:15', minuteStep: 15 } };
export const Error: Story = { args: { label: '시작 시각', value: '', error: '시작 시각을 입력해 주세요.' } };
export const Small: Story = { args: { 'aria-label': '1회차 시작 시각', value: '09:00', size: 'sm' } };
export const Disabled: Story = { args: { label: '시작 시각', value: '09:00', disabled: true } };
