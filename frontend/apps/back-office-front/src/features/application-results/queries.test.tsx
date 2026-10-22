import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { applicationResultKeys } from './queries';
import { useSaveApplicationForm } from '@/features/application-form/queries';
import { toFormValues } from '@/features/application-form/schema';

afterEach(() => vi.unstubAllGlobals());

it('신청 폼 저장 후 해당 스터디의 모든 모집 회차 결과를 갱신 대상으로 만든다', async () => {
  const client = new QueryClient();
  const current = applicationResultKeys.list(20);
  const previous = applicationResultKeys.list(20, '7');
  const unrelated = applicationResultKeys.list(21);
  for (const key of [current, previous, unrelated]) {
    client.setQueryData(key, { questions: [], applications: [], respondentCount: 0 });
  }
  const form = { studyId: 20, title: '스터디', description: '', questions: [] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(form)));
  const { result } = renderHook(() => useSaveApplicationForm(20), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await act(async () => {
    await result.current.mutateAsync(toFormValues(form, { title: '스터디', description: '' }));
  });
  expect(client.getQueryState(current)?.isInvalidated).toBe(true);
  expect(client.getQueryState(previous)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false);
});
