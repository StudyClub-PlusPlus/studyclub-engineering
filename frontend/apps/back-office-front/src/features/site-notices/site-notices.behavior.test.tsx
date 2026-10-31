import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NoticesAdmin from '@/app/notices/page';
import type { ApiSiteNotice, ApiSiteNoticeDetail, ApiSiteNoticePage } from '@/features/site-notices/types';
import { http } from '@/lib/http';

// 서버는 http 한 곳으로 막는다 — 경로·요청 모양까지 함께 확인한다.
vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

// 화면이 검색·정렬·페이지를 URL 로 든다(useUrlState). 테스트에는 Next 라우터가 없어 메모리 URL 로 대신한다
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
    replace: (url: string) => {
      let search = '';
      if (url.includes('?')) search = url.slice(url.indexOf('?') + 1);
      memoryUrl.set(search);
    },
  };
  return {
    useSearchParams: () => {
      const search = useSyncExternalStore(memoryUrl.subscribe, memoryUrl.get);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    useRouter: () => router,
    usePathname: () => '/notices',
  };
});

const httpMock = vi.mocked(http);

function notice(patch: Partial<ApiSiteNotice> = {}): ApiSiteNotice {
  return {
    noticeId: 12,
    title: '11월 스터디 모집 일정 안내',
    author: 'honggildong',
    publishedAt: '2026-10-20T09:00:00Z',
    updatedAt: '2026-10-21T01:12:40Z',
    ...patch,
  };
}

function pageOf(items: ApiSiteNotice[], total = items.length, offset = 0): ApiSiteNoticePage {
  return { items, total, offset, limit: 20 };
}

/** `staleTime` 을 넘기면 앱 기본 캐시(1분)처럼 받은 값을 한동안 다시 묻지 않는 상태로 그린다. */
function renderPage(staleTime = 0) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<NoticesAdmin />, { wrapper });
}

const listCalls = () => httpMock.mock.calls.filter(([path]) => String(path).startsWith('/api/admin/notices?'));
const paramsOf = (path: unknown) => new URL(String(path), 'http://x').searchParams;

/** 목록 요청에는 목록, 한 건 요청에는 한 건을 돌려준다. */
function serveList(page: ApiSiteNoticePage, detail?: ApiSiteNoticeDetail) {
  httpMock.mockImplementation(async (path) => {
    const p = String(path);
    if (p.startsWith('/api/admin/notices?')) return page;
    if (detail && p === `/api/admin/notices/${detail.noticeId}`) return detail;
    return null;
  });
}

beforeEach(() => {
  memoryUrl.set('');
  httpMock.mockReset();
});

describe('공지 관리 목록', () => {
  it('처음에는 기본 정렬(publishedAt desc)이라 sort·order 를 보내지 않고, 작성자·게시일을 보인다', async () => {
    serveList(pageOf([notice(), notice({ noticeId: 11, title: '디스코드 서버 점검 안내', author: '탈퇴한 회원' })], 2));
    renderPage();

    await screen.findByText('11월 스터디 모집 일정 안내');
    expect(screen.getByText('honggildong')).toBeTruthy();
    expect(screen.getByText('탈퇴한 회원')).toBeTruthy();
    expect(screen.getByText('총 2개')).toBeTruthy();

    const params = paramsOf(listCalls()[0][0]);
    expect(params.get('sort')).toBeNull();
    expect(params.get('order')).toBeNull();
    expect(params.get('offset')).toBe('0');
    expect(params.get('limit')).toBe('20');
  });

  it('열 이름을 누르면 그 열 오름차순으로, 다시 누르면 내림차순으로 서버에 묻는다', async () => {
    serveList(pageOf([notice()]));
    renderPage();
    await screen.findByText('11월 스터디 모집 일정 안내');

    fireEvent.click(screen.getByRole('button', { name: '제목 오름차순으로 정렬' }));
    await waitFor(() => expect(memoryUrl.get()).toContain('sort=title'));
    await waitFor(() => {
      const last = paramsOf(listCalls().at(-1)![0]);
      expect(last.get('sort')).toBe('title');
      expect(last.get('order')).toBe('asc');
    });

    fireEvent.click(screen.getByRole('button', { name: '제목 내림차순으로 정렬' }));
    await waitFor(() => {
      const last = paramsOf(listCalls().at(-1)![0]);
      expect(last.get('sort')).toBe('title');
      // 기본 방향(desc)은 URL 에 싣지 않으므로 요청에도 없다
      expect(last.get('order')).toBeNull();
    });
  });

  it('검색어는 멈춘 뒤 q 로 보내고 첫 페이지로 돌아간다', async () => {
    memoryUrl.set('page=3');
    serveList(pageOf([notice()], 50, 40));
    renderPage();
    await screen.findByText('11월 스터디 모집 일정 안내');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('제목 검색'), ' 모집 ');
    await waitFor(() => {
      const last = paramsOf(listCalls().at(-1)![0]);
      expect(last.get('q')).toBe('모집');
      expect(last.get('offset')).toBe('0');
    });
  });
});

