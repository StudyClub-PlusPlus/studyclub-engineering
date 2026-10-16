import { toast } from '@studyclub/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NotificationHistoryPage from '@/app/notifications/page';
import { RESEND_POLL_MS } from '@/features/notifications/queries';
import type {
  ApiNotification,
  ApiNotificationPage,
  ApiNotificationResend,
} from '@/features/notifications/types';
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

// 화면이 필터·페이지를 URL 로 든다(useUrlState). 테스트에는 Next 라우터가 없어 메모리 URL 로 대신한다.
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
    usePathname: () => '/notifications',
  };
});

const httpMock = vi.mocked(http);
const toastMock = vi.mocked(toast);
const toastErrorMock = vi.mocked(toast.error);

function row(patch: Partial<ApiNotification> = {}): ApiNotification {
  return {
    id: 1,
    eventType: 'USER_REGISTERED',
    recipientType: 'EMAIL',
    recipientValue: 'h***@example.com',
    status: 'SENT',
    templateId: 1,
    sentAt: '2026-10-15T09:00:05Z',
    createdAt: '2026-10-15T09:00:00Z',
    canResend: false,
    ...patch,
  };
}

const TEMPLATES = [
  { id: 1, eventType: 'USER_REGISTERED', channel: 'EMAIL', subject: 's', body: 'b', updatedAt: null, updatedByAdminId: null },
];

/** 서버 흉내 — 목록(필터·페이지·ids)과 재발송 접수. 요청은 httpMock.mock.calls 로 확인한다. */
function fakeServer(initial: ApiNotification[], opts: { resendFails?: boolean } = {}) {
  const db = initial.map((r) => ({ ...r }));
  httpMock.mockImplementation(async (path: string, init?: RequestInit) => {
    const url = new URL(path, 'http://x');
    if (url.pathname === '/api/admin/notification-templates') return TEMPLATES;
    if (url.pathname === '/api/admin/notifications/resend') {
      if (opts.resendFails) throw new ApiError(500, '서버 오류');
      const { ids } = JSON.parse(String(init?.body)) as { ids: number[] };
      const result: ApiNotificationResend = { accepted: [], skipped: [] };
      for (const id of ids) {
        const target = db.find((r) => r.id === id)!;
        if (target.canResend) {
          target.status = 'PENDING';
          target.canResend = false;
          result.accepted.push(id);
        } else result.skipped.push({ id, reason: 'NOT_FAILED' });
      }
      return result;
    }
    if (url.pathname === '/api/admin/notifications') {
      const ids = url.searchParams.get('ids');
      if (ids) {
        const items = db.filter((r) => ids.split(',').map(Number).includes(r.id));
        return { items, total: items.length, offset: 0, limit: items.length } satisfies ApiNotificationPage;
      }
      const status = url.searchParams.get('status');
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const matched = db.filter((r) => !status || r.status === status);
      return { items: matched.slice(offset, offset + limit), total: matched.length, offset, limit } satisfies ApiNotificationPage;
    }
    throw new Error(`unexpected request: ${path}`);
  });
  return db;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationHistoryPage />
    </QueryClientProvider>,
  );
}

/** 표 안만 본다 — 상태 필터의 <option>(대기·실패 …)과 뱃지 문구가 겹친다. */
const table = () => within(screen.getByRole('table'));

const listCalls = () =>
  httpMock.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith('/api/admin/notifications?') || p === '/api/admin/notifications');
const resendCalls = () => httpMock.mock.calls.filter((c) => String(c[0]) === '/api/admin/notifications/resend');

