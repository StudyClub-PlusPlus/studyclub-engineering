import type { ReactElement } from 'react';

import type { Study } from '@studyclub/mock';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { entryFilters } from '@/features/studies/list-filters';
import { StudiesTable } from '@/features/studies/StudiesTable';

// 목록은 필터·정렬을 URL 로 든다(useUrlState). 테스트에는 Next 라우터가 없어 메모리 URL 로 대신한다.
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

const routerRefresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', async () => {
  const { useMemo, useSyncExternalStore } = await import('react');
  const router = {
    replace: (url: string) => memoryUrl.set(url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''),
    refresh: routerRefresh,
  };
  return {
    useSearchParams: () => {
      const search = useSyncExternalStore(memoryUrl.subscribe, memoryUrl.get);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    useRouter: () => router,
    usePathname: () => '/studies',
  };
});

/** 공개 전환이 react-query 를 쓴다 — 테스트마다 새 클라이언트로 감싼다. */
function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** lib/api.ts 의 mapToStudy 가 만드는 모양 — 목록에 필요한 것만. */
function study(id: number, title: string, patch: Partial<Study> = {}): Study {
  return {
    id: String(id),
    study_id: id,
    title: { ko: title, en: title },
    summary: { ko: '', en: '' },
    status: 'recruiting',
    lifecycleStatus: 'OPEN',
    format: 'online',
    kind: 'study',
    category: 'AI · ML',
    published: true,
    applicantCount: 0,
    hasApplicationForm: true,
    recruitment: { status: 'open' },
    ...patch,
  };
}

const ongoing = (id: number, title: string, category = 'AI · ML') =>
  study(id, title, { status: 'ongoing', lifecycleStatus: 'ONGOING', category, recruitment: { status: 'closed' } });

const STUDIES: Study[] = [
  // 개설 — 모집중 셋(같은 날 다른 시각 · 마감 없음), 마감 둘
  study(1, '모집 늦은 시각', { recruitment: { status: 'open', deadline: '2026-09-18T14:59:00Z' } }),
  study(2, '모집 이른 시각', { recruitment: { status: 'open', deadline: '2026-09-18T01:00:00Z' } }),
  study(3, '모집 마감 없음', { recruitment: { status: 'open' } }),
  study(4, '마감 정원', { recruitment: { status: 'closed', deadline: '2026-09-30T14:59:00Z' } }),
  study(5, '마감 지남', { recruitment: { status: 'closed', deadline: '2026-09-10T14:59:00Z' } }),
  // 진행 중
  ongoing(6, '하 진행'),
  ongoing(7, '가 진행'),
  ongoing(8, '나 진행', '데이터'),
  // 작성 중 — 공개 아님
  study(9, '작성 중', { lifecycleStatus: 'DRAFT', published: false, category: '데이터' }),
];

/** 화면에 그려진 스터디 이름 — 표의 순서대로. */
const titles = () => screen.getAllByRole('link').map((a) => a.textContent).filter((t) => STUDIES.some((s) => s.title.ko === t));
const urlParams = () => Object.fromEntries(new URLSearchParams(memoryUrl.get()));

