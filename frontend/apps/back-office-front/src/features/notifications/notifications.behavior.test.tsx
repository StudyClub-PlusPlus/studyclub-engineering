import type { ReactNode } from 'react';

import { toast } from '@studyclub/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NotificationHistoryPage from '@/app/notifications/page';
import { formatStamp } from '@/features/notifications/labels';
import { RESEND_GIVE_UP_MS, RESEND_POLL_MS, RESEND_REQUEST_TIMEOUT_MS } from '@/features/notifications/queries';
import type {
  ApiNotification,
  ApiNotificationPage,
  ApiNotificationResend,
} from '@/features/notifications/types';
import { ApiError, http } from '@/lib/http';
import { handleUnauthorized } from '@/lib/query-client';

// 서버는 http 한 곳으로 막는다 — 경로·요청 모양까지 함께 확인한다.
vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

// 로그인 만료(401)의 공통 처리는 세션을 지우고 화면을 옮기므로 실제로 부르지 않고 호출로만 확인한다.
vi.mock('@/lib/query-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/query-client')>()),
  handleUnauthorized: vi.fn(),
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
const unauthorizedMock = vi.mocked(handleUnauthorized);

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
  /** 실패할 때의 상태 코드(기본 500). 401 이면 로그인 만료다. */
  failStatus?: number;
  /** true 면 끝 추적(`?ids=`) 요청이 실패한다. */
  trackFails?: boolean;
  /** 해당 요청이 응답 없이 걸린다 — 요청의 제한 시간(abort)으로만 끝난다. */
  hang?: { resend?: boolean; track?: boolean };
  /** 「거른 전체」 목록 읽기(limit=100)가 끝날 때마다 불린다(1부터). 읽는 사이 다른 운영자가 재발송하는 상황을 만든다. */
  afterGatherRead?: (readNo: number, db: ApiNotification[]) => void;
};

/** 응답이 오지 않는 요청 — 호출한 쪽이 끊을(abort) 때만 끝난다. */
const hung = (init?: RequestInit) =>
  new Promise<never>((_, reject) =>
    init?.signal?.addEventListener('abort', () => reject(new DOMException('요청 시간 초과', 'AbortError'))),
  );

function fakeServer(initial: ApiNotification[], opts: ServerOpts = {}) {
  const db = initial.map((r) => ({ ...r }));
  let resendCall = 0;
  let gatherRead = 0;
  const failure = () => new ApiError(opts.failStatus ?? 500, '서버 오류');
  const respond = async (path: string, init?: RequestInit): Promise<unknown> => {
    const url = new URL(path, 'http://x');
    if (url.pathname === '/api/admin/notification-templates') return TEMPLATES;
    if (url.pathname === '/api/admin/notifications/resend') {
      resendCall += 1;
      if (opts.hang?.resend) return hung(init);
      const fails = typeof opts.resendFails === 'function' ? opts.resendFails(resendCall) : opts.resendFails;
      if (fails) throw failure();
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
        if (opts.hang?.track) return hung(init);
        if (opts.trackFails) throw failure();
        const items = db.filter((r) => ids.split(',').map(Number).includes(r.id));
        return { items, total: items.length, offset: 0, limit: items.length } satisfies ApiNotificationPage;
      }
      const gather = url.searchParams.get('limit') === '100';
      if (opts.gatherFails && gather) throw failure();
      const status = url.searchParams.get('status');
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const matched = db.filter((r) => !status || r.status === status);
      const page = { items: matched.slice(offset, offset + limit), total: matched.length, offset, limit } satisfies ApiNotificationPage;
      // 이 응답은 이미 나간 것이다 — 먼저 복사해 두고, 그 뒤에 서버 상태를 바꾼다(변화는 다음 읽기부터 보인다)
      const sent = structuredClone(page);
      if (gather) opts.afterGatherRead?.((gatherRead += 1), db);
      return sent;
    }
    throw new Error(`unexpected request: ${path}`);
  };
  // 실제 네트워크처럼 응답을 복사해서 준다 — 같은 객체를 넘기면 서버 쪽 변경이 이미 받은 응답까지 바꿔 버린다
  httpMock.mockImplementation(async (path: string, init?: RequestInit) => structuredClone(await respond(path, init)));
  return db;
}

function renderPage() {
  // 실제 앱(`lib/query-client.ts`)과 같은 신선도 — `staleTime` 이 0 이면 캐시를 다시 쓰는 문제가 테스트에 드러나지 않는다
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 60_000, refetchOnWindowFocus: false } },
  });
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
  unauthorizedMock.mockReset();
  memoryUrl.set('');
  // 끝 추적은 화면을 떠나도 이어진다. 실제 타이머로 걸린 폴링은 테스트가 끝나도 살아남아, 같은 ID 를 쓰는 다음 테스트의
  // 서버를 읽고 토스트·401 처리를 한 번 더 부른다. 가짜 타이머로 걸어야 afterEach 의 useRealTimers 가 함께 버린다.
  vi.useFakeTimers({ shouldAdvanceTime: true });
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
    expect(screen.queryByRole('navigation', { name: '페이지 네비게이션' })).not.toBeInTheDocument();
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

