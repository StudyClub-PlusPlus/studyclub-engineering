import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { DatePicker } from './DatePicker';
import type { DatePickerProps } from './DatePicker';

function Controlled(props: Partial<DatePickerProps>) {
  const [value, setValue] = useState(props.value ?? '');
  return <DatePicker {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: 'UI/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  args: { value: '', onChange: () => {} },
  render: (args) => (
    <div style={{ width: 240, minHeight: 420 }}>
      <Controlled {...args} />
    </div>
  ),
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: '시작 일자', value: '2026-11-23', required: true } };
export const Empty: Story = { args: { label: '모집 마감일', value: '', helper: '칸에 20261130 처럼 쳐도 된다' } };
export const MinMax: Story = {
  args: {
    label: '회차 일자',
    value: '2026-11-23',
    min: '2026-11-10',
    max: '2026-12-10',
    helper: '범위 밖 날짜는 달력에서 막힌다',
  },
};
export const Error: Story = {
  args: { label: '시작 일자', value: '', required: true, error: '시작 일자를 입력해 주세요.' },
};
export const Small: Story = { args: { 'aria-label': '1회차 일자 (KST)', value: '2026-11-23', size: 'sm' } };
export const English: Story = { args: { label: 'Start date', value: '2026-11-23', locale: 'en' } };
export const Disabled: Story = { args: { label: '시작 일자', value: '2026-11-23', disabled: true } };
