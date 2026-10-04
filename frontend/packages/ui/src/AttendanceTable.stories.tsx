import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { AttendanceTable, type AttendanceMember, type AttendanceSession, type AttendanceStatus } from './AttendanceTable';

const mockMembers: AttendanceMember[] = [
  { id: '1', name: '김철수', role: '캡틴' },
  { id: '2', name: '이영희', role: '네비게이터' },
  { id: '3', name: '박민수' },
  { id: '4', name: '정지원' },
  { id: '5', name: '최동욱' },
];

const mockSessions: AttendanceSession[] = [
  { id: 's1', no: 1, date: '10/01' },
  { id: 's2', no: 2, date: '10/08' },
  { id: 's3', no: 3, date: '10/15' },
  { id: 's4', no: 4, date: '10/22' },
  { id: 's5', no: 5, date: '10/29' },
];

const initialRecords: Record<string, Record<string, AttendanceStatus | undefined>> = {
  '1': { s1: 'present', s2: 'present', s3: 'present', s4: 'present' },
  '2': { s1: 'present', s2: 'late', s3: 'present', s4: 'present' },
  '3': { s1: 'present', s2: 'absent', s3: 'excused', s4: 'late' },
  '4': { s1: 'absent', s2: 'absent', s3: 'absent', s4: 'present' },
  '5': {},
};

const meta = {
  title: 'UI/AttendanceTable',
  component: AttendanceTable,
  tags: ['autodocs'],
  args: {
    members: mockMembers,
    sessions: mockSessions,
    records: initialRecords,
    readOnly: false,
    density: 'normal',
  },
  argTypes: {
    readOnly: { control: 'boolean' },
    density: { control: 'select', options: ['normal', 'compact'] },
  },
} satisfies Meta<typeof AttendanceTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: function Render(args) {
    const [records, setRecords] = useState(args.records);

    return (
      <div className='max-w-3xl'>
        <AttendanceTable
          {...args}
          records={records}
          onStatusChange={(memberId, sessionId, next) => {
            setRecords((prev) => ({
              ...prev,
              [memberId]: {
                ...prev[memberId],
                [sessionId]: next,
              },
            }));
          }}
        />
      </div>
    );
  },
};

export const CompactConsole: Story = {
  render: (args) => (
    <div className='max-w-3xl'>
      <AttendanceTable {...args} density='compact' />
    </div>
  ),
};

export const ReadOnly: Story = {
  render: (args) => (
    <div className='max-w-3xl'>
      <AttendanceTable {...args} readOnly />
    </div>
  ),
};
