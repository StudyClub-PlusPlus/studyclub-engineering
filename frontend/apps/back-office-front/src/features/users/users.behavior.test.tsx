import type { ReactNode } from 'react';

import { toast } from '@studyclub/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersAdmin from '@/app/users/page';
import { AccountRoleCell } from '@/features/users/components/AccountRoleCell';
import { RoleBadgeSelect } from '@/features/users/components/RoleBadgeSelect';
import { DISCORD_NOTICE } from '@/features/users/labels';
import type { ApiAdminAccount, ApiAdminAccountPage } from '@/features/users/types';
import { useRevealedEmails } from '@/features/users/use-revealed-emails';
import { ApiError, http } from '@/lib/http';

// 서버는 http 한 곳으로 막는다 — 경로·요청 모양까지 함께 확인한다.
vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

// 토스트는 DOM 이 아니라 호출로 확인한다 (Toaster 를 마운트하지 않는다).
vi.mock('@studyclub/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@studyclub/ui')>();
  return { ...actual, toast: Object.assign(vi.fn(), { error: vi.fn() }) };
});

// 화면이 탭·검색·페이지를 URL 로 든다(useUrlState). 테스트에는 Next 라우터가 없어 메모리 URL 로 대신한다 —
// router.replace 가 이 값을 바꾸면 useSearchParams 를 쓰는 화면이 다시 그려진다.
const memoryUrl = vi.hoisted(() => {
  let search = '';
  const listeners = new Set<() => void>();
  return {
    get: () => search,
    set: (next: string) => {
      search = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock('next/navigation', async () => {
  const { useMemo, useSyncExternalStore } = await import('react');
  const router = {
    replace: (url: string) => memoryUrl.set(url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''),
  };
  return {
    useSearchParams: () => {
      const search = useSyncExternalStore(memoryUrl.subscribe, memoryUrl.get);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    useRouter: () => router,
    usePathname: () => '/users',
  };
});

const httpMock = vi.mocked(http);
const toastMock = vi.mocked(toast);
const toastErrorMock = vi.mocked(toast.error);

const SECRET = 'haneul@example.com';

function account(patch: Partial<ApiAdminAccount> = {}): ApiAdminAccount {
  return {
    id: 18,
    name: '하늘',
    maskedEmail: 'h***@example.com',
    systemRole: 'MEMBER',
    navigatorOf: [],
    dormant: false,
    joinedAt: '2026-09-01T11:00:00Z',
    roleChangeBlockedReason: null,
    ...patch,
  };
}

function pageOf(items: ApiAdminAccount[], total = items.length, offset = 0): ApiAdminAccountPage {
  return { items, total, offset, limit: 20 };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function renderWith(ui: ReactNode, client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper }) };
}

const offsetOf = (path: unknown) => new URL(String(path), 'http://x').searchParams.get('offset');
const listCalls = () => httpMock.mock.calls.filter(([path]) => String(path).startsWith('/api/admin/users?'));

beforeEach(() => {
  memoryUrl.set('');
  httpMock.mockReset();
  toastMock.mockClear();
  toastErrorMock.mockClear();
});

describe('useRevealedEmails — 목록이 바뀌면 다시 가린다', () => {
  it('받아 둔 원본은 같은 목록 버전에서 유지되고, 버전이 바뀌면 비워진다', () => {
    const { result, rerender } = renderHook(({ v }) => useRevealedEmails(v), { initialProps: { v: 1 } });
    act(() => result.current.reveal(18, SECRET));
    expect(result.current.emails.get(18)).toBe(SECRET);

    rerender({ v: 1 });
    expect(result.current.emails.get(18)).toBe(SECRET);

    rerender({ v: 2 });
    expect(result.current.emails.size).toBe(0);
  });
});

describe('이메일 보기', () => {
  function route(reveal: () => Promise<unknown>) {
    httpMock.mockImplementation(async (path) => {
      if (String(path).includes('/email-reveals')) return reveal();
      return pageOf([account(), account({ id: 19, name: '나래', maskedEmail: 'n***@example.com' })]);
    });
  }

  it('처리 중에는 그 줄 버튼이 막히고, 성공하면 그 줄만 원본이 보인다 — 원본은 mutation 캐시에 남지 않는다', async () => {
    const d = deferred<{ id: number; email: string }>();
    route(() => d.promise);
    const { client } = renderWith(<UsersAdmin />);

    const button = await screen.findByRole('button', { name: '하늘 이메일 보기' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent('확인 중…');
    // 다른 줄은 막히지 않는다
    expect(screen.getByRole('button', { name: '나래 이메일 보기' })).toBeEnabled();
    // 중복 클릭은 요청을 더 보내지 않는다
    fireEvent.click(button);
    expect(httpMock.mock.calls.filter(([p]) => String(p).includes('/email-reveals'))).toHaveLength(1);

    await act(async () => d.resolve({ id: 18, email: SECRET }));
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
    expect(screen.getByText('n***@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '하늘 이메일 보기' })).not.toBeInTheDocument();

    // 원본은 페이지 Map 에만 있다 — mutation 캐시에는 어떤 형태로도 남지 않는다
    const cache = client.getMutationCache();
    await waitFor(() => expect(JSON.stringify(cache.getAll().map((m) => m.state))).not.toContain(SECRET));
    await waitFor(() => expect(cache.getAll()).toHaveLength(0));
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(SECRET);
  });

  it('실패하면 가린 값을 그대로 두고 errorMessage 를 토스트로 띄운다', async () => {
    route(() => Promise.reject(new ApiError(404, '계정을 찾을 수 없습니다.')));
    renderWith(<UsersAdmin />);

    const button = await screen.findByRole('button', { name: '하늘 이메일 보기' });
    fireEvent.click(button);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('계정을 찾을 수 없습니다.'));
    expect(screen.getByText('h***@example.com')).toBeInTheDocument();
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('목록을 다시 받으면 원본이 다시 가려진다', async () => {
    route(() => Promise.resolve({ id: 18, email: SECRET }));
    const { client } = renderWith(<UsersAdmin />);

    fireEvent.click(await screen.findByRole('button', { name: '하늘 이메일 보기' }));
    expect(await screen.findByText(SECRET)).toBeInTheDocument();

    await act(async () => {
      await client.invalidateQueries({ queryKey: ['users'] });
    });
    await waitFor(() => expect(screen.queryByText(SECRET)).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '하늘 이메일 보기' })).toBeInTheDocument();
  });
});

describe('권한 변경', () => {
  async function pick(name: RegExp | string, option: RegExp | string) {
    fireEvent.click(await screen.findByRole('button', { name }));
    fireEvent.mouseDown(await screen.findByRole('option', { name: option }));
  }

  it('성공하면 목록(`[users]`)을 무효화하고 디스코드 안내를 띄운다 — 낙관적 갱신은 없다', async () => {
    const d = deferred<{ id: number; systemRole: string }>();
    httpMock.mockImplementation(async (path) => {
      if (String(path).includes('/system-role')) return d.promise;
      return pageOf([account()]);
    });
    const { client } = renderWith(<UsersAdmin />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await pick(/크루/, /캡틴/);

    // 응답 전: 배지는 그대로(크루)이고 「변경 중」만 붙는다
    expect(await screen.findByText('변경 중')).toBeInTheDocument();
    expect(within(screen.getByText('변경 중').parentElement!).getByText('크루')).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
    const patch = httpMock.mock.calls.find(([p]) => String(p).includes('/system-role'))!;
    expect(patch[0]).toBe('/api/admin/users/18/system-role');
    expect(patch[1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ systemRole: 'ADMIN' }) });

    const before = listCalls().length;
    await act(async () => d.resolve({ id: 18, systemRole: 'ADMIN' }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(DISCORD_NOTICE, expect.anything()));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('실패하면 기존 배지를 그대로 두고 errorMessage 를 토스트로 띄운다 — 디스코드 안내는 없다', async () => {
    httpMock.mockImplementation(async (path) => {
      if (String(path).includes('/system-role'))
        throw new ApiError(409, '마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요.');
      return pageOf([account({ systemRole: 'ADMIN' })]);
    });
    renderWith(<UsersAdmin />);

    await pick(/캡틴/, /크루/);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요.'));
    expect(toastMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /캡틴/ })).toBeInTheDocument();
    expect(screen.queryByText('변경 중')).not.toBeInTheDocument();
  });

  it('줄이 다시 그려져도 「변경 중」이 이어지고 같은 줄에서 중복 제출되지 않는다', async () => {
    const d = deferred<{ id: number; systemRole: string }>();
    httpMock.mockImplementation(async () => d.promise);
    const client = newClient();
    const row = account();
    const first = renderWith(<AccountRoleCell account={row} />, client);

    fireEvent.click(screen.getByRole('button', { name: /크루/ }));
    fireEvent.mouseDown(await screen.findByRole('option', { name: /캡틴/ }));
    expect(await screen.findByText('변경 중')).toBeInTheDocument();

    // 페이지를 넘겼다 돌아온 것처럼 컴포넌트를 새로 만든다 — 요청은 아직 진행 중이다
    first.unmount();
    renderWith(<AccountRoleCell account={row} />, client);
    expect(await screen.findByText('변경 중')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(httpMock).toHaveBeenCalledTimes(1);

    await act(async () => d.resolve({ id: 18, systemRole: 'ADMIN' }));
    // 처음 컴포넌트가 떠난 뒤에도 안내는 한 번 나온다
    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('변경 중')).not.toBeInTheDocument());
  });
});

describe('RoleBadgeSelect 접근성', () => {
  it('키보드(Enter)로 옵션을 고를 수 있다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RoleBadgeSelect role='MEMBER' blockedReason={null} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /크루/ }));
    const option = await screen.findByRole('option', { name: /캡틴/ });
    option.focus();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('ADMIN');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('잠긴 배지는 포커스를 받고 사유를 스크린리더가 읽는다', () => {
    render(<RoleBadgeSelect role='ADMIN' blockedReason='CANNOT_CHANGE_OWN_ROLE' onChange={() => {}} />);
    const locked = screen.getByTitle('자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요.');
    expect(locked).toHaveAttribute('tabindex', '0');
    expect(locked).toHaveAccessibleDescription('자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요.');
  });
});

describe('URL 조건', () => {
  it('URL 의 탭·검색어·페이지로 첫 요청을 하고, 탭을 바꾸면 URL 에 쓰고 첫 페이지로 돌아간다', async () => {
    memoryUrl.set('role=CAPTAIN&q=kim&page=2');
    httpMock.mockResolvedValue(pageOf([account({ name: '김캡틴' })], 30, 20));
    renderWith(<UsersAdmin />);

    await screen.findByText('김캡틴');
    expect(listCalls()[0][0]).toBe('/api/admin/users?role=CAPTAIN&q=kim&offset=20&limit=20');

    fireEvent.click(screen.getByRole('tab', { name: '크루' }));
    await waitFor(() => expect(memoryUrl.get()).toBe('role=CREW&q=kim'));
  });

  it('모르는 탭 값은 기본(전체)으로 읽는다', async () => {
    memoryUrl.set('role=HACKER');
    httpMock.mockResolvedValue(pageOf([account({ name: '아무개' })], 1, 0));
    renderWith(<UsersAdmin />);

    await screen.findByText('아무개');
    expect(listCalls()[0][0]).toBe('/api/admin/users?offset=0&limit=20');
  });
});

describe('페이지 범위', () => {
  it('offset 이 total 이상이면 total 로 계산한 마지막 페이지를 다시 요청한다', async () => {
    httpMock.mockImplementation(async (path) => {
      const offset = Number(offsetOf(path));
      if (offset === 0)
        return pageOf(
          Array.from({ length: 20 }, (_, i) => account({ id: i + 1, name: `이름${i}` })),
          45,
          0,
        );
      // 권한을 바꾼 뒤 필터 결과가 줄어 3페이지(offset 40)가 범위 밖이 된 상황
      if (offset === 40) return pageOf([], 25, 40);
      return pageOf([account({ id: 99, name: '마지막장' })], 25, offset);
    });
    renderWith(<UsersAdmin />);

    await screen.findByText('이름0');
    fireEvent.click(screen.getByRole('button', { name: '3' }));

    expect(await screen.findByText('마지막장')).toBeInTheDocument();
    const offsets = listCalls().map(([p]) => offsetOf(p));
    expect(offsets).toEqual(['0', '40', '20']);
  });

  it('결과가 아예 없는데 첫 페이지가 아니면 첫 페이지로 돌아간다', async () => {
    httpMock.mockImplementation(async (path) => {
      const offset = Number(offsetOf(path));
      if (offset === 0 && listCalls().length === 1)
        return pageOf(
          Array.from({ length: 20 }, (_, i) => account({ id: i + 1, name: `이름${i}` })),
          45,
          0,
        );
      if (offset === 20) return pageOf([], 0, 20);
      return pageOf([], 0, 0);
    });
    renderWith(<UsersAdmin />);

    await screen.findByText('이름0');
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => expect(listCalls().map(([p]) => offsetOf(p))).toEqual(['0', '20', '0']));
    expect(await screen.findByText('조건에 맞는 유저가 없습니다.')).toBeInTheDocument();
  });

  it('검색 입력은 100자까지만 받는다', async () => {
    httpMock.mockResolvedValue(pageOf([account()]));
    renderWith(<UsersAdmin />);
    expect(await screen.findByLabelText('이름 · 이메일 검색')).toHaveAttribute('maxlength', '100');
  });
});