beforeEach(() => {
  memoryUrl.set('');
  // 주소만 바꾸는 쪽(history.replaceState)도 메모리 URL 로 옮긴다 — Next 가 useSearchParams 와 맞춰 주는 것을 대신한다
  vi.spyOn(window.history, 'replaceState').mockImplementation((_state, _title, url) => {
    const next = String(url ?? '');
    memoryUrl.set(next.includes('?') ? next.slice(next.indexOf('?') + 1) : '');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  routerRefresh.mockReset();
});

describe('대시보드 진입 주소 → 목록 필터·정렬 (specs/dashboard 4.4)', () => {
  it('view 를 이 목록의 필터·정렬로 바꾸고 나머지 조건은 비운다', () => {
    expect(entryFilters('ongoing', null)).toMatchObject({ status: 'ONGOING', publish: 'all', category: 'all', sort: 'title' });
    expect(entryFilters('ongoing', 'AI_ML')).toMatchObject({ status: 'ONGOING', publish: 'live', category: 'AI · ML' });
    expect(entryFilters('recruitment', null)).toMatchObject({ status: 'OPEN', recruit: 'all', sort: 'recruitment' });
    expect(entryFilters('cumulative', 'DATA')).toMatchObject({ status: 'all', publish: 'live', category: '데이터', sort: 'id' });
    expect(entryFilters('ongoing', null)).toMatchObject({ view: '', q: '', form: 'all', page: '1' });
  });

  it('모르는 view 는 무시하고, 모르는 카테고리 코드는 카테고리를 걸지 않는다', () => {
    expect(entryFilters('everything', 'AI_ML')).toBeNull();
    expect(entryFilters(null, null)).toBeNull();
    expect(entryFilters('cumulative', 'NOPE')).toMatchObject({ category: 'all' });
  });

  it('모집중 전체 보기 — 개설만, 모집중 먼저 마감 시각 순(없으면 끝), 그다음 마감. 주소는 목록 필터로 바뀐다', async () => {
    memoryUrl.set('view=recruitment');
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);

    expect(titles()).toEqual(['모집 이른 시각', '모집 늦은 시각', '모집 마감 없음', '마감 지남', '마감 정원']);
    await waitFor(() => expect(urlParams()).toEqual({ status: 'OPEN', sort: 'recruitment' }));
  });

  it('카테고리 진행중 — 그 카테고리의 진행 중을 이름순으로', async () => {
    memoryUrl.set('view=ongoing&category=AI_ML');
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);

    expect(titles()).toEqual(['가 진행', '하 진행']);
    await waitFor(() =>
      expect(urlParams()).toEqual({ category: 'AI · ML', status: 'ONGOING', publish: 'live', sort: 'title' }),
    );
  });

  it('카테고리 누적 — 작성 중을 뺀 전체를 최근 등록순으로', () => {
    memoryUrl.set('view=cumulative&category=DATA');
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);

    expect(titles()).toEqual(['나 진행']);
  });

  it('모집 마감순에서 상태를 「개설」이 아닌 것으로 바꾸면 최근 등록순이 된다', async () => {
    memoryUrl.set('status=OPEN&sort=recruitment');
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);

    fireEvent.change(screen.getByDisplayValue('개설'), { target: { value: 'all' } });
    await waitFor(() => expect(urlParams()).toEqual({ sort: 'id' }));
    expect(titles().slice(0, 3)).toEqual(['작성 중', '나 진행', '가 진행']);
  });

  it('카테고리 없이 들어와도 주소를 목록 필터로 옮겨 적는다 — 진행중 · 누적', async () => {
    memoryUrl.set('view=ongoing');
    const { unmount } = render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);
    expect(titles()).toEqual(['가 진행', '나 진행', '하 진행']);
    await waitFor(() => expect(urlParams()).toEqual({ status: 'ONGOING', sort: 'title' }));
    unmount();

    memoryUrl.set('view=cumulative');
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);
    await waitFor(() => expect(urlParams()).toEqual({ publish: 'live', sort: 'id' }));
  });

  it('주소를 옮겨 적기 전에 조건을 바꿔도 진입 조건 위에 얹는다', () => {
    memoryUrl.set('view=ongoing&category=AI_ML');
    // 옮겨 적기가 아직 안 된 상태를 만든다
    vi.mocked(window.history.replaceState).mockImplementation(() => {});
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);

    fireEvent.change(screen.getByDisplayValue('신청 폼 전체'), { target: { value: 'none' } });
    expect(urlParams()).toEqual({ category: 'AI · ML', status: 'ONGOING', publish: 'live', sort: 'title', form: 'none' });
  });

  it('이름이 같으면 기수 ID 순, 마감 시각이 같으면 이름·ID 순 — 서버 정렬과 같다', () => {
    const tied = [
      ongoing(31, '같은 이름'),
      ongoing(30, '같은 이름'),
      study(41, '나 같은 마감', { recruitment: { status: 'open', deadline: '2026-09-18T14:59:00Z' } }),
      study(40, '가 같은 마감', { recruitment: { status: 'open', deadline: '2026-09-18T14:59:00Z' } }),
    ];
    memoryUrl.set('status=ONGOING&sort=title');
    const { unmount } = render(<StudiesTable list={{ mode: 'all', studies: tied }} />);
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href')).filter((h) => h?.startsWith('/studies/'))).toEqual([
      '/studies/30',
      '/studies/31',
    ]);
    unmount();

    memoryUrl.set('status=OPEN&sort=recruitment');
    render(<StudiesTable list={{ mode: 'all', studies: tied }} />);
    expect(screen.getAllByRole('link').map((a) => a.textContent).filter((t) => t?.includes('같은 마감'))).toEqual([
      '가 같은 마감',
      '나 같은 마감',
    ]);
  });

  it('열 이름을 누르면 오름차순, 다시 누르면 내림차순 — 정렬 드롭다운 · 종류 필터는 없다 (captain-list-all-studies 4 · 9)', () => {
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);

    expect(screen.queryByRole('combobox', { name: '정렬' })).toBeNull();
    expect(screen.queryByDisplayValue('종류 전체')).toBeNull();
    // 기본 순서는 「모집 상태」 오름차순으로 강조된다
    expect(screen.getByRole('columnheader', { name: /모집 상태/ })).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(screen.getByRole('button', { name: '스터디 오름차순으로 정렬' }));
    expect(urlParams()).toEqual({ sort: 'title' });
    fireEvent.click(screen.getByRole('button', { name: '스터디 내림차순으로 정렬' }));
    expect(urlParams()).toEqual({ sort: 'title:desc' });
    expect(titles()[0]).toBe('하 진행');
  });

  it('신청 폼 있음 · 없음으로 거른다', () => {
    memoryUrl.set('form=none');
    render(<StudiesTable list={{ mode: 'all', studies: [...STUDIES, study(50, '폼 없음', { hasApplicationForm: false })] }} />);
    const shown = screen.getAllByRole('link').map((a) => a.textContent);
    expect(shown).toContain('폼 없음');
    expect(shown.filter((t) => STUDIES.some((x) => x.title.ko === t))).toEqual([]);
  });

  it('주소에 view 가 없으면 지금까지처럼 기본 순서로 그린다 — 주소를 건드리지 않는다', () => {
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);

    // 기본 순서는 이 PR 전과 같다 — 마감일이 오늘 이후인(여기서는 마감 없는) 모집중이 맨 앞
    expect(titles()[0]).toBe('모집 마감 없음');
    expect(memoryUrl.get()).toBe('');
  });
});

