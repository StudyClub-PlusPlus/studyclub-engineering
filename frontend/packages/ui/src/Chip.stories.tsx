import type { StoryObj } from '@storybook/react';
import { useState } from 'react';
import { FilterChip } from './Chip';

const meta = {
  title: 'UI/FilterChip',
  tags: ['autodocs'],
  args: {
    children: '프론트엔드',
    selected: false,
    selectMode: 'multi' as const,
  },
  argTypes: {
    selectMode: { control: 'select', options: ['multi', 'single'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <FilterChip {...args} />,
};

export const Selected: Story = {
  render: (args) => <FilterChip {...args} selected />,
};

export const SelectedSingle: Story = {
  render: (args) => <FilterChip {...args} selected selectMode='single' />,
};

export const MultiSelect: Story = {
  render: () => {
    const options = ['전체', '프론트엔드', '백엔드', '알고리즘', 'CS'];
    const [selected, setSelected] = useState<string[]>([]);
    const toggle = (v: string) =>
      setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
    return (
      <div className='flex flex-wrap gap-2'>
        {options.map((o) => (
          <FilterChip key={o} selected={selected.includes(o)} onClick={() => toggle(o)}>
            {o}
          </FilterChip>
        ))}
      </div>
    );
  },
};

export const SingleSelect: Story = {
  render: () => {
    const options = ['전체', '모집중', '진행중', '종료'];
    const [selected, setSelected] = useState('전체');
    return (
      <div className='flex flex-wrap gap-2'>
        {options.map((o) => (
          <FilterChip key={o} selected={selected === o} selectMode='single' onClick={() => setSelected(o)}>
            {o}
          </FilterChip>
        ))}
      </div>
    );
  },
};
