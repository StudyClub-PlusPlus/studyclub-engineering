import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Pagination } from './Pagination';

const meta = {
  title: 'UI/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  args: {
    page: 1,
    total: 10,
    onChange: () => {},
  },
  argTypes: {
    page: { control: 'number' },
    total: { control: 'number' },
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [page, setPage] = useState(args.page);
    return <Pagination {...args} page={page} onChange={setPage} />;
  },
};

export const MiddlePage: Story = {
  render: function Render() {
    const [page, setPage] = useState(5);
    return <Pagination page={page} total={15} onChange={setPage} />;
  },
};

export const SmallTotal: Story = {
  render: function Render() {
    const [page, setPage] = useState(2);
    return <Pagination page={page} total={5} onChange={setPage} />;
  },
};