beforeEach(() => {
  httpMock.mockReset();
  toastMock.mockReset();
  toastErrorMock.mockReset();
  memoryUrl.set('');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('발송 이력 조회', () => {
  it('상태·조건·채널을 문구로 적고 수신 주소는 서버가 가린 값 그대로 적는다', async () => {
    fakeServer([
      row({ id: 3, status: 'FAILED', sentAt: null, canResend: true, recipientValue: 'a***@example.com' }),
      row({ id: 2, status: 'PROCESSING', sentAt: null }),
      row({ id: 1, status: 'SENT' }),
    ]);
    renderPage();

    expect(await screen.findByText('a***@example.com')).toBeInTheDocument();
    expect(table().getByText('실패')).toBeInTheDocument();
    expect(table().getByText('처리 중')).toBeInTheDocument();
    expect(table().getByText('완료')).toBeInTheDocument();
    expect(table().getAllByText('회원가입')).toHaveLength(3); // 코드가 아니라 라벨
    expect(screen.queryByText('USER_REGISTERED', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getAllByText('메일').length).toBeGreaterThan(0);
    // 아직 안 나간 줄의 발송 시각은 「—」다
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('총 건수는 지금 조건에 걸린 전체 건수다 — 보이는 20건이 아니다', async () => {
    fakeServer(Array.from({ length: 45 }, (_, i) => row({ id: i + 1 })));
    renderPage();

    await waitFor(() => expect(screen.getByTestId('history-total')).toHaveTextContent('총 45건'));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 20); // 머리 + 20줄
  });

  it('「전체」일 때는 상태·조건을 서버에 보내지 않는다', async () => {
    fakeServer([row()]);
    renderPage();
    await screen.findByText('h***@example.com');

    const path = listCalls()[0]!;
    expect(path).toContain('offset=0');
    expect(path).toContain('limit=20');
    expect(path).not.toContain('status');
    expect(path).not.toContain('eventType');
  });

  it('고르기 전에는 축 이름만, 하나 고르면 첫 줄이 「전체」가 되고 조건은 URL 에 든다', async () => {
    fakeServer([row({ id: 2, status: 'FAILED', canResend: true }), row({ id: 1 })]);
    renderPage();
    await screen.findAllByText('회원가입');

    const status = screen.getByRole('combobox', { name: '상태' });
    expect(within(status).getAllByRole('option')[0]).toHaveTextContent('상태');
    fireEvent.change(status, { target: { value: 'FAILED' } });

    await waitFor(() => expect(memoryUrl.get()).toBe('status=FAILED'));
    expect(within(screen.getByRole('combobox', { name: '상태' })).getAllByRole('option')[0]).toHaveTextContent('전체');
    await waitFor(() => expect(listCalls().some((p) => p.includes('status=FAILED'))).toBe(true));
  });

  it('조건을 바꾸면 첫 페이지로 돌아간다', async () => {
    memoryUrl.set('page=3');
    fakeServer(Array.from({ length: 70 }, (_, i) => row({ id: i + 1 })));
    renderPage();
    await screen.findByTestId('history-total');

    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'SENT' } });

    await waitFor(() => expect(memoryUrl.get()).toBe('status=SENT'));
  });

  it('URL 의 모르는 상태값은 전체로 본다', async () => {
    memoryUrl.set('status=NOPE');
    fakeServer([row()]);
    renderPage();
    await screen.findByText('h***@example.com');

    expect(listCalls()[0]).not.toContain('status');
  });

  it('모르는 상태값은 원문 코드를 그대로 적는다 — 빈칸으로 두지 않는다', async () => {
    fakeServer([row({ status: 'CANCELLED', sentAt: null })]);
    renderPage();

    expect(await screen.findByText('CANCELLED')).toBeInTheDocument();
  });

  it('읽을 수 없는 시각은 원문 문자열을 그대로 적는다', async () => {
    fakeServer([row({ createdAt: 'not-a-date' })]);
    renderPage();

    expect(await screen.findByText('not-a-date')).toBeInTheDocument();
  });
});

describe('비었을 때와 못 읽었을 때', () => {
  it('이력이 한 건도 없으면 안내만 — 건수는 0건으로 보이되 페이지 줄은 그리지 않는다', async () => {
    fakeServer([]);
    renderPage();

    expect(await screen.findByText('아직 알림 발송 이력이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '전체 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('거른 결과가 없으면 안내와 전체 보기가 서고, 누르면 조건이 풀린다', async () => {
    memoryUrl.set('status=FAILED');
    fakeServer([row()]);
    renderPage();

    expect(await screen.findByText('선택한 조건의 발송 이력이 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));

    await waitFor(() => expect(memoryUrl.get()).toBe(''));
  });

  it('읽기 실패는 「0건」이 아니다 — 안내와 다시 시도가 서고 건수는 숨긴다', async () => {
    httpMock.mockImplementation(async (path: string) => {
      if (String(path).startsWith('/api/admin/notification-templates')) return TEMPLATES;
      throw new ApiError(500, '서버 오류');
    });
    renderPage();

    expect(await screen.findByText('발송 이력을 불러오지 못했습니다. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('아직 알림 발송 이력이 없습니다.')).not.toBeInTheDocument();
    expect(screen.getByTestId('history-total')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도를 누르면 다시 읽는다', async () => {
    let failing = true;
    httpMock.mockImplementation(async (path: string) => {
      if (String(path).startsWith('/api/admin/notification-templates')) return TEMPLATES;
      if (failing) throw new ApiError(500, '서버 오류');
      return { items: [row()], total: 1, offset: 0, limit: 20 } satisfies ApiNotificationPage;
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    failing = false;
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('h***@example.com')).toBeInTheDocument();
  });
});

describe('한 건 재발송', () => {
  it('서버가 canResend 라고 한 줄에만 아이콘이 선다 — 상태 문구로 화면이 다시 판정하지 않는다', async () => {
    fakeServer([
      row({ id: 3, status: 'FAILED', sentAt: null, canResend: true }),
      // 실패지만 서버가 못 보낸다고 한 줄(탈퇴한 회원) — 아이콘이 없어야 한다
      row({ id: 2, status: 'FAILED', sentAt: null, canResend: false }),
      row({ id: 1, status: 'SENT' }),
    ]);
    renderPage();
    await screen.findAllByText('회원가입');

    expect(screen.getAllByRole('button', { name: '재발송' })).toHaveLength(1);
  });

  it('누르면 묻지 않고 접수하고, 끝나면 토스트를 한 번만 띄운다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const db = fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '재발송' }));

    await waitFor(() => expect(resendCalls()).toHaveLength(1));
    expect(JSON.parse(String(resendCalls()[0]![1]?.body))).toEqual({ ids: [7] });
    // 접수한 뒤에 그 줄이 「대기」로 바뀐다
    await waitFor(() => expect(table().getByText('대기')).toBeInTheDocument());
    expect(toastMock).not.toHaveBeenCalled(); // 접수는 끝이 아니다 — 아직 알리지 않는다

    db[0]!.status = 'SENT'; // 발송기가 보냈다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_POLL_MS + 10);
    });

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith('재발송에 성공했습니다.');
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('다시 보냈는데 또 실패하면 실패를 알린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const db = fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '재발송' }));
    await waitFor(() => expect(table().getByText('대기')).toBeInTheDocument());

    db[0]!.status = 'FAILED';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_POLL_MS + 10);
    });

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('발송에 실패했습니다.'));
  });

  it('누른 아이콘은 끝이 확인될 때까지 돌고 눌리지 않는다 — 두 번 눌러도 한 번만 나간다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })]);
    renderPage();
    const button = await screen.findByRole('button', { name: '재발송' });

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(resendCalls()).toHaveLength(1));
  });

  it('요청이 서버에 닿지 못하면 한 건도 나가지 않은 것이다 — 상태는 실패 그대로, 아이콘을 되살린다', async () => {
    fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })], { resendFails: true });
    renderPage();
    const button = await screen.findByRole('button', { name: '재발송' });

    fireEvent.click(button);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('재발송을 요청하지 못했습니다. 다시 시도해 주세요.'),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: '재발송' })).toBeEnabled());
    expect(table().getByText('실패')).toBeInTheDocument();
    expect(table().queryByText('대기')).not.toBeInTheDocument();
  });

  it('끝을 끝내 알 수 없으면 아무 말도 하지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '재발송' }));
    await waitFor(() => expect(table().getByText('대기')).toBeInTheDocument()); // 접수된 뒤 계속 대기 — 끝나지 않는다

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000);
    });

    expect(toastMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});

