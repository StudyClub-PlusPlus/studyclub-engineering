import type { StoryObj } from '@storybook/react-vite';

import { Button } from './Button';
import { SelectionCount, TableActionBar } from './TableActionBar';

const meta = { title: 'UI/TableActionBar', component: TableActionBar, tags: ['autodocs'] };

export default meta;
type Story = StoryObj<typeof meta>;

/** 고르기 전 — 개수 0, 고른 것에 하는 일은 잠김. 저장도 잠김. */
export const Idle: Story = {
  render: () => (
    <TableActionBar
      selection={
        <>
          <SelectionCount count={0} unit='개' />
          <Button size='sm' variant='danger' disabled>
            삭제
          </Button>
        </>
      }
      save={
        <Button size='sm' disabled>
          저장
        </Button>
      }
    />
  ),
};

/** 고르고 고친 뒤 — 한 줄에 왼쪽 선택 작업, 오른쪽 저장. */
export const SelectedAndDirty: Story = {
  render: () => (
    <TableActionBar
      selection={
        <>
          <SelectionCount count={3} unit='명' />
          <Button size='sm' variant='secondary'>
            적용
          </Button>
          <Button size='sm' variant='danger'>
            참여 중단
          </Button>
          <Button size='sm' variant='ghost'>
            선택 해제
          </Button>
        </>
      }
      save={
        <>
          <Button size='sm' variant='ghost'>
            변경 취소
          </Button>
          <Button size='sm'>저장</Button>
        </>
      }
    />
  ),
};
