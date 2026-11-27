import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { retroKeys, useToggleRetroLike } from '@/features/meeting-retro/queries';
import type { ApiRetroList, ApiRetroViewer } from '@/features/meeting-retro/types';

const mocks = vi.hoisted(() => ({ setRetroLike: vi.fn() }));
vi.mock('@/features/meeting-retro/repository', () => ({
  setRetroLike: mocks.setRetroLike,
  getMeetingRetros: vi.fn(() => new Promise(() => {})),
  getRetroViewer: vi.fn(() => new Promise(() => {})),
  getRetroStatus: vi.fn(),
  saveMyRetro: vi.fn(),
}));

const list: ApiRetroList = {
  meetingId: 3,
  deadline: '2026-12-01T11:00:00Z',
  open: true,
  targets: null,
  missing: [],
  retros: [
    {
      retroId: 1,
      author: { participantId: 11, displayName: '민호', role: 'MEMBER' },
      good: '좋았어요',
      improve: '늦었어요',
      feeling: '',
      writtenAt: '2026-11-24T13:00:00Z',
      likes: { GOOD: 2, IMPROVE: 0, FEELING: 0 },
    },
  ],
};
const viewer: ApiRetroViewer = { participantId: 12, retroId: null, liked: {} };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(retroKeys.list(5, 3), list);
  client.setQueryData(retroKeys.viewer(5, 3), viewer);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useToggleRetroLike(5, 3), { wrapper });
  const read = () => ({
    count: client.getQueryData<ApiRetroList>(retroKeys.list(5, 3))?.retros[0].likes.GOOD,
    liked: client.getQueryData<ApiRetroViewer>(retroKeys.viewer(5, 3))?.liked['1']?.GOOD ?? false,
  });
  return { result, read };
}

afterEach(() => mocks.setRetroLike.mockReset());

describe('useToggleRetroLike', () => {
  it('응답을 기다리지 않고 바로 누른 상태와 수를 그린다', async () => {
    let resolve!: (v: { count: number; liked: boolean }) => void;
    mocks.setRetroLike.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, read } = setup();

    act(() => {
      void result.current.mutateAsync({ retroId: 1, section: 'GOOD', liked: true });
    });
    await waitFor(() => expect(read()).toEqual({ count: 3, liked: true }));

    await act(async () => resolve({ count: 5, liked: true }));
    await waitFor(() => expect(read()).toEqual({ count: 5, liked: true }));
  });

  it('실패하면 그 칸을 누르기 전으로 되돌린다', async () => {
    mocks.setRetroLike.mockRejectedValue(new Error('down'));
    const { result, read } = setup();

    await act(async () => {
      await result.current.mutateAsync({ retroId: 1, section: 'GOOD', liked: true }).catch(() => {});
    });
    expect(read()).toEqual({ count: 2, liked: false });
  });
});
