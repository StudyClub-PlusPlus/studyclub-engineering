import type { Meta, StoryObj } from '@storybook/react-vite';
import { Info } from 'lucide-react';

import { HelpPopover } from './HelpPopover';

const meta = {
  title: 'UI/HelpPopover',
  component: HelpPopover,
  tags: ['autodocs'],
  args: { label: '발표 표시 설명', children: '칸 왼쪽 위 마이크는 그 회차 발표자예요.' },
  decorators: [
    (Story) => (
      <div className='h-48 p-4'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HelpPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InText: Story = {
  name: '글줄 안 (정보 아이콘)',
  render: () => (
    <p className='type-body-sm text-fg'>
      매주 화 21:00{' '}
      <HelpPopover label='스터디 시간 기준 안내' icon={<Info />}>
        <span className='block font-semibold text-fg'>반 기준: 화 21:00 KST</span>
        <span className='mt-1 block'>서머타임에 따라 내 지역의 시간이 달라질 수 있어요.</span>
      </HelpPopover>
    </p>
  ),
};

export const AlignEnd: Story = {
  name: '오른쪽 끝에 맞추기',
  render: () => (
    <div className='flex justify-end'>
      <HelpPopover label='정렬 안내' align='end'>
        화면 오른쪽 가장자리 근처에서는 말풍선을 단추 오른쪽 끝에 맞춰 밖으로 나가지 않게 해요.
      </HelpPopover>
    </div>
  ),
};
