import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { TimeZonePicker } from './TimeZonePicker';
import type { TimeZoneOption, TimeZonePickerProps } from './TimeZonePicker';

const SHORT: TimeZoneOption[] = [
  { value: 'Asia/Seoul', label: '한국 · 서울', detail: 'UTC+09:00' },
  { value: 'America/New_York', label: '북미 동부 · 뉴욕, 토론토', detail: 'UTC-05:00' },
  { value: 'America/Vancouver', label: '북미 서부 · 밴쿠버', detail: 'UTC-08:00' },
  { value: 'America/Los_Angeles', label: '북미 서부 · LA', detail: 'UTC-08:00' },
];

const GROUPED: TimeZoneOption[] = [
  { value: 'Asia/Seoul', label: '서울', group: '한국', detail: 'UTC+09:00' },
  { value: 'America/New_York', label: '뉴욕', group: '미국', detail: 'UTC-05:00' },
  { value: 'America/Los_Angeles', label: '로스앤젤레스', group: '미국', detail: 'UTC-08:00', keywords: 'LA 엘에이' },
  { value: 'America/Chicago', label: '시카고', group: '미국', detail: 'UTC-06:00' },
  { value: 'America/Toronto', label: '토론토', group: '캐나다', detail: 'UTC-05:00' },
  { value: 'America/Vancouver', label: '밴쿠버', group: '캐나다', detail: 'UTC-08:00' },
  { value: 'Australia/Sydney', label: '시드니', group: '오스트레일리아', detail: 'UTC+11:00' },
  { value: 'Europe/London', label: '런던', group: '영국', detail: 'UTC+00:00' },
];

function Controlled(props: Partial<TimeZonePickerProps>) {
  const [value, setValue] = useState(props.value ?? '');
  return <TimeZonePicker options={SHORT} {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: 'UI/TimeZonePicker',
  component: TimeZonePicker,
  tags: ['autodocs'],
  args: { value: '', onChange: () => {}, options: SHORT },
  render: (args) => (
    <div style={{ width: 320, minHeight: 420 }}>
      <Controlled {...args} />
    </div>
  ),
} satisfies Meta<typeof TimeZonePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: '나의 시간대', value: 'Asia/Seoul', required: true } };
export const Empty: Story = { args: { label: '나의 시간대', value: '', placeholder: '지역을 선택해 주세요' } };
export const SearchGrouped: Story = {
  args: { label: '기준 시간대', value: 'America/Vancouver', options: GROUPED, helper: '7개 이상이면 검색 칸이 붙는다' },
};
export const Compact: Story = {
  args: { label: '백오피스 시간대', hideLabel: true, size: 'md', value: 'Asia/Seoul', options: GROUPED },
};
export const Error: Story = {
  args: { label: '나의 시간대', value: '', required: true, error: '시간대를 선택해 주세요.' },
};
export const Disabled: Story = { args: { label: '나의 시간대', value: 'Asia/Seoul', disabled: true } };
