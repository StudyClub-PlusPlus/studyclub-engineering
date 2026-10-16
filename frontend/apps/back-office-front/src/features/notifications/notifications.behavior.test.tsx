import type { ReactNode } from 'react';

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
  return { ...actual, toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }) };
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
const toastDismissMock = vi.mocked(toast.dismiss);

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
type ServerOpts = {
  /** true 면 재발송 요청이 모두 닿지 못한다. 함수면 몇 번째 호출(1부터)이 닿지 못하는지 정한다. */
  resendFails?: boolean | ((call: number) => boolean);
  /** true 면 「거른 전체」의 ID 를 모으는 목록 읽기(limit=100)가 실패한다. */
  gatherFails?: boolean;
};

function fakeServer(initial: ApiNotification[], opts: ServerOpts = {}) {
  const db = initial.map((r) => ({ ...r }));
  let resendCall = 0;
  httpMock.mockImplementation(async (path: string, init?: RequestInit) => {
    const url = new URL(path, 'http://x');
    if (url.pathname === '/api/admin/notification-templates') return TEMPLATES;
    if (url.pathname === '/api/admin/notifications/resend') {
      resendCall += 1;
      const fails = typeof opts.resendFails === 'function' ? opts.resendFails(resendCall) : opts.resendFails;
      if (fails) throw new ApiError(500, '서버 오류');
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
      if (opts.gatherFails && url.searchParams.get('limit') === '100') throw new ApiError(500, '서버 오류');
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

/** 가장 최근 오류 토스트를 그려 본다 — 문구와 「다시 시도」가 한 덩어리로 오는지 확인하려는 것. */
function renderRetryToast() {
  const arg = toastErrorMock.mock.calls.at(-1)![0] as unknown;
  const node = typeof arg === 'function' ? (arg as (t: { id: string }) => ReactNode)({ id: 'toast-1' }) : arg;
  return render(<>{node as ReactNode}</>);
}

/** 표 안만 본다 — 상태 필터의 <option>(대기·실패 …)과 뱃지 문구가 겹친다. */
const table = () => within(screen.getByRole('table'));

const listCalls = () =>
  httpMock.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith('/api/admin/notifications?') || p === '/api/admin/notifications');
/** 목록을 새로 읽은 횟수 — 끝 추적(`?ids=`)은 세지 않는다. */
const listReads = () => listCalls().filter((p) => !p.includes('ids='));
const resendCalls = () => httpMock.mock.calls.filter((c) => String(c[0]) === '/api/admin/notifications/resend');

beforeEach(() => {
  httpMock.mockReset();
  toastMock.mockReset();
  toastErrorMock.mockReset();
  toastDismissMock.mockReset();
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

  it('요청이 서버에 닿지 못하면 한 건도 나가지 않은 것이다 — 상태는 실패 그대로, 아이콘을 되살리고 「다시 시도」를 띄운다', async () => {
    const server: ServerOpts = { resendFails: true };
    fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })], server);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '재발송' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: '재발송' })).toBeEnabled());
    expect(table().getByText('실패')).toBeInTheDocument();
    expect(table().queryByText('대기')).not.toBeInTheDocument();

    // 토스트에 문구와 「다시 시도」가 함께 선다
    const view = renderRetryToast();
    expect(within(view.container).getByText('재발송을 요청하지 못했습니다. 다시 시도해 주세요.')).toBeInTheDocument();
    server.resendFails = false;
    fireEvent.click(within(view.container).getByRole('button', { name: '다시 시도' }));

    expect(toastDismissMock).toHaveBeenCalledWith('toast-1');
    await waitFor(() => expect(resendCalls()).toHaveLength(2));
    expect(JSON.parse(String(resendCalls()[1]![1]?.body))).toEqual({ ids: [7] });
    await waitFor(() => expect(table().getByText('대기')).toBeInTheDocument());
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

