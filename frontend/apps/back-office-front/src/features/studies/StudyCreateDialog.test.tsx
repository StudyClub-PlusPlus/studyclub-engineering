import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { EMPTY_FORM } from '@/features/studies/form-schema';
import { StudyCreateDialog } from '@/features/studies/StudyCreateDialog';

afterEach(() => vi.restoreAllMocks());

it('등록에 성공한 뒤 「확인」 대신 Esc 로 닫아도 목록을 다시 받는다', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  const onConfirmed = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <StudyCreateDialog
        open
        onClose={vi.fn()}
        onConfirmed={onConfirmed}
        initial={{ ...EMPTY_FORM, title: '새 스터디', summary: '소개', category: 'AI_ML', deadline: '2026-12-01' }}
      />
    </QueryClientProvider>,
  );

  await userEvent.click(screen.getByRole('button', { name: '등록' }));
  await screen.findByText(/등록되었습니다/);
  await userEvent.keyboard('{Escape}');

  expect(onConfirmed).toHaveBeenCalledOnce();
});
