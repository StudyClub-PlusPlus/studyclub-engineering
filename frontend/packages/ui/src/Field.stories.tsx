import type { Meta, StoryObj } from '@storybook/react';

import { Checkbox } from './Checkbox';
import { FieldShell, Input, Select, Textarea } from './Field';

const meta = {
  title: 'UI/Field',
  component: Input,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className='w-80'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InputDefault: Story = {
  name: 'Input / 기본',
  render: () => <Input label='스터디 이름' placeholder='이름을 입력해 주세요' />,
};

export const InputSizes: Story = {
  name: 'Input / 크기 (sm, md, lg)',
  render: () => (
    <div className='flex flex-col gap-4'>
      <Input label='Small (h-8)' size='sm' placeholder='Small (32px)' />
      <Input label='Medium / 기본 (h-10)' size='md' placeholder='Medium (40px)' />
      <Input label='Large (h-12)' size='lg' placeholder='Large (48px)' />
    </div>
  ),
};

export const InputRequired: Story = {
  name: 'Input / 필수',
  render: () => <Input label='이름' placeholder='필수 항목' required />,
};

export const InputHelper: Story = {
  name: 'Input / 도움말',
  render: () => (
    <Input label='한 줄 소개' placeholder='50자 이내' helper='다른 멤버에게 보여집니다.' labelHint='최대 50자' />
  ),
};

export const InputError: Story = {
  name: 'Input / 오류',
  render: () => <Input label='이메일' defaultValue='wrong@' error='올바른 이메일 형식을 입력해 주세요.' />,
};

export const InputDisabled: Story = {
  name: 'Input / 비활성',
  render: () => <Input label='가입일' defaultValue='2024-01-01' disabled />,
};

export const SelectDefault: Story = {
  name: 'Select / 기본',
  render: () => (
    <Select label='지역' required>
      <option value=''>선택해 주세요</option>
      <option value='서울'>서울</option>
      <option value='부산'>부산</option>
      <option value='온라인'>온라인</option>
    </Select>
  ),
};

export const SelectError: Story = {
  name: 'Select / 오류',
  render: () => (
    <Select label='지역' error='지역을 선택해 주세요.'>
      <option value=''>선택해 주세요</option>
    </Select>
  ),
};

export const SelectSizes: Story = {
  name: 'Select / 크기 (sm, md, lg)',
  render: () => (
    <div className='flex flex-col gap-4'>
      <Select label='Small (h-8)' size='sm'>
        <option value='sm'>Small (32px)</option>
      </Select>
      <Select label='Medium / 기본 (h-10)' size='md'>
        <option value='md'>Medium (40px)</option>
      </Select>
      <Select label='Large (h-12)' size='lg'>
        <option value='lg'>Large (48px)</option>
      </Select>
    </div>
  ),
};

export const TextareaDefault: Story = {
  name: 'Textarea / 기본',
  render: () => <Textarea label='스터디 소개' placeholder='스터디를 소개해 주세요.' rows={4} />,
};

export const TextareaError: Story = {
  name: 'Textarea / 오류',
  render: () => <Textarea label='스터디 소개' defaultValue='짧음' error='최소 20자 이상 입력해 주세요.' />,
};

export const FieldShellWithCheckbox: Story = {
  name: 'FieldShell / Checkbox 조합',
  render: () => (
    <FieldShell label='알림 설정' helper='변경사항 발생 시 이메일로 안내합니다.'>
      <div className='flex flex-col gap-2'>
        <Checkbox label='신청 현황 알림' defaultChecked />
        <Checkbox label='공지사항 알림' />
        <Checkbox label='마감임박 알림' />
      </div>
    </FieldShell>
  ),
};
