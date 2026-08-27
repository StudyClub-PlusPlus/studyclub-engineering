import type { StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

const meta = {
  title: 'UI/Modal',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: { story: { height: '500px' } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function ModalDemo({ size }: { size?: 'md' | 'lg' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>모달 열기</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title='스터디 신청'
        description='아래 내용을 확인하고 신청을 완료해 주세요.'
        size={size}
        footer={
          <>
            <Button variant='secondary' onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setOpen(false)}>신청 완료</Button>
          </>
        }
      >
        <div className='flex flex-col gap-4 text-sm text-neutral-700'>
          <p>스터디명: 알고리즘 마스터 클래스</p>
          <p>일정: 매주 화요일 20:00</p>
          <p>정원: 8/10명</p>
        </div>
      </Modal>
    </>
  );
}

export const Default: Story = {
  render: () => <ModalDemo />,
};

export const Large: Story = {
  render: () => <ModalDemo size='lg' />,
};

function NoFooterDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>푸터 없는 모달</Button>
      <Modal open={open} onClose={() => setOpen(false)} title='안내' description='확인 후 닫아 주세요.'>
        <p className='text-sm text-neutral-700'>Esc 키 또는 오버레이 클릭으로 닫을 수 있습니다.</p>
      </Modal>
    </>
  );
}

export const NoFooter: Story = {
  render: () => <NoFooterDemo />,
};