describe('공지 등록·편집 팝업', () => {
  it('제목을 누르면 한 건을 받아 칸을 채우고, 저장하면 PATCH 로 제목·본문을 둘 다 보낸다', async () => {
    const detail: ApiSiteNoticeDetail = { ...notice(), body: '본문 첫 줄\n둘째 줄' };
    serveList(pageOf([notice()]), detail);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '11월 스터디 모집 일정 안내' }));
    // 한 건을 받는 동안의 팝업과 받은 뒤의 편집 팝업은 다른 요소다. 폼이 보인 뒤에 팝업을 잡는다
    const bodyBox = (await screen.findByLabelText(/본문/)) as HTMLTextAreaElement;
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(bodyBox.value).toBe('본문 첫 줄\n둘째 줄'));
    expect(httpMock).toHaveBeenCalledWith('/api/admin/notices/12');

    const user = userEvent.setup();
    const titleBox = within(dialog).getByLabelText(/제목/);
    await user.clear(titleBox);
    await user.type(titleBox, '고친 제목');
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    await within(dialog).findByText('저장되었습니다. 사이트 공지에 바로 반영됩니다.');
    const patch = httpMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patch?.[0]).toBe('/api/admin/notices/12');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ title: '고친 제목', body: '본문 첫 줄\n둘째 줄' });
  });

  it('빈 칸은 서버에 보내기 전에 막고, 채우면 POST 로 등록한다', async () => {
    serveList(pageOf([]));
    renderPage();
    await screen.findByText('등록된 공지가 없습니다.');

    fireEvent.click(screen.getByRole('button', { name: '공지 등록' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '등록' }));
    expect(await within(dialog).findByText('제목을 입력하세요.')).toBeTruthy();
    expect(within(dialog).getByText('본문을 입력하세요.')).toBeTruthy();
    expect(httpMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    const user = userEvent.setup();
    await user.type(within(dialog).getByLabelText(/제목/), '새 공지');
    await user.type(within(dialog).getByLabelText(/본문/), '내용');
    fireEvent.click(within(dialog).getByRole('button', { name: '등록' }));

    await within(dialog).findByText('등록되었습니다. 사이트 공지에 바로 올라갑니다.');
    const post = httpMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/api/admin/notices');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ title: '새 공지', body: '내용' });
  });

  it('편집 팝업의 「공지 삭제」는 확인 단계를 거쳐 DELETE 를 보낸다', async () => {
    const detail: ApiSiteNoticeDetail = { ...notice(), body: '본문' };
    serveList(pageOf([notice()]), detail);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '11월 스터디 모집 일정 안내' }));
    await screen.findByLabelText(/본문/);
    const dialog = screen.getByRole('dialog');
    // 고치다 만 제목이 아니라 저장된 제목을 묻는다 — 지워지는 건 저장된 공지다
    fireEvent.change(within(dialog).getByLabelText(/제목/), { target: { value: '고치던 제목' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '공지 삭제' }));

    await within(dialog).findByText('‘11월 스터디 모집 일정 안내’ 공지를 삭제합니다.');
    expect(httpMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));

    await within(dialog).findByText('삭제되었습니다. 사이트 공지에서 내려갔습니다.');
    const del = httpMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(del?.[0]).toBe('/api/admin/notices/12');
  });

  it('서버가 「title: 사유」로 거절하면 그 칸의 오류로 보이고 입력값은 그대로 남는다', async () => {
    const detail: ApiSiteNoticeDetail = { ...notice(), body: '본문' };
    httpMock.mockImplementation(async (path, init) => {
      if (init?.method === 'PATCH') throw new Error('title: 제목은 200자까지입니다.');
      const p = String(path);
      if (p.startsWith('/api/admin/notices?')) return pageOf([notice()]);
      if (p === '/api/admin/notices/12') return detail;
      return null;
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '11월 스터디 모집 일정 안내' }));
    await screen.findByLabelText(/본문/);
    const dialog = screen.getByRole('dialog');
    const titleBox = within(dialog).getByLabelText(/제목/) as HTMLInputElement;
    await waitFor(() => expect(titleBox.value).toBe('11월 스터디 모집 일정 안내'));
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(await within(dialog).findByText('제목은 200자까지입니다.')).toBeTruthy();
    expect(titleBox.value).toBe('11월 스터디 모집 일정 안내');
    // 칸 오류로 붙였으니 위쪽 공통 알림은 띄우지 않는다
    expect(within(dialog).queryByText(/title:/)).toBeNull();
  });

  it('마지막 페이지의 유일한 공지를 삭제하면 앞 페이지로 가고, 지워진 공지를 다시 묻지 않는다', async () => {
    memoryUrl.set('page=2');
    const last = notice({ noticeId: 21, title: '마지막 공지' });
    const detail: ApiSiteNoticeDetail = { ...last, body: '본문' };
    let deleted = false;
    httpMock.mockImplementation(async (path, init) => {
      const p = String(path);
      if (init?.method === 'DELETE') {
        deleted = true;
        return null;
      }
      if (p.startsWith('/api/admin/notices?')) {
        if (paramsOf(p).get('offset') === '0') return pageOf([notice()], 20, 0);
        if (deleted) return pageOf([], 20, 20);
        return pageOf([last], 21, 20);
      }
      if (p === '/api/admin/notices/21') return detail;
      return null;
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '마지막 공지' }));
    await screen.findByLabelText(/본문/);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '공지 삭제' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: '삭제' }));
    await within(dialog).findByText('삭제되었습니다. 사이트 공지에서 내려갔습니다.');

    await waitFor(() => expect(memoryUrl.get()).not.toContain('page=2'));
    await waitFor(() => expect(paramsOf(listCalls().at(-1)![0]).get('offset')).toBe('0'));
    const detailGets = httpMock.mock.calls.filter(
      ([path, init]) => String(path) === '/api/admin/notices/21' && !init?.method,
    );
    expect(detailGets).toHaveLength(1);
  });

  it('편집 팝업을 닫았다가 1분 안에 다시 열어도 한 건을 새로 받아 폼을 보인다', async () => {
    const detail: ApiSiteNoticeDetail = { ...notice(), body: '본문' };
    serveList(pageOf([notice()]), detail);
    renderPage(60_000);
    const detailCalls = () => httpMock.mock.calls.filter(([path]) => path === '/api/admin/notices/12');

    fireEvent.click(await screen.findByRole('button', { name: '11월 스터디 모집 일정 안내' }));
    await screen.findByLabelText(/본문/);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: '11월 스터디 모집 일정 안내' }));
    expect(await screen.findByLabelText(/본문/)).toBeTruthy();
    expect(detailCalls()).toHaveLength(2);
  });

  it('편집을 열 때 한 건을 받지 못하면 폼 대신 실패 문구를 보이고 저장할 수 없다', async () => {
    httpMock.mockImplementation(async (path) => {
      if (String(path).startsWith('/api/admin/notices?')) return pageOf([notice()]);
      throw new Error('공지를 불러오지 못했습니다.');
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '11월 스터디 모집 일정 안내' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('공지를 불러오지 못했습니다.')).toBeTruthy();
    expect(within(dialog).queryByLabelText(/본문/)).toBeNull();
    expect(within(dialog).queryByRole('button', { name: '저장' })).toBeNull();
  });
});
