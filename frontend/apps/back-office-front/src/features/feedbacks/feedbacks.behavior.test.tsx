import type { ReactNode } from 'react';

import { toast } from '@studyclub/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FeedbackDetailPage from '@/app/feedbacks/[id]/page';
import FeedbacksPage from '@/app/feedbacks/page';
import type { ApiAdminFeedback, ApiAdminFeedbackDetail, ApiAdminFeedbackPage } from '@/features/feedbacks/types';
import { ApiError, http } from '@/lib/http';

// 서버는 http 한 곳으로 막는다 — 경로·요청 모양까지 함께 확인한다.
vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

// 토스트는 DOM 이 아니라 호출로 확인한다 (Toaster 를 마운트하지 않는다).
vi.mock('@studyclub/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@studyclub/ui')>();
  return { ...actual, toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) };
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

const nav = vi.hoisted(() => ({ push: vi.fn(), params: { id: '241' } }));

vi.mock('next/navigation', async () => {
  const { useMemo, useSyncExternalStore } = await import('react');
  const router = {
    replace: (url: string) => memoryUrl.set(url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''),
    push: nav.push,
  };
  return {
    useSearchParams: () => {
      const search = useSyncExternalStore(memoryUrl.subscribe, memoryUrl.get);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    useRouter: () => router,
    usePathname: () => '/feedbacks',
    useParams: () => nav.params,
  };
});

const httpMock = vi.mocked(http);
const toastSuccessMock = vi.mocked(toast.success);
const toastErrorMock = vi.mocked(toast.error);

function item(patch: Partial<ApiAdminFeedback> = {}): ApiAdminFeedback {
  return {
    id: 241,
    createdAt: '2026-10-25T08:12:40Z',
    type: 'BUG',
    title: '모바일에서 출석 체크 버튼이 안 눌려요',
    submitter: { nickname: '도윤' },
    status: 'NEW',
    doneBy: null,
    ...patch,
  };
}

function detail(patch: Partial<ApiAdminFeedbackDetail> = {}): ApiAdminFeedbackDetail {
  return {
    ...item(),
    selectableStatuses: ['NEW', 'SEEN'],
    content: '아이폰 사파리에서 오늘 출석 버튼을 눌러도 반응이 없습니다.\n데스크톱에서는 됩니다.',
    images: [],
    browser: 'Safari 26 · iOS',
    viewport: { width: 390, height: 844 },
    reply: null,
    adminMemo: null,
    ...patch,
  };
}

function page(items: ApiAdminFeedback[], total = items.length, offset = 0): ApiAdminFeedbackPage {
  return { items, total, offset, limit: 20 };
}

function renderWith(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const listCalls = () =>
  httpMock.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith('/api/admin/feedbacks?'));
const patchCalls = () => httpMock.mock.calls.filter((c) => c[2]?.method === 'PATCH');
const detailReads = () =>
  httpMock.mock.calls.filter((c) => String(c[0]) === '/api/admin/feedbacks/241' && c[2]?.method !== 'PATCH');

/** 표 안만 본다 — 필터의 <option>(미확인·완료 …)과 뱃지 문구가 겹친다. */
const table = () => within(screen.getByRole('table'));

beforeEach(() => {
  memoryUrl.set('');
  httpMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  nav.push.mockReset();
  nav.params = { id: '241' };
});

describe('운영 목록', () => {
  it('유형·상태는 문구로, 탈퇴한 제출자·완료 처리자는 「탈퇴한 사용자」, 완료가 아니면 「-」로 적는다', async () => {
    httpMock.mockResolvedValue(
      page(
        [
          item({ id: 3, status: 'NEW', doneBy: null }),
          item({
            id: 2,
            type: 'QUESTION',
            title: '클럽이랑 스터디는 뭐가 다른가요',
            submitter: { nickname: null },
            status: 'DONE',
            doneBy: { nickname: '세린' },
          }),
          item({ id: 1, type: 'IDEA', title: '다크 모드', status: 'DONE', doneBy: { nickname: null } }),
        ],
        24,
      ),
    );
    renderWith(<FeedbacksPage />);

    expect(await screen.findByText('클럽이랑 스터디는 뭐가 다른가요')).toBeInTheDocument();
    const rows = table().getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);

    // 1줄: 미확인, 완료 처리자 없음
    expect(within(rows[0]!).getByText('오류 신고')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('도윤')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('미확인')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('-')).toBeInTheDocument();
    // 2줄: 제출자 탈퇴, 완료 처리자 있음
    expect(within(rows[1]!).getByText('문의')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('탈퇴한 사용자')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('완료')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('세린')).toBeInTheDocument();
    // 3줄: 완료 처리자가 탈퇴
    expect(within(rows[2]!).getByText('개선 의견')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('탈퇴한 사용자')).toBeInTheDocument();
    expect(within(rows[2]!).queryByText('-')).not.toBeInTheDocument();

    // 제목은 한 줄로 자르고, 가리키면 전체 제목이 뜬다
    expect(within(rows[1]!).getByText('클럽이랑 스터디는 뭐가 다른가요')).toHaveAttribute(
      'title',
      '클럽이랑 스터디는 뭐가 다른가요',
    );
    // 총 건수는 걸러진 뒤 전체 — 보이는 줄 수가 아니다
    expect(screen.getByTestId('feedback-total')).toHaveTextContent('총 24건');
    // 24건 = 2쪽 — 페이지 번호가 선다
    expect(screen.getByRole('navigation', { name: '페이지 네비게이션' })).toBeInTheDocument();
  });

  it('처음에는 유형·상태·검색을 서버에 보내지 않고 20건씩 읽는다. 한 페이지면 번호를 그리지 않는다', async () => {
    httpMock.mockResolvedValue(page([item()]));
    renderWith(<FeedbacksPage />);
    await screen.findByText('모바일에서 출석 체크 버튼이 안 눌려요');

    const path = listCalls()[0]!;
    expect(path).toBe('/api/admin/feedbacks?offset=0&limit=20');
    expect(screen.queryByRole('navigation', { name: '페이지 네비게이션' })).not.toBeInTheDocument();
  });

  it('불러오는 동안 20줄 자리표시를 그린다', async () => {
    httpMock.mockReturnValue(new Promise(() => {}));
    renderWith(<FeedbacksPage />);

    expect(await screen.findAllByTestId('feedback-skeleton-row')).toHaveLength(20);
  });

  it('줄을 누르면 상세로 간다', async () => {
    httpMock.mockResolvedValue(page([item({ id: 77 })]));
    renderWith(<FeedbacksPage />);

    fireEvent.click(await screen.findByText('모바일에서 출석 체크 버튼이 안 눌려요'));

    expect(nav.push).toHaveBeenCalledWith('/feedbacks/77');
  });

  it('유형을 고르면 첫 줄이 「전체」로 바뀌고 1페이지로 돌아간다', async () => {
    memoryUrl.set('page=3');
    httpMock.mockResolvedValue(page([item()], 70, 40));
    renderWith(<FeedbacksPage />);
    await screen.findByText('모바일에서 출석 체크 버튼이 안 눌려요');
    expect(listCalls()[0]).toContain('offset=40');

    const type = screen.getByRole('combobox', { name: '유형' });
    expect(within(type).getAllByRole('option')[0]).toHaveTextContent('유형');
    fireEvent.change(type, { target: { value: 'BUG' } });

    await waitFor(() => expect(memoryUrl.get()).toBe('type=BUG'));
    expect(within(screen.getByRole('combobox', { name: '유형' })).getAllByRole('option')[0]).toHaveTextContent('전체');
    await waitFor(() => expect(listCalls().some((p) => p.includes('type=BUG') && p.includes('offset=0'))).toBe(true));
  });

  it('상태를 고르면 1페이지로 돌아간다', async () => {
    memoryUrl.set('page=2');
    httpMock.mockResolvedValue(page([item()], 30, 20));
    renderWith(<FeedbacksPage />);
    await screen.findByText('모바일에서 출석 체크 버튼이 안 눌려요');

    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'DONE' } });

    await waitFor(() => expect(memoryUrl.get()).toBe('status=DONE'));
  });

  it('검색은 입력을 멈추고 400ms 뒤에 걸고, 1페이지로 돌아간다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      memoryUrl.set('page=2');
      httpMock.mockResolvedValue(page([item()], 30, 20));
      renderWith(<FeedbacksPage />);
      await screen.findByText('모바일에서 출석 체크 버튼이 안 눌려요');

      fireEvent.change(screen.getByRole('searchbox', { name: '제목·내용 검색' }), { target: { value: ' 출석 ' } });
      await vi.advanceTimersByTimeAsync(300);
      expect(memoryUrl.get()).toBe('page=2'); // 아직 걸지 않았다

      await vi.advanceTimersByTimeAsync(150);
      await waitFor(() => expect(memoryUrl.get()).toBe('q=%EC%B6%9C%EC%84%9D'));
      await waitFor(() =>
        expect(listCalls().some((p) => p.includes('q=%EC%B6%9C%EC%84%9D') && p.includes('offset=0'))).toBe(true),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('한 건도 없으면 「접수된 … 없습니다」, 전체 보기는 없다', async () => {
    httpMock.mockResolvedValue(page([]));
    renderWith(<FeedbacksPage />);

    expect(await screen.findByText('접수된 문의·오류 신고가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '전체 보기' })).not.toBeInTheDocument();
    expect(screen.getByTestId('feedback-total')).toHaveTextContent('총 0건');
  });

  it('거른 결과가 없으면 안내와 전체 보기가 서고, 누르면 조건이 모두 풀린다', async () => {
    memoryUrl.set('type=IDEA&status=NEW&q=abc');
    httpMock.mockResolvedValue(page([]));
    renderWith(<FeedbacksPage />);

    expect(await screen.findByText('조건에 맞는 문의·오류 신고가 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '제목·내용 검색' })).toHaveValue('abc');
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));

    await waitFor(() => expect(memoryUrl.get()).toBe(''));
    expect(screen.getByRole('searchbox', { name: '제목·내용 검색' })).toHaveValue('');
  });

  it('읽기 실패는 「0건」이 아니다 — 안내와 다시 시도가 서고 건수는 숨긴다', async () => {
    httpMock.mockRejectedValue(new ApiError(500, '서버 오류'));
    renderWith(<FeedbacksPage />);

    expect(await screen.findByText('불러오지 못했습니다. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('접수된 문의·오류 신고가 없습니다.')).not.toBeInTheDocument();
    expect(screen.getByTestId('feedback-total')).toBeEmptyDOMElement();

    httpMock.mockResolvedValue(page([item()]));
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('모바일에서 출석 체크 버튼이 안 눌려요')).toBeInTheDocument();
  });

  it('URL 의 모르는 유형·상태값은 전체로 본다', async () => {
    memoryUrl.set('type=NOPE&status=LOST');
    httpMock.mockResolvedValue(page([item()]));
    renderWith(<FeedbacksPage />);
    await screen.findByText('모바일에서 출석 체크 버튼이 안 눌려요');

    expect(listCalls()[0]).toBe('/api/admin/feedbacks?offset=0&limit=20');
  });
});

/** 상세 서버 흉내 — GET 은 `current`, PATCH 는 `onPatch` 가 정한다. */
function detailServer(
  initial: ApiAdminFeedbackDetail,
  onPatch: (body: Record<string, unknown>) => Promise<ApiAdminFeedbackDetail>,
) {
  const state = { current: initial };
  httpMock.mockImplementation(async (path: string, _schema: unknown, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const next = await onPatch(JSON.parse(String(init.body)) as Record<string, unknown>);
      state.current = next;
      return structuredClone(next);
    }
    if (path === '/api/admin/feedbacks/241') return structuredClone(state.current);
    throw new Error(`unexpected request: ${path}`);
  });
  return state;
}

describe('운영 상세', () => {
  it('내용은 평문으로 줄바꿈을 살려 적고, 제출 환경과 첨부를 보인다', async () => {
    detailServer(
      detail({
        title: '<b>마감</b> 이라고 글자가 그대로 보여요',
        content: '스터디 카드에 <b>마감</b> 처럼\n태그가 그대로 나옵니다.',
        images: [{ url: 'https://cdn.example/a.webp' }, { url: 'https://cdn.example/b.webp' }],
      }),
      async () => detail(),
    );
    renderWith(<FeedbackDetailPage />);

    const content = await screen.findByTestId('feedback-content');
    expect(content.textContent).toBe('스터디 카드에 <b>마감</b> 처럼\n태그가 그대로 나옵니다.');
    expect(content.querySelector('b')).toBeNull(); // HTML 로 해석하지 않는다
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('<b>마감</b> 이라고 글자가 그대로 보여요');
    expect(screen.getByText('도윤', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Safari 26 · iOS')).toBeInTheDocument();
    expect(screen.getByText('390 × 844')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '첨부 이미지 2 크게 보기' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img', { name: '첨부 이미지 2' })).toHaveAttribute(
      'src',
      'https://cdn.example/b.webp',
    );
  });

  it('첨부가 없으면 칸을 두지 않고, 모르는 브라우저·화면 크기는 「-」, 탈퇴한 제출자는 「탈퇴한 사용자」', async () => {
    detailServer(detail({ browser: null, viewport: null, submitter: { nickname: null } }), async () => detail());
    renderWith(<FeedbackDetailPage />);
    await screen.findByTestId('feedback-content');

    expect(screen.queryByRole('button', { name: /크게 보기/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('-')).toHaveLength(2);
    expect(screen.getByText('탈퇴한 사용자', { exact: false })).toBeInTheDocument();
  });

  it('없는 건(404)이면 「삭제되었거나 없는 …」', async () => {
    httpMock.mockRejectedValue(new ApiError(404, '찾을 수 없습니다'));
    renderWith(<FeedbackDetailPage />);

    expect(await screen.findByText('삭제되었거나 없는 문의·오류 신고입니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /목록으로/ })).toHaveAttribute('href', '/feedbacks');
  });

  it('숫자가 아닌 번호는 서버에 묻지 않고 없는 건으로 본다', async () => {
    nav.params = { id: 'abc' };
    renderWith(<FeedbackDetailPage />);

    expect(await screen.findByText('삭제되었거나 없는 문의·오류 신고입니다.')).toBeInTheDocument();
    expect(httpMock).not.toHaveBeenCalled();
  });
});

describe('상태 — selectableStatuses 대로 그린다', () => {
  it('회신 전: 미확인·확인은 고를 수 있고, 완료는 막히며 이유를 적는다', async () => {
    detailServer(detail({ status: 'NEW', selectableStatuses: ['NEW', 'SEEN'] }), async () => detail());
    renderWith(<FeedbackDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: '상태 미확인, 바꾸기' }));
    const listbox = screen.getByRole('listbox', { name: '상태' });
    expect(within(listbox).getByRole('option', { name: /미확인/ })).toBeEnabled();
    expect(within(listbox).getByRole('option', { name: /확인/, selected: false })).toBeEnabled();
    const done = within(listbox).getByRole('option', { name: /완료/ });
    expect(done).toBeDisabled();
    expect(done).toHaveTextContent('답변을 작성한 후 완료할 수 있어요.');
  });

  it('서버가 고를 수 있다고 한 것만 연다 — 화면이 회신 유무로 다시 판정하지 않는다', async () => {
    // 가상의 응답: 회신이 없어도 서버가 확인만 허락했다면 미확인은 막힌다
    detailServer(detail({ status: 'SEEN', selectableStatuses: ['SEEN'] }), async () => detail());
    renderWith(<FeedbackDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: '상태 확인, 바꾸기' }));
    expect(screen.getByRole('option', { name: /미확인/ })).toBeDisabled();
  });

  it('회신 뒤(selectableStatuses = []): 드롭다운이 잠긴다', async () => {
    detailServer(
      detail({
        status: 'DONE',
        selectableStatuses: [],
        doneBy: { nickname: '세린' },
        reply: { content: '디스코드 채널에 남겨 주세요. 연락드릴게요.', repliedAt: '2026-10-25T09:00:00Z' },
      }),
      async () => detail(),
    );
    renderWith(<FeedbackDetailPage />);

    const locked = await screen.findByTestId('status-locked');
    expect(locked).toHaveTextContent('완료');
    expect(locked).toHaveAttribute('title', '답변한 문의는 상태를 바꿀 수 없어요.');
    expect(screen.queryByRole('button', { name: /바꾸기/ })).not.toBeInTheDocument();
  });

  it('고르면 바로 저장하고, 응답으로 뱃지를 바꾼다 — 다시 읽지 않는다', async () => {
    detailServer(detail(), async () => detail({ status: 'SEEN' }));
    renderWith(<FeedbackDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: '상태 미확인, 바꾸기' }));
    fireEvent.click(screen.getByRole('option', { name: /^확인/ }));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('상태를 변경했습니다.'));
    expect(JSON.parse(String(patchCalls()[0]![2]?.body))).toEqual({ status: 'SEEN' });
    expect(screen.getByRole('button', { name: '상태 확인, 바꾸기' })).toBeInTheDocument();
    expect(detailReads()).toHaveLength(1);
  });

  it('실패하면 이전 값으로 돌아가고 안내한다', async () => {
    detailServer(detail(), async () => {
      throw new ApiError(500, '서버 오류');
    });
    renderWith(<FeedbackDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: '상태 미확인, 바꾸기' }));
    fireEvent.click(screen.getByRole('option', { name: /^확인/ }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('상태를 변경하지 못했습니다. 다시 시도해 주세요.'));
    expect(await screen.findByRole('button', { name: '상태 미확인, 바꾸기' })).toBeEnabled();
  });

  it('409(다른 캡틴이 먼저 회신)면 상세를 다시 읽어 잠긴 모습으로 맞춘다', async () => {
    const server = detailServer(detail(), async () => {
      server.current = detail({
        status: 'DONE',
        selectableStatuses: [],
        doneBy: { nickname: '세린' },
        reply: { content: '먼저 답변했습니다. 확인해 주세요.', repliedAt: '2026-10-25T09:00:00Z' },
      });
      throw new ApiError(409, '답변한 문의는 상태를 바꿀 수 없어요.');
    });
    renderWith(<FeedbackDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: '상태 미확인, 바꾸기' }));
    fireEvent.click(screen.getByRole('option', { name: /^확인/ }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('답변한 문의는 상태를 바꿀 수 없어요.'));
    expect(await screen.findByTestId('status-locked')).toHaveTextContent('완료');
    expect(detailReads()).toHaveLength(2);
    expect(screen.getByTestId('feedback-reply')).toHaveTextContent('먼저 답변했습니다. 확인해 주세요.');
  });
});

