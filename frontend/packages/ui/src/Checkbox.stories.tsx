import type { StoryObj } from '@storybook/react-vite';
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

export const Indeterminate: Story = {
  render: () => <Checkbox label='전체 선택' indeterminate />,
};

export const Disabled: Story = {
  render: () => <Checkbox label='동의합니다' disabled />,
};

export const DisabledChecked: Story = {
  render: () => <Checkbox label='동의합니다' disabled defaultChecked />,
};

export const HiddenLabel: Story = {
  name: '라벨 숨김 (표의 행 선택)',
  render: () => <Checkbox label='김스터디 선택' hideLabel />,
};
