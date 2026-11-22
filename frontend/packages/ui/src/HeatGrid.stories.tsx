import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { HeatGrid, type HeatGridCell } from './HeatGrid';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const ROWS = DAYS.map((d) => ({ key: d, label: d }));
const COLS = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: h % 3 === 0 ? String(h) : undefined }));

/** 저녁 · 주말에 몰리는 예시 값 */
function sample(row: number, col: number): number {
  const evening = col >= 19 && col <= 22 ? 4 : col >= 9 && col <= 18 ? 2 : col >= 7 ? 1 : 0;
  const weekend = row >= 5 ? 3 : row === 1 || row === 3 ? 2 : 0;
  return Math.max(0, evening + weekend - (col < 7 ? 2 : 0));
}
const MAX = 7;

const meta = {
  title: 'UI/HeatGrid',
  component: HeatGrid,
  tags: ['autodocs'],
  args: {
    'aria-label': '참여 가능 인원 · 요일 × 시각',
    rows: ROWS,
    columns: COLS,
    value: sample,
    max: MAX,
    unit: '명',
    describe: (r: number, c: number) => `${DAYS[r]} ${c}시 · ${sample(r, c)}명`,
    hint: '칸에 올리면 인원이 보입니다',
  },
} satisfies Meta<typeof HeatGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 보기만 — `onSelect` 가 없으면 칸을 눌러도 고르지 않는다. */
export const Default: Story = {};

/** 칸을 누르면 고른 칸에 테두리, 다시 누르면 풀린다. */
export const Selectable: Story = {
  render: (args) => {
    const [cell, setCell] = useState<HeatGridCell | null>({ row: 5, col: 20 });
    return <HeatGrid {...args} selected={cell} onSelect={setCell} />;
  },
};

/** 값이 하나도 없으면 모든 칸이 빈 칸 색이고 최대 0 이다. */
export const Empty: Story = {
  args: { value: () => 0, max: 0, describe: (r: number, c: number) => `${DAYS[r]} ${c}시 · 0명` },
};

const HOURS = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: String(h) }));
const NAMES = ['지우', '민준', '서연', '하준', '도윤', '수아', '예준'];

/** 시각을 줄, 요일을 열로 — 말풍선(`tooltip`)에 그 칸에 든 사람 이름을 나열한다. */
export const HoursByDays: Story = {
  args: {
    rows: HOURS,
    columns: ROWS,
    value: (h: number, d: number) => sample(d, h),
    describe: (h: number, d: number) => `${DAYS[d]} ${h}시 · ${sample(d, h)}명`,
    tooltip: (h: number, d: number) => NAMES.slice(0, sample(d, h)).join(', ') || '없음',
  },
};
