import type { StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';

const meta = {
  title: 'UI/Avatar',
  tags: ['autodocs'],
  args: {
    name: '테스트',
    size: 32 as const,
  },
  argTypes: {
    size: { control: 'select', options: [24, 32, 40] },
    role: { control: 'select', options: [undefined, 'captain', 'navigator', 'member'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Avatar name='테스트' size={32} />,
};

export const WithImage: Story = {
  render: () => <Avatar src='https://i.pravatar.cc/80' name='홍길동' />,
};

export const Initials한글: Story = {
  render: () => <Avatar name='테스트' />,
};

export const InitialsLatin: Story = {
  render: () => <Avatar name='John Doe' />,
};

export const RoleCaptain: Story = {
  render: () => <Avatar name='테스트' role='captain' />,
};

export const RoleNavigator: Story = {
  render: () => <Avatar name='테스트' role='navigator' />,
};

export const AllSizes: Story = {
  render: () => (
    <div className='flex items-center gap-4'>
      {([24, 32, 40] as const).map((s) => (
        <Avatar key={s} name='테스트' size={s} />
      ))}
    </div>
  ),
};

export const AllRoles: Story = {
  render: () => (
    <div className='flex items-center gap-4'>
      <Avatar name='김캡틴' role='captain' />
      <Avatar name='이내비' role='navigator' />
      <Avatar name='박멤버' role='member' />
      <Avatar name='최없음' />
    </div>
  ),
};
