import { afterEach, describe, expect, it, vi } from 'vitest';

import { register } from '@/instrumentation';

const { setupServer, listen } = vi.hoisted(() => {
  const listen = vi.fn();
  return { listen, setupServer: vi.fn(() => ({ listen })) };
});
vi.mock('msw/node', () => ({ setupServer }));
vi.mock('@studyclub/mock/msw/handlers', () => ({ handlers: [] }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('back-office API mocking', () => {
  it.each([undefined, '', 'disabled'])('개발 기본값(%s)은 실제 API를 가로채지 않는다', async (flag) => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', flag);
    await register();
    expect(setupServer).not.toHaveBeenCalled();
  });

  it('개발 중 명시적으로 켠 경우에만 mock 서버를 시작한다', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    await register();
    expect(listen).toHaveBeenCalledWith({ onUnhandledRequest: 'bypass' });
  });

  it.each(['production', 'test'])('%s에서는 opt-in이 있어도 실제 API를 사용한다', async (mode) => {
    vi.stubEnv('NODE_ENV', mode);
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    await register();
    expect(setupServer).not.toHaveBeenCalled();
  });
});
