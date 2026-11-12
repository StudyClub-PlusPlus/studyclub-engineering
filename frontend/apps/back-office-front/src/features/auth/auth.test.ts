import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSession, logout, setUser } from '@/features/auth/auth';
import { getQueryClient } from '@/lib/query-client';

const applicationKey = ['studies', 'detail', 107, 'applications'];

beforeEach(() => {
  vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn() });
});

afterEach(() => {
  getQueryClient().clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('서버 쿠키 정리', () => {
  it('화면의 사용자 정보를 지운 뒤 서버의 쿠키 삭제 응답까지 기다린다', async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => (finish = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const settled = vi.fn();
    const pending = logout().then(settled);
    expect(localStorage.removeItem).toHaveBeenCalledWith('bo_user');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      signal: expect.any(AbortSignal),
    });
    expect(settled).not.toHaveBeenCalled();
    finish(Response.json({ ok: true }));
    await pending;
    expect(settled).toHaveBeenCalledOnce();
  });

  it('응답이 오지 않으면 10초 후 요청을 끊어 로그인 이동이 막히지 않는다', async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal!;
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }),
    );
    const pending = logout();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeUndefined();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('통신 실패가 나도 로그인 이동을 위해 처리를 끝낸다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')));
    await expect(logout()).resolves.toBeUndefined();
  });
});

describe('세션 변경 시 개인정보 캐시', () => {
  it('로그아웃하면 이전 신청자 데이터와 진행 중 조회를 제거한다', async () => {
    const client = getQueryClient();
    client.setQueryData(applicationKey, { email: 'previous@example.com' });
    let requestSignal: AbortSignal | undefined;
    const pendingRequest = client
      .fetchQuery({
        queryKey: [...applicationKey, 'pending'],
        queryFn: ({ signal }) => {
          requestSignal = signal;
          return new Promise(() => {});
        },
      })
      .catch(() => undefined);
    clearSession();
    expect(requestSignal?.aborted).toBe(true);
    expect(client.getQueryData(applicationKey)).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    await pendingRequest;
  });

  it('다른 계정으로 로그인하면 fresh cache 대신 새 권한 검사를 받는다', async () => {
    const client = getQueryClient();
    client.setQueryData(applicationKey, { email: 'previous@example.com' });
    setUser({ id: 2, email: 'new@example.com', nickname: null, picture: null, role: 'ADMIN' });
    expect(client.getQueryData(applicationKey)).toBeUndefined();
    const fetchApplications = vi.fn().mockRejectedValue(new Error('403'));
    await expect(client.fetchQuery({ queryKey: applicationKey, queryFn: fetchApplications })).rejects.toThrow('403');
    expect(fetchApplications).toHaveBeenCalledOnce();
    expect(client.getQueryData(applicationKey)).toBeUndefined();
  });
});