// ───────── 리뷰 반영 (PR #268) ─────────

const failedRows = (n: number) =>
  Array.from({ length: n }, (_, i) => row({ id: i + 1, status: 'FAILED', sentAt: null, canResend: true }));

/** 「실패」로 거른 목록에서 「전체 재발송」을 눌러 확인 창까지 확인한다. */
async function confirmResendAll() {
  fireEvent.click(await screen.findByRole('button', { name: '전체 재발송' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '재발송' }));
}

describe('거른 전체를 모을 때 빠뜨리지 않는다', () => {
  it('읽는 사이 다른 운영자가 앞쪽 100건을 재발송해도 뒤쪽 100건을 건너뛰지 않는다', async () => {
    memoryUrl.set('status=FAILED');
    const server: ServerOpts = {
      // 첫 100건을 읽은 직후 다른 운영자가 그 100건을 재발송했다 → 「실패」 목록에는 나머지 100건만 남는다
      afterGatherRead: (readNo, db) => {
        if (readNo !== 1) return;
        db.slice(0, 100).forEach((r) => {
          r.status = 'PENDING';
          r.canResend = false;
        });
      },
    };
    fakeServer(failedRows(200), server);
    renderPage();
    await confirmResendAll();

    await waitFor(() => expect(resendCalls().length).toBeGreaterThan(0));
    const requested = new Set(resendCalls().flatMap((c) => (JSON.parse(String(c[1]?.body)) as { ids: number[] }).ids));
    // 예전 방식은 offset=100 에서 빈 목록을 받고 끝나 앞의 100건만 모았다
    expect(requested.size).toBe(200);
    expect(requested.has(101) && requested.has(200)).toBe(true);
  });

  it('아무도 건드리지 않았으면 한 번 더 훑어 확인하고 끝낸다 — 무한히 훑지 않는다', async () => {
    memoryUrl.set('status=FAILED');
    fakeServer(failedRows(130));
    renderPage();
    await screen.findByRole('button', { name: '전체 재발송' });
    const readsBefore = listReads().filter((p) => p.includes('limit=100')).length;
    await confirmResendAll();

    await waitFor(() => expect(resendCalls()).toHaveLength(2));
    // 130건 = 2쪽. 첫 훑기(2번) + 새 ID 가 없는지 확인하는 훑기(2번)에서 멈춘다
    expect(listReads().filter((p) => p.includes('limit=100')).length - readsBefore).toBe(4);
  });
});

describe('재발송 뒤 캐시는 오래된 것으로 표시된다 (staleTime 60초)', () => {
  it('완료된 줄이 「실패」 목록에 남지 않는다 — 60초 안에 필터를 바꿨다 돌아와도 서버에서 다시 읽는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    memoryUrl.set('status=FAILED');
    const db = fakeServer(failedRows(2));
    renderPage();
    const [first] = await screen.findAllByRole('button', { name: '재발송' });
    fireEvent.click(first!);
    await waitFor(() => expect(table().getByText('대기')).toBeInTheDocument());
    db.find((r) => r.id === 1)!.status = 'SENT';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_POLL_MS + 10);
    });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('재발송에 성공했습니다.'));
    expect(table().getAllByRole('row')).toHaveLength(1 + 2); // 지금 보는 화면에서는 줄이 그대로다

    // 60초가 지나기 전에 필터를 「전체」 → 「실패」로 바꾼다
    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'ALL' } });
    await waitFor(() => expect(table().getAllByRole('row').length).toBeGreaterThan(1));
    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'FAILED' } });

    // 오래된 캐시를 그대로 쓰면 total 이 2건으로 남는다. 서버를 다시 읽어 실제 실패 1건만 보여야 한다
    await waitFor(() => expect(screen.getByTestId('history-total')).toHaveTextContent('총 1건'));
    expect(table().getAllByRole('row')).toHaveLength(1 + 1);
  });
});