describe('서버가 자른 한 페이지 (list.mode = server)', () => {
  const page2 = [ongoing(21, '하 서버 순서'), ongoing(22, '가 서버 순서')];

  it('서버가 준 순서 그대로 그리고, 개수와 페이지는 total 로 센다', () => {
    memoryUrl.set('status=ONGOING&sort=title&page=2');
    render(<StudiesTable list={{ mode: 'server', studies: page2, total: 45, offset: 20, limit: 20 }} />);

    // 화면에서 다시 정렬하지 않는다 — 이름순이어도 서버가 준 대로
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['하 서버 순서', '가 서버 순서']);
    expect(screen.getByText('45개')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '4' })).toBeNull();
  });

  it('페이지를 넘기면 조건을 두고 page 만 바꾸고, 필터를 바꾸면 1페이지로', () => {
    memoryUrl.set('status=ONGOING&sort=title&page=2');
    render(<StudiesTable list={{ mode: 'server', studies: page2, total: 45, offset: 20, limit: 20 }} />);

    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(urlParams()).toEqual({ status: 'ONGOING', sort: 'title', page: '3' });

    fireEvent.change(screen.getByDisplayValue('공개 전체'), { target: { value: 'live' } });
    expect(urlParams()).toEqual({ status: 'ONGOING', sort: 'title', publish: 'live' });
  });

  it('끝을 넘는 주소면 서버가 준 마지막 페이지를 현재 페이지로 그린다', () => {
    memoryUrl.set('status=ONGOING&sort=title&page=9');
    render(<StudiesTable list={{ mode: 'server', studies: page2, total: 22, offset: 20, limit: 20 }} />);

    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
  });

  it('조건에 맞는 것이 없으면 빈 표 문구', () => {
    memoryUrl.set('status=ONGOING&sort=title');
    render(<StudiesTable list={{ mode: 'server', studies: [], total: 0, offset: 0, limit: 20 }} />);

    expect(screen.getByText('조건에 맞는 스터디가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('0개')).toBeInTheDocument();
  });
});

