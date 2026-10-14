import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { AutoTextarea } from './AutoTextarea';

const meta = {
  title: 'UI/AutoTextarea',
  component: AutoTextarea,
  tags: ['autodocs'],
  args: {
    label: '내용',
    value: '',
    onChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className='w-80'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AutoTextarea>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(props: Partial<React.ComponentProps<typeof AutoTextarea>>) {
  const [value, setValue] = useState(props.value ?? '');
  return <AutoTextarea label='입력' {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  name: '기본',
  render: () => <Controlled label='내용' placeholder='입력하면 자동으로 늘어납니다' />,
};

export const Prefilled: Story = {
  name: '여러 줄',
  render: () => (
    <Controlled label='스터디 소개' value={'첫 번째 줄\n두 번째 줄\n세 번째 줄'} />
  ),
};

export const SingleLine: Story = {
  name: 'singleLine — 줄바꿈 차단',
  render: () => (
    <Controlled label='제목' placeholder='Enter 키를 눌러도 줄이 바뀌지 않습니다' singleLine />
  ),
};

export const WithMaxLength: Story = {
  name: 'maxLength',
  render: () => <Controlled label='한 줄 소개' placeholder='최대 100자' maxLength={100} />,
};

export const Invalid: Story = {
  name: '오류 상태',
  render: () => <Controlled label='내용' value='잘못된 값' invalid />,
};

export const MinRows: Story = {
  name: 'minRows — 최소 3줄',
  render: () => <Controlled label='설명' placeholder='기본 높이가 3줄입니다' minRows={3} />,
};
