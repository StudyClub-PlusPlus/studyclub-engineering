import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RetrosPage from '@/app/retros/page';
import type { ApiAdminRetro, ApiAdminRetros } from '@/features/meeting-retro/types';
import { http } from '@/lib/http';

// 서버는 http 한 곳으로 막는다 — 경로 · 쿼리까지 함께 확인한다.
vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

// 화면이 조건 · 페이지를 URL 로 든다(useUrlState). 테스트에는 Next 라우터가 없어 메모리 URL 로 대신한다.
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
  const router = { replace: (url: string) => memoryUrl.set(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '') };
  return {
    useSearchParams: () => {
      const search = useSyncExternalStore(memoryUrl.subscribe, memoryUrl.get);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    useRouter: () => router,
    usePathname: () => '/retros',
  };
});

const httpMock = vi.mocked(http);

function item(
  patch: Partial<Omit<ApiAdminRetro, 'retro'>> & { retro?: Partial<ApiAdminRetro['retro']> } = {},
): ApiAdminRetro {
  const { retro, ...rest } = patch;
  return {
    studyId: 5,
    studyTitle: 'React 실전 스터디 3기',
    groupName: 'A반',
    meetingId: 301,
    meetingNo: 3,
    meetingStartAt: '2026-11-17T11:00:00Z',
    participantName: '하늘',
    closed: true,
    ...rest,
    retro: {
      good: '예제가 좋았어요',
      improve: '실습 코드를 미리 주세요',
      feeling: '',
      likes: { GOOD: 3, IMPROVE: 2, FEELING: 0 },
      writtenAt: '2026-11-17T12:42:00Z',
      ...retro,
    },
  };
}

const page = (items: ApiAdminRetro[], patch: Partial<ApiAdminRetros> = {}): ApiAdminRetros => ({
  summary: { rows: 31, written: 21, closedRows: 24, closedWritten: 18, good: 21, improve: 20, feeling: 15 },
  total: items.length,
  items,
  ...patch,
});

/** 마지막으로 부른 회고 목록 요청의 쿼리. */
function lastRetrosQuery(): URLSearchParams {
  const call = httpMock.mock.calls.map(([path]) => String(path)).filter((p) => p.startsWith('/api/admin/retros')).at(-1)!;
  return new URLSearchParams(call.split('?')[1]);
}

let retros: ApiAdminRetros;

beforeEach(() => {
  memoryUrl.set('');
  httpMock.mockReset();
  retros = page([
    item(),
    item({ participantName: '민호', meetingNo: 2, retro: { improve: '시작이 늦어요', feeling: '뿌듯해요' } }),
  ]);
  httpMock.mockImplementation(async (path) => {
    const p = String(path);
    let m: RegExpMatchArray | null;
    if (p === '/api/admin/studies/5/participants')
      return {
        studyId: 5,
        participantCount: 0,
        recruitmentCapacity: null,
        ownerCaptain: null,
        groups: [
          { groupId: 1, name: 'A반', isDefault: true, canDelete: false },
          { groupId: 2, name: 'B반', isDefault: false, canDelete: true },
        ],
        participants: [],
      };
    if ((m = p.match(/^\/api\/admin\/studies\/5\/groups\/(\d+)\/meetings$/)))
      return {
        studyGroup: { id: Number(m[1]), name: '', timezone: 'Asia/Seoul', startTime: null, navigatorName: null, rules: null, daysOfWeek: null },
        me: { participantId: null, canEdit: true },
        participants: [],
        meetings: [
          { id: Number(m[1]) * 100 + 1, type: 'REGULAR', number: 1, scheduledAt: '2026-11-10T11:00:00Z', title: null, presenter1: null, presenter2: null, started: true },
          { id: Number(m[1]) * 100 + 9, type: 'REGULAR', number: 9, scheduledAt: '2099-01-01T11:00:00Z', title: null, presenter1: null, presenter2: null, started: false },
        ],
      };
    if (p.startsWith('/api/admin/studies'))
      return { items: [{ studyId: 5, title: 'React 실전 스터디 3기' }], total: 1, offset: 0, limit: 100 };
    if (p.startsWith('/api/admin/retros')) return retros;
    throw new Error(`unexpected ${p}`);
  });
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RetrosPage />
    </QueryClientProvider>,
  );
}

