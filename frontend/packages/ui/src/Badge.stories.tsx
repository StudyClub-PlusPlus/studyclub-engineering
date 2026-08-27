import type { StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta = {
  title: 'UI/Badge',
  tags: ['autodocs'],
  args: {
    children: '모집중',
    tone: 'recruiting' as const,
    dot: true,
  },
  argTypes: {
    tone: {
      control: 'select',
      options: [
        'recruiting',
        'closingsoon',
        'inprogress',
        'closed',
        'ended',
        'captain',
        'navigator',
        'member',
        'present',
        'late',
        'absent',
        'leave',
        'unchecked',
        'neutral',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Badge tone='recruiting' dot>
      모집중
    </Badge>
  ),
};

export const StudyStatus: Story = {
  render: () => (
    <div className='flex flex-wrap gap-2'>
      <Badge tone='recruiting' dot>
        모집중
      </Badge>
      <Badge tone='closingsoon' dot>
        마감임박
      </Badge>
      <Badge tone='inprogress' dot>
        진행중
      </Badge>
      <Badge tone='closed' dot>
        마감
      </Badge>
      <Badge tone='ended' dot>
        종료
      </Badge>
    </div>
  ),
};

export const MemberRole: Story = {
  render: () => (
    <div className='flex flex-wrap gap-2'>
      <Badge tone='captain'>팀장</Badge>
      <Badge tone='navigator'>내비게이터</Badge>
      <Badge tone='member'>멤버</Badge>
    </div>
  ),
};

export const Attendance: Story = {
  render: () => (
    <div className='flex flex-wrap gap-2'>
      <Badge tone='present'>출석</Badge>
      <Badge tone='late'>지각</Badge>
      <Badge tone='absent'>결석</Badge>
      <Badge tone='leave'>조퇴</Badge>
      <Badge tone='unchecked'>미확인</Badge>
    </div>
  ),
};