describe('회신', () => {
  const REPLY = '디스코드 #캡틴-지원 채널에 하고 싶은 스터디 주제를 남겨 주세요.';

  it('10자 미만이면 전송할 수 없다', async () => {
    detailServer(detail(), async () => detail());
    renderWith(<FeedbackDetailPage />);

    fireEvent.change(await screen.findByLabelText('회신'), { target: { value: '   짧은 답변   ' } });
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('전송하면 저장되고, 응답대로 상태가 완료로 바뀌어 잠기며 읽기 전용과 「수정」이 선다', async () => {
    detailServer(detail(), async (body) =>
      detail({
        status: 'DONE',
        selectableStatuses: [],
        doneBy: { nickname: '세린' },
        reply: { content: String(body.reply), repliedAt: '2026-10-25T09:00:00Z' },
      }),
    );
    renderWith(<FeedbackDetailPage />);

    fireEvent.change(await screen.findByLabelText('회신'), { target: { value: `  ${REPLY}  ` } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('회신을 보냈습니다.'));
    expect(JSON.parse(String(patchCalls()[0]![2]?.body))).toEqual({ reply: REPLY });
    expect(screen.getByTestId('feedback-reply')).toHaveTextContent(REPLY);
    expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(screen.getByTestId('status-locked')).toHaveTextContent('완료');
    expect(detailReads()).toHaveLength(1); // 응답으로 그렸다
  });

  it('실패하면 입력을 남기고 안내한다', async () => {
    detailServer(detail(), async () => {
      throw new ApiError(500, '서버 오류');
    });
    renderWith(<FeedbackDetailPage />);

    fireEvent.change(await screen.findByLabelText('회신'), { target: { value: REPLY } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('회신을 보내지 못했습니다. 다시 시도해 주세요.'));
    expect(screen.getByLabelText('회신')).toHaveValue(REPLY);
    expect(screen.getByRole('button', { name: '전송' })).toBeEnabled();
  });

  it('「수정」으로 고치면 회신 내용만 바뀐다 — 보낸 시각은 서버가 그대로 둔다', async () => {
    const replied = detail({
      status: 'DONE',
      selectableStatuses: [],
      doneBy: { nickname: '세린' },
      reply: { content: REPLY, repliedAt: '2026-10-25T09:00:00Z' },
    });
    detailServer(replied, async (body) => ({
      ...replied,
      reply: { content: String(body.reply), repliedAt: '2026-10-25T09:00:00Z' },
    }));
    renderWith(<FeedbackDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: '수정' }));
    const input = screen.getByLabelText('회신');
    expect(input).toHaveValue(REPLY);
    fireEvent.change(input, { target: { value: `${REPLY} 곧 연락드릴게요.` } });
    fireEvent.click(within(input.closest('section')!).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('회신을 고쳤습니다.'));
    expect(JSON.parse(String(patchCalls()[0]![2]?.body))).toEqual({ reply: `${REPLY} 곧 연락드릴게요.` });
    expect(screen.getByTestId('feedback-reply')).toHaveTextContent(`${REPLY} 곧 연락드릴게요.`);
  });
});

describe('캡틴 전용 메모', () => {
  it('저장을 눌러야 저장되고, 비우면 빈 문자열을 보내 지운다', async () => {
    detailServer(detail({ adminMemo: '이스케이프 누락 의심' }), async (body) =>
      detail({ adminMemo: body.adminMemo === '' ? null : String(body.adminMemo) }),
    );
    renderWith(<FeedbackDetailPage />);

    const memo = await screen.findByLabelText('캡틴 전용 메모');
    expect(memo).toHaveAttribute('placeholder', '내부용: 제출자에게 보이지 않습니다');
    const save = () => within(memo.closest('section')!).getByRole('button', { name: '저장' });
    expect(save()).toBeDisabled(); // 바뀐 것이 없다

    fireEvent.change(memo, { target: { value: '' } });
    fireEvent.click(save());

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('저장했습니다.'));
    expect(JSON.parse(String(patchCalls()[0]![2]?.body))).toEqual({ adminMemo: '' });
    expect(save()).toBeDisabled();
  });

  it('실패하면 안내하고 입력은 그대로다', async () => {
    detailServer(detail(), async () => {
      throw new ApiError(500, '서버 오류');
    });
    renderWith(<FeedbackDetailPage />);

    const memo = await screen.findByLabelText('캡틴 전용 메모');
    fireEvent.change(memo, { target: { value: '재현 확인 필요' } });
    fireEvent.click(within(memo.closest('section')!).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('저장하지 못했습니다. 다시 시도해 주세요.'));
    expect(memo).toHaveValue('재현 확인 필요');
  });
});
