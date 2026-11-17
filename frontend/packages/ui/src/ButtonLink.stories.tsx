import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRight, FolderOpen } from 'lucide-react';

import { ButtonLink } from './ButtonLink';

const meta = {
  title: 'UI/ButtonLink',
  component: ButtonLink,
  tags: ['autodocs'],
  args: { href: '#', children: '스터디 둘러보기' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'tertiary', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof ButtonLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  name: '변형 (Button 과 같다)',
  render: () => (
    <div className='flex flex-wrap items-center gap-2'>
      <ButtonLink href='#'>주 행동</ButtonLink>
      <ButtonLink href='#' variant='secondary'>
        보조
      </ButtonLink>
      <ButtonLink href='#' variant='tertiary'>
        되돌리기
      </ButtonLink>
    </div>
  ),
};

export const External: Story = {
  name: '바깥 사이트 (새 탭)',
  render: () => (
    <ButtonLink href='https://drive.google.com' external variant='secondary' size='sm' leadingIcon={<FolderOpen />}>
      자료실
    </ButtonLink>
  ),
};

export const WithIcon: Story = {
  name: '아이콘',
  render: () => (
    <ButtonLink href='#' size='lg' trailingIcon={<ArrowRight />}>
      스터디 둘러보기
    </ButtonLink>
  ),
};
