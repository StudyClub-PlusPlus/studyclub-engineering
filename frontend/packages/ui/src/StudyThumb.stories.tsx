import type { Meta, StoryObj } from '@storybook/react';

import { StudyThumb } from './StudyThumb';

const meta = {
  title: 'UI/StudyThumb',
  component: StudyThumb,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className='w-80 overflow-hidden rounded-xl'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StudyThumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImage: Story = {
  name: '이미지 없음 — 카테고리 fallback',
  render: () => <StudyThumb category='AI&ML' />,
};

export const WithImage: Story = {
  name: '이미지 있음',
  render: () => (
    <StudyThumb image='https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=640' />
  ),
};

export const Categories: Story = {
  name: '카테고리별 그라디언트',
  decorators: [
    (Story) => (
      <div className='w-full'>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className='grid grid-cols-2 gap-2'>
      {['AI&ML', 'FE', '데이터 사이언스', 'CS', '취업', '어학', '디자인', '기타'].map((cat) => (
        <div key={cat} className='overflow-hidden rounded-lg'>
          <StudyThumb category={cat} />
        </div>
      ))}
    </div>
  ),
};

export const Unknown: Story = {
  name: '알 수 없는 카테고리 — 해시 배정',
  render: () => <StudyThumb category='양자컴퓨팅' />,
};
