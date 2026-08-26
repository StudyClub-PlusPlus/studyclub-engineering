import type { StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'UI/Checkbox',
  tags: ['autodocs'],
  args: {
    label: '동의합니다',
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Checkbox label='동의합니다' />,
};

export const Checked: Story = {
  render: () => <Checkbox label='동의합니다' defaultChecked />,
};

export const Disabled: Story = {
  render: () => <Checkbox label='동의합니다' disabled />,
};

export const DisabledChecked: Story = {
  render: () => <Checkbox label='동의합니다' disabled defaultChecked />,
};
