import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { HelpPopover } from '../../../../packages/ui/src/HelpPopover';
afterEach(() => vi.restoreAllMocks());
it.each([
  { align: 'start' as const, x: 291, expected: -205 },
  { align: 'end' as const, x: 20, expected: -4 },
  { align: 'start' as const, x: 40, expected: 0 },
])('keeps $align help inside the viewport at x=$x', async ({ align, x, expected }) => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(390);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.getAttribute('role') === 'dialog' ? 288 : 24;
    return { left: x, right: x + width, width, top: 0, bottom: 24, height: 24, x, y: 0, toJSON() {} };
  });
  render(
    <HelpPopover label='시간 안내' align={align}>
      설명
    </HelpPopover>,
  );
  await userEvent.click(screen.getByRole('button', { name: '시간 안내' }));
  expect(screen.getByRole('dialog')).toHaveStyle({ left: `${expected}px` });
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveFocus();
});
it('repositions an open panel when the viewport shrinks', async () => {
  let viewport = 800;
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(() => viewport);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.getAttribute('role') === 'dialog' ? 288 : 24;
    return { left: 291, right: 291 + width, width, top: 0, bottom: 24, height: 24, x: 291, y: 0, toJSON() {} };
  });
  render(<HelpPopover label='시간 안내'>설명</HelpPopover>);
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toHaveStyle({ left: '0px' });
  viewport = 390;
  fireEvent(window, new Event('resize'));
  expect(screen.getByRole('dialog')).toHaveStyle({ left: '-205px' });
});
