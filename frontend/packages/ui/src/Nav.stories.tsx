import type { Meta, StoryObj } from '@storybook/react';
import { BookOpen, CalendarDays, LayoutDashboard, LogOut, Mail, Users } from 'lucide-react';

import { Button } from './Button';
import { Nav } from './Nav';

const siteItems = [
  { key: 'studies', label: '스터디', href: '#studies', active: true },
  { key: 'events', label: '행사', href: '#events' },
  { key: 'guide', label: '가이드', href: '#guide' },
  { key: 'notices', label: '공지사항', href: '#notices' },
  { key: 'about', label: '소개', href: '#about' },
];

const consoleItems = [
  { key: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={18} />, active: true },
  { key: 'studies', label: '스터디', icon: <BookOpen size={18} /> },
  { key: 'events', label: '행사', icon: <CalendarDays size={18} /> },
  { key: 'users', label: '유저', icon: <Users size={18} /> },
  { key: 'templates', label: '알림 템플릿', icon: <Mail size={18} /> },
];

const meta = {
  title: 'UI/Nav',
  component: Nav,
  tags: ['autodocs'],
  args: {
    variant: 'site',
    brand: <span className='text-lg font-bold tracking-tight'>StudyClub++</span>,
    items: siteItems,
    actions: (
      <Button size='sm' variant='primary'>
        로그인
      </Button>
    ),
  },
  argTypes: {
    variant: { control: 'select', options: ['site', 'sidebar'] },
  },
} satisfies Meta<typeof Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SiteNav: Story = {
  render: (args) => <Nav {...args} />,
};

export const ConsoleSidebar: Story = {
  render: () => (
    <div className='h-[480px]'>
      <Nav
        variant='sidebar'
        brand={<span className='text-[15px] font-bold'>운영자 콘솔</span>}
        items={consoleItems}
        actions={
          <button
            type='button'
            className='flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg'
          >
            <LogOut size={16} /> 로그아웃
          </button>
        }
      />
    </div>
  ),
};
