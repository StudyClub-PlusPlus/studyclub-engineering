import type { Meta, StoryObj } from '@storybook/react';
import { toast, Toaster } from './Toast';
import { Button } from './Button';

const meta: Meta<typeof Toaster> = {
  title: 'UI/Toast',
  component: Toaster,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '`react-hot-toast` 래퍼. `<Toaster />`를 루트 레이아웃에 한 번 두고, `toast()` 함수로 알림을 띄운다.',
      },
    },
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster position='bottom-center' />
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  render: () => (
    <Button onClick={() => toast.success('스터디 신청이 완료됐어요!')}>
      성공 토스트
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button
      variant='destructive'
      onClick={() => toast.error('신청 중 오류가 발생했습니다. 다시 시도해 주세요.')}
    >
      에러 토스트
    </Button>
  ),
};

export const Loading: Story = {
  render: () => (
    <Button
      variant='tonal'
      onClick={() => {
        const id = toast.loading('신청 처리 중…');
        setTimeout(() => toast.success('신청 완료!', { id }), 2000);
      }}
    >
      로딩 → 성공 (2초)
    </Button>
  ),
};

export const Default: Story = {
  render: () => (
    <Button variant='secondary' onClick={() => toast('새로운 스터디가 열렸어요 🎉')}>
      기본 토스트
    </Button>
  ),
};

export const AllTypes: Story = {
  render: () => (
    <div className='flex flex-wrap gap-2'>
      <Button variant='secondary' onClick={() => toast('기본')}>
        기본
      </Button>
      <Button onClick={() => toast.success('성공')}>성공</Button>
      <Button variant='destructive' onClick={() => toast.error('에러')}>
        에러
      </Button>
      <Button
        variant='tonal'
        onClick={() => {
          const id = toast.loading('로딩 중…');
          setTimeout(() => toast.dismiss(id), 2000);
        }}
      >
        로딩 (2초)
      </Button>
    </div>
  ),
};

export const WithPromise: Story = {
  name: 'Promise (비동기 흐름)',
  render: () => (
    <Button
      onClick={() =>
        toast.promise(new Promise((res) => setTimeout(res, 2000)), {
          loading: '신청 처리 중…',
          success: '신청이 완료됐어요!',
          error: '오류가 발생했습니다.',
        })
      }
    >
      Promise 토스트
    </Button>
  ),
};

export const TopCenter: Story = {
  name: 'Position — top-center',
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster position='top-center' />
      </>
    ),
  ],
  render: () => (
    <Button onClick={() => toast.success('상단 중앙에서 나와요')}>
      top-center
    </Button>
  ),
};