describe('회고 모아보기', () => {
  it('처음엔 문항별 보기 · 개선할 점 · 최신순으로 부르고, 의견마다 출처 한 줄과 👍', async () => {
    mount();
    const list = await screen.findByRole('list');
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
      '실습 코드를 미리 주세요React 실전 스터디 3기 · A반 · 3회차 2026-11-17 (화) · 하늘 · 11.17 21:42 KST 작성',
    );
    const q = lastRetrosQuery();
    expect(Object.fromEntries(q)).toEqual({ section: 'IMPROVE', sort: 'RECENT', offset: '0', limit: '20' });
  });

  it('요약 한 줄 — 작성률은 기한 지난 회고만, 문항 단추에 쓴 회고 수', async () => {
    mount();
    await waitFor(() =>
      expect(screen.getByTestId('retro-rate')).toHaveTextContent('작성률 75% (기한 지난 회고 18/24 작성)'),
    );
    expect(screen.getByRole('tab', { name: '개선할 점 20' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '좋았던 점 21' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '소감 15' })).toBeInTheDocument();
    expect(screen.getByTestId('retro-total')).toHaveTextContent('총 2건');
  });

  it('기한 지난 회차가 없으면 작성률은 「-」', async () => {
    retros = page([item()], {
      summary: { rows: 4, written: 1, closedRows: 0, closedWritten: 0, good: 1, improve: 1, feeling: 0 },
    });
    mount();
    await waitFor(() =>
      expect(screen.getByTestId('retro-rate')).toHaveTextContent('작성률 - (기한이 지난 회차가 아직 없어요)'),
    );
  });

  it('문항 · 순서를 바꾸면 서버에 그 조건으로 다시 묻고 1페이지로', async () => {
    memoryUrl.set('page=2');
    mount();
    await screen.findByRole('list');
    await userEvent.click(screen.getByRole('tab', { name: '좋았던 점 21' }));
    await userEvent.click(screen.getByRole('tab', { name: '공감순' }));
    await waitFor(() => expect(Object.fromEntries(lastRetrosQuery())).toMatchObject({ section: 'GOOD', sort: 'LIKES', offset: '0' }));
    expect(memoryUrl.get()).toBe('section=GOOD&sort=LIKES');
  });

  it('스터디를 고르고 이름을 검색하면 그 조건으로 묻는다', async () => {
    mount();
    await screen.findByRole('list');
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '전체 스터디' }), '5');
    await userEvent.type(screen.getByRole('searchbox', { name: '참여자 이름 검색' }), '하늘');
    await waitFor(() => expect(Object.fromEntries(lastRetrosQuery())).toMatchObject({ studyId: '5', q: '하늘' }), {
      timeout: 2000,
    });
    expect(httpMock).toHaveBeenCalledWith(
      '/api/admin/studies?status=ONGOING&sort=TITLE_ASC&offset=0&limit=100',
      expect.anything(),
    );
  });

  it('회차는 스터디를 고른 뒤에만 고르고, 스터디를 바꾸면 전체로 돌아간다', async () => {
    mount();
    await screen.findByRole('list');
    expect(screen.queryByRole('combobox', { name: '전체 회차' })).not.toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '전체 스터디' }), '5');
    const picker = await screen.findByRole('combobox', { name: '전체 회차' });
    // 반이 둘이라 반 이름을 붙이고, 아직 안 한 회차는 없다
    await waitFor(() =>
      expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual([
        '전체 회차',
        'A반 · 1회차',
        'B반 · 1회차',
      ]),
    );
    await userEvent.selectOptions(picker, '201');
    await waitFor(() => expect(Object.fromEntries(lastRetrosQuery())).toMatchObject({ studyId: '5', meetingId: '201' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '전체 스터디' }), 'ALL');
    await waitFor(() => expect(lastRetrosQuery().has('meetingId')).toBe(false));
    expect(memoryUrl.get()).toBe('');
  });

  it('표 보기 — 한 사람의 문항이 한 줄, 비운 소감은 「-」', async () => {
    mount();
    await screen.findByRole('list');
    await userEvent.click(screen.getByRole('tab', { name: '표' }));
    const rows = within(await screen.findByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('React 실전 스터디 3기A반 · 3회차하늘예제가 좋았어요 3실습 코드를 미리 주세요 2-11.1721:42 KST');
    expect(lastRetrosQuery().has('section')).toBe(false);
    expect(lastRetrosQuery().has('sections')).toBe(false);
  });

  it('문항 열을 끄면 sections 로 묻고, 마지막 남은 열은 끌 수 없다', async () => {
    memoryUrl.set('view=table');
    mount();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '좋았던 점 21' }));
    await waitFor(() => expect(lastRetrosQuery().get('sections')).toBe('IMPROVE,FEELING'));
    await userEvent.click(screen.getByRole('button', { name: '소감 15' }));
    await waitFor(() => expect(lastRetrosQuery().get('sections')).toBe('IMPROVE'));
    expect(screen.getByRole('button', { name: '개선할 점 20' })).toBeDisabled();
    expect(within(screen.getByRole('table')).queryByRole('columnheader', { name: /소감/ })).not.toBeInTheDocument();
  });

  it('열 머리를 누르면 그 문항 👍 많은 순, 다시 누르면 적은 순. 줄 순서를 고르면 풀린다', async () => {
    memoryUrl.set('view=table');
    mount();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: '개선할 점 공감 많은 순으로 정렬' }));
    await waitFor(() => expect(Object.fromEntries(lastRetrosQuery())).toMatchObject({ likeSort: 'IMPROVE', likeDir: 'DESC' }));
    await userEvent.click(screen.getByRole('button', { name: '개선할 점 공감 적은 순으로 정렬' }));
    await waitFor(() => expect(lastRetrosQuery().get('likeDir')).toBe('ASC'));
    await userEvent.click(screen.getByRole('tab', { name: '공감순' }));
    await waitFor(() => expect(lastRetrosQuery().get('sort')).toBe('LIKES'));
    expect(lastRetrosQuery().has('likeSort')).toBe(false);
  });

  it('CSV 는 지금 조건(페이지 없이)으로 내려받는 링크 — 줄이 없으면 누를 수 없다', async () => {
    memoryUrl.set('view=table&cols=GOOD,IMPROVE&sort=LIKES&study=5');
    mount();
    const link = await screen.findByRole('link', { name: 'CSV 내려받기' });
    expect(link.getAttribute('href')).toMatch(/\/api\/admin\/retros\/export\.csv\?studyId=5&sections=GOOD%2CIMPROVE&sort=LIKES$/);
  });

  it('문항별 보기의 CSV 는 세 문항을 모두 담는다(section 을 보내지 않는다)', async () => {
    mount();
    const link = await screen.findByRole('link', { name: 'CSV 내려받기' });
    expect(link.getAttribute('href')).toMatch(/\/api\/admin\/retros\/export\.csv\?sort=RECENT$/);
  });

  it('줄이 없으면 CSV 단추가 비활성이고 「조건에 맞는 의견이 없어요.」', async () => {
    retros = page([]);
    mount();
    expect(await screen.findByText('조건에 맞는 의견이 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV 내려받기' })).toBeDisabled();
  });

  it('못 읽으면 0건으로 보이지 않고 정해진 문구와 다시 시도 — 서버 문구는 쓰지 않는다', async () => {
    httpMock.mockImplementation(async (path) => {
      if (String(path).startsWith('/api/admin/studies')) return { items: [], total: 0, offset: 0, limit: 100 };
      throw new Error('요청에 실패했습니다 (500)');
    });
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('회고를 불러오지 못했습니다.');
    expect(screen.getByTestId('retro-total')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});
