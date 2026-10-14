import type { Meta, StoryObj } from '@storybook/react';

import { DiscordGlyph } from './DiscordGlyph';

const meta = {
  title: 'UI/DiscordGlyph',
  component: DiscordGlyph,
  tags: ['autodocs'],
  args: { size: 24 },
} satisfies Meta<typeof DiscordGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: '기본',
  render: (args) => <DiscordGlyph {...args} />,
};

export const Sizes: Story = {
  name: '사이즈',
  render: () => (
    <div className='flex items-end gap-4 text-[#5865F2]'>
      {([14, 16, 20, 24, 32] as const).map((s) => (
        <div key={s} className='flex flex-col items-center gap-1'>
          <DiscordGlyph size={s} />
          <span className='text-[10px] text-fg-muted'>{s}</span>
        </div>
      ))}
    </div>
  ),
};

export const Colored: Story = {
  name: '색상 적용',
  render: () => (
    <div className='flex items-center gap-4'>
      <span className='text-[#5865F2]'><DiscordGlyph size={24} /></span>
      <span className='text-fg-muted'><DiscordGlyph size={24} /></span>
      <span className='text-white' style={{ background: '#5865F2', padding: 6, borderRadius: 6 }}>
        <DiscordGlyph size={24} />
      </span>
    </div>
  ),
};