describe('요청에 제한 시간이 있다', () => {
  it('접수 요청이 응답 없이 걸리면 제한 시간 뒤 실패로 보고, 로딩을 풀고 「다시 시도」를 띄운다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })], { hang: { resend: true } });
    renderPage();
    const button = await screen.findByRole('button', { name: '재발송' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled()); // 기다리는 중

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_REQUEST_TIMEOUT_MS + 10);
    });

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: '재발송' })).toBeEnabled());
  });

  it('끝을 쫓는 요청이 걸려도 포기 시점(2분)에 로딩을 풀고 아무 말도 하지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })], { hang: { track: true } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '재발송' }));
    await waitFor(() => expect(table().getByText('대기')).toBeInTheDocument());

    // 예전 방식은 걸린 요청을 끝없이 기다려 마감이 지나도 아이콘이 계속 돌았다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_GIVE_UP_MS + RESEND_REQUEST_TIMEOUT_MS);
    });

    await waitFor(() => expect(screen.queryByRole('button', { name: '재발송' })).not.toBeInTheDocument());
    expect(toastMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('전체 재발송 중 끝을 쫓는 요청이 걸려도 포기 시점에 버튼이 다시 눌린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    memoryUrl.set('status=FAILED');
    fakeServer(failedRows(2), { hang: { track: true } });
    renderPage();
    await confirmResendAll();
    await waitFor(() => expect(screen.getByRole('button', { name: '전체 재발송' })).toHaveAttribute('aria-busy', 'true'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_GIVE_UP_MS + RESEND_REQUEST_TIMEOUT_MS);
    });

    await waitFor(() => expect(screen.getByRole('button', { name: '전체 재발송' })).not.toHaveAttribute('aria-busy'));
  });
});

describe('로그인 만료(401)는 공통 처리로 간다', () => {
  it('접수 요청이 401 이면 공통 처리를 부르고, 같은 401 이 반복될 「다시 시도」는 띄우지 않는다', async () => {
    fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })], {
      resendFails: true,
      failStatus: 401,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '재발송' }));

    await waitFor(() => expect(unauthorizedMock).toHaveBeenCalledTimes(1));
    expect(unauthorizedMock.mock.calls[0]![0]).toMatchObject({ status: 401 });
    expect(toastErrorMock).not.toHaveBeenCalled(); // 「다시 시도」 안내가 없다
    await waitFor(() => expect(screen.getByRole('button', { name: '재발송' })).toBeEnabled());
    expect(resendCalls()).toHaveLength(1);
  });

  it('끝을 쫓다가 401 이 오면 공통 처리를 부르고 더 쫓지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeServer([row({ id: 7, status: 'FAILED', sentAt: null, canResend: true })], { trackFails: true, failStatus: 401 });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '재발송' }));
    await waitFor(() => expect(table().getByText('대기')).toBeInTheDocument());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_POLL_MS + 10);
    });
    await waitFor(() => expect(unauthorizedMock).toHaveBeenCalledTimes(1));
    const tracked = () => listCalls().filter((p) => p.includes('ids=')).length;
    const afterFirst = tracked();

    // 예전 방식은 2분 동안 같은 401 을 무시하며 계속 불렀다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_GIVE_UP_MS);
    });
    expect(tracked()).toBe(afterFirst);
    expect(toastMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('button', { name: '재발송' })).not.toBeInTheDocument());
  });

  it('전체 재발송의 ID 를 모으다 401 이 오면 공통 처리를 부르고 「다시 시도」는 띄우지 않는다', async () => {
    memoryUrl.set('status=FAILED');
    fakeServer(failedRows(3), { gatherFails: true, failStatus: 401 });
    renderPage();
    await confirmResendAll();

    await waitFor(() => expect(unauthorizedMock).toHaveBeenCalled());
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(resendCalls()).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: '전체 재발송' })).not.toHaveAttribute('aria-busy'));
  });
});

describe('시각은 줄마다 약칭 없이 시각만, 기준은 표 위에 한 번', () => {
  it('각 줄은 24시간제 시각만 적고 시간대 약칭을 붙이지 않는다', async () => {
    fakeServer([row({ id: 1, createdAt: '2026-10-15T09:00:00Z', sentAt: '2026-10-15T09:00:05Z' })]);
    renderPage();
    await screen.findByText('h***@example.com');

    const cells = within(table().getAllByRole('row')[1]!).getAllByRole('cell');
    expect(cells[0]!.textContent).toMatch(/^\d{2}\. \d{2}\. \d{2}\. \d{2}:\d{2}$/);
    expect(cells[5]!.textContent).toMatch(/^\d{2}\. \d{2}\. \d{2}\. \d{2}:\d{2}$/);
    expect(screen.getByRole('table').textContent).not.toMatch(/GMT|KST|UTC|PST|PDT/);
  });

  it('기준 시간대는 표 위에 딱 한 번만 밝힌다', async () => {
    fakeServer([row({ id: 1 }), row({ id: 2 }), row({ id: 3 })]);
    renderPage();
    await screen.findAllByText('h***@example.com');

    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await waitFor(() => expect(screen.getByTestId('timezone-note')).toHaveTextContent(zone));
    expect(screen.getAllByText(/내 시간대 기준/)).toHaveLength(1);
  });

  it('읽을 수 없는 값은 원문 그대로 둔다', () => {
    expect(formatStamp('not-a-date')).toBe('not-a-date');
    expect(formatStamp('2026-10-15T09:00:00Z')).toMatch(/^\d{2}\. \d{2}\. \d{2}\. \d{2}:\d{2}$/);
  });
});