describe('전체 재발송', () => {
  const failed = (n: number) =>
    Array.from({ length: n }, (_, i) => row({ id: i + 1, status: 'FAILED', sentAt: null, canResend: true }));

  it('실패만 걸렀을 때만 선다 — 다른 조건에서는 같은 메일이 두 번 갈 수 있다', async () => {
    fakeServer(failed(3));
    renderPage();
    await waitFor(() => expect(table().getAllByText('실패')).toHaveLength(3));
    expect(screen.queryByRole('button', { name: '전체 재발송' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'FAILED' } });

    expect(await screen.findByRole('button', { name: '전체 재발송' })).toBeInTheDocument();
  });

  it('거른 결과가 0건이면 서지 않는다', async () => {
    memoryUrl.set('status=FAILED');
    fakeServer([row()]);
    renderPage();
    await screen.findByText('선택한 조건의 발송 이력이 없습니다.');

    expect(screen.queryByRole('button', { name: '전체 재발송' })).not.toBeInTheDocument();
  });

  it('바로 보내지 않고 건수를 적은 창으로 다시 묻는다 — 취소에 먼저 서고, 취소하면 아무것도 나가지 않는다', async () => {
    memoryUrl.set('status=FAILED');
    fakeServer(failed(45));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '전체 재발송' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('45건')).toBeInTheDocument(); // 보이는 20건이 아니라 조건 전체
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus();

    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(resendCalls()).toHaveLength(0);
  });

  it('확인하면 거른 전체의 ID 를 100건씩 모아 보내고, 끝나면 묶음 결과를 한 번만 알린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    memoryUrl.set('status=FAILED');
    const db = fakeServer(failed(130));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '전체 재발송' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '재발송' }));

    // 130건 → 100 + 30 두 번으로 나뉘어 나간다
    await waitFor(() => expect(resendCalls()).toHaveLength(2));
    const sent = resendCalls().map((c) => (JSON.parse(String(c[1]?.body)) as { ids: number[] }).ids.length);
    expect(sent).toEqual([100, 30]);
    // 목록은 페이지(20건)가 아니라 100건 단위로 읽는다
    expect(listCalls().some((p) => p.includes('limit=100') && p.includes('status=FAILED'))).toBe(true);

    db.forEach((r, i) => {
      r.status = i < 120 ? 'SENT' : 'FAILED'; // 120건 성공, 10건 실패
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_POLL_MS + 10);
    });

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith('120건 재발송에 성공했습니다. 실패: 10건');
  });
});
