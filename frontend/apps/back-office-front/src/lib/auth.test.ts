import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSession, setUser } from './auth';
import { getQueryClient } from './query-client';

const applicationKey = ['studies', 'detail', 107, 'applications'];

beforeEach(() => {
  vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn() });
});

afterEach(() => {
  getQueryClient().clear();
  vi.unstubAllGlobals();
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