describe('거르는 조건에서 벗어난 줄은 그 자리에 남는다', () => {
  const failed = (n: number) =>
    Array.from({ length: n }, (_, i) => row({ id: i + 1, status: 'FAILED', sentAt: null, canResend: true }));

  it('「실패」로 거른 목록에서 한 줄을 다시 보내도 줄이 사라지지 않고, 상태만 대기 → 완료로 바뀐다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    memoryUrl.set('status=FAILED');
    const db = fakeServer(failed(2));
    renderPage();
    const [first] = await screen.findAllByRole('button', { name: '재발송' });
    const readsBefore = listReads().length;

    fireEvent.click(first!);

    await waitFor(() => expect(table().getByText('대기')).toBeInTheDocument());
    expect(table().getAllByRole('row')).toHaveLength(1 + 2); // 줄이 그대로다
    expect(listReads()).toHaveLength(readsBefore); // 목록을 다시 읽지 않았다

    db.find((r) => r.id === 1)!.status = 'SENT';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_POLL_MS + 10);
    });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('재발송에 성공했습니다.'));
    expect(table().getByText('완료')).toBeInTheDocument(); // 끝난 모습으로 그 자리에서 바뀐다
    expect(table().getAllByRole('row')).toHaveLength(1 + 2);
    expect(listReads()).toHaveLength(readsBefore);
  });

  it('전체 재발송이 끝나도 줄은 그 자리에 있고, 다음에 조건을 바꿔 읽을 때 빠진다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    memoryUrl.set('status=FAILED');
    const db = fakeServer(failed(3));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '전체 재발송' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '재발송' }));
    await waitFor(() => expect(resendCalls()).toHaveLength(1));

    db.forEach((r) => (r.status = 'SENT'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_POLL_MS + 10);
    });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('3건 재발송에 성공했습니다.'));
    expect(table().getAllByText('완료')).toHaveLength(3);
    expect(table().getAllByRole('row')).toHaveLength(1 + 3);

    // 새로 읽으면(필터를 바꿨다 돌아옴) 서버 기준으로 빠진다
    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'ALL' } });
    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'FAILED' } });
    await waitFor(() => expect(screen.getByText('선택한 조건의 발송 이력이 없습니다.')).toBeInTheDocument());
  });

  it('건너뛴 줄은 서버가 지금 말하는 모습으로 맞춘다 — 다른 캡틴이 먼저 보낸 줄에서 아이콘이 사라진다', async () => {
    const db = fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })]);
    renderPage();
    const icon = await screen.findByRole('button', { name: '재발송' });
    // 화면이 읽은 뒤에 다른 캡틴이 먼저 보냈다
    db[0]!.status = 'PENDING';
    db[0]!.canResend = false;

    fireEvent.click(icon);

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('다시 보낼 수 있는 건이 없어 아무것도 보내지 않았습니다.'));
    expect(table().getByText('대기')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '재발송' })).not.toBeInTheDocument();
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

  it('묶음 중 일부 요청이 닿지 못하면 나가지 못한 줄만 「다시 시도」로 다시 보낸다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    memoryUrl.set('status=FAILED');
    const server: ServerOpts = { resendFails: (call) => call === 2 }; // 두 번째 100건 묶음만 닿지 못한다
    fakeServer(failed(130), server);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '전체 재발송' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '재발송' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    const view = renderRetryToast();
    fireEvent.click(within(view.container).getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(resendCalls()).toHaveLength(3));
    const sizes = resendCalls().map((c) => (JSON.parse(String(c[1]?.body)) as { ids: number[] }).ids.length);
    expect(sizes).toEqual([100, 30, 30]); // 나가지 못한 30건만 다시 — 이미 접수된 100건은 건드리지 않는다
  });

  it('거른 전체의 ID 를 모으지 못하면 한 건도 나가지 않고, 「다시 시도」가 처음부터 다시 모은다', async () => {
    memoryUrl.set('status=FAILED');
    const server: ServerOpts = { gatherFails: true };
    fakeServer(failed(3), server);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '전체 재발송' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '재발송' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(resendCalls()).toHaveLength(0);

    server.gatherFails = false;
    fireEvent.click(within(renderRetryToast().container).getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(resendCalls()).toHaveLength(1));
    expect(JSON.parse(String(resendCalls()[0]![1]?.body)).ids).toEqual([1, 2, 3]);
  });
});
