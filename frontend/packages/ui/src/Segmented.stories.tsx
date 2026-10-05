import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Grid, List, Table } from 'lucide-react';

import { Segmented } from './Segmented';

const basicOptions = [
  { value: 'all', label: '전체' },
  { value: 'recruiting', label: '모집중' },
  { value: 'inprogress', label: '진행중' },
  { value: 'closed', label: '종료' },
];

const iconOptions = [
  { value: 'grid', label: '그리드', icon: <Grid size={15} /> },
  { value: 'list', label: '리스트', icon: <List size={15} /> },
  { value: 'table', label: '테이블', icon: <Table size={15} /> },
];

const meta = {
  title: 'UI/Segmented',
  component: Segmented,
  tags: ['autodocs'],
  args: {
    options: basicOptions,
    defaultValue: 'all',
    size: 'md',
    shape: 'rounded',
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
    fullWidth: { control: 'boolean' },
  },
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Segmented {...args} />,
};

export const PillShape: Story = {
  render: (args) => <Segmented {...args} shape='pill' defaultValue='all' />,
};

export const WithIcons: Story = {
  render: () => {
    const [val, setVal] = useState('grid');
    return <Segmented options={iconOptions} value={val} onChange={setVal} />;
  },
};

export const SmallSize: Story = {
  render: () => <Segmented options={basicOptions} size='sm' shape='pill' defaultValue='all' />,
};