describe('목록으로 돌아오는 주소 — 상세의 「← 스터디 관리」', () => {
  it('지금 걸린 필터를 탭 저장소에 적고, 필터를 바꾸면 같이 바뀐다', async () => {
    memoryUrl.set('status=OPEN&publish=live');
    render(<StudiesTable list={{ mode: 'all', studies: STUDIES }} />);
    expect(sessionStorage.getItem('bo:studies-list-search')).toBe('?status=OPEN&publish=live');

    memoryUrl.set('');
    await waitFor(() => expect(sessionStorage.getItem('bo:studies-list-search')).toBeNull());
  });
});

describe('공개 설정 (captain-publish-study 1 · 1-1 · 4)', () => {
  const draft = study(20, '작성 중 폼 있음', { lifecycleStatus: 'DRAFT', published: false });
  const draftNoForm = study(21, '작성 중 폼 없음', { lifecycleStatus: 'DRAFT', published: false, hasApplicationForm: false });
  const open = study(22, '개설');
  const running = ongoing(23, '진행 중');
  const list = { mode: 'all' as const, studies: [draft, draftNoForm, open, running] };
  const rowOf = (title: string) => screen.getByRole('link', { name: title }).closest('tr')!;
  const toggleOf = (title: string) =>
    [...rowOf(title).querySelectorAll('button')].find((b) => b.textContent === '공개' || b.textContent === '미공개')!;

  it('미공개를 누르면 확인 팝업이 뜨고, 「공개」를 눌러야 publish 를 부르고 목록을 다시 받는다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(<StudiesTable list={list} />);

    fireEvent.click(toggleOf('작성 중 폼 있음'));
    expect(screen.getByText('‘작성 중 폼 있음’ 스터디를 공개하시겠습니까?')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '공개' }));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/studies\/20\/publish$/),
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() => expect(screen.queryByText('‘작성 중 폼 있음’ 스터디를 공개하시겠습니까?')).not.toBeInTheDocument());
  });

  it('공개를 누르면 비공개 확인을 묻고 unpublish 를 부른다. 취소하면 아무것도 부르지 않는다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(<StudiesTable list={list} />);

    fireEvent.click(toggleOf('개설'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(toggleOf('개설'));
    expect(screen.getByText('‘개설’ 스터디를 비공개로 전환하시겠습니까?')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '비공개로 전환' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/admin\/studies\/22\/unpublish$/),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('신청 폼이 없는 미공개 · 진행 중인 공개 스터디는 누를 수 없고, 짚으면 이유를 말풍선으로 알려 준다', () => {
    render(<StudiesTable list={list} />);

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(toggleOf('작성 중 폼 없음')).toHaveAttribute('aria-disabled', 'true');
    expect(toggleOf('진행 중')).toHaveAttribute('aria-disabled', 'true');

    // 눌러도 팝업이 뜨지 않는다
    fireEvent.click(toggleOf('작성 중 폼 없음'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // 마우스를 올리거나 포커스하면 이유가 말풍선으로 뜬다
    fireEvent.mouseEnter(toggleOf('작성 중 폼 없음'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('신청 폼을 먼저 연결하세요.');
    fireEvent.mouseLeave(toggleOf('작성 중 폼 없음'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(toggleOf('진행 중'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('진행 중이거나 종료된 스터디는 비공개로 돌릴 수 없습니다.');
  });

  it('서버가 거절하면 팝업에 이유를 보이고 목록을 다시 받지 않는다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ errorCode: 'APPLICATION_FORM_REQUIRED', errorMessage: '신청 폼을 먼저 연결하세요.' }), {
        status: 409,
      }),
    );
    render(<StudiesTable list={list} />);

    fireEvent.click(toggleOf('작성 중 폼 있음'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '공개' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('신청 폼을 먼저 연결하세요.');
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
