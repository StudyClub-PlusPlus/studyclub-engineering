import type { ReactNode } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Providers } from '@/app/providers';

const { mockProvider } = vi.hoisted(() => ({ mockProvider: vi.fn() }));
vi.mock('next/dynamic', () => ({
  default: () => (props: { children: ReactNode; enabled?: boolean }) => {
    mockProvider(props);
    return <>{props.children}</>;
  },
}));
vi.mock('@studyclub/mock/msw', () => ({ mockHandlerGroups: [] }));
vi.mock('@studyclub/ui', () => ({ Button: () => null, Toaster: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('Providers API routing', () => {
  it('기본 개발 모드에서는 브라우저 mock 없이 화면을 렌더링한다', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', undefined);
    render(
      <Providers>
        <div>실제 API 화면</div>
      </Providers>,
    );
    expect(screen.getByText('실제 API 화면')).toBeInTheDocument();
    expect(mockProvider).not.toHaveBeenCalled();
  });

  it('명시적으로 켰을 때만 브라우저 mock을 마운트한다', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    render(
      <Providers>
        <div>Mock 화면</div>
      </Providers>,
    );
    expect(mockProvider).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });
});
