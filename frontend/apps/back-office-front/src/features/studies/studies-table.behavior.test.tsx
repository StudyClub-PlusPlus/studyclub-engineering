import type { ReactElement } from 'react';

import type { Study } from '@studyclub/types';
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

function page(studies: Study[]) {
  return { mode: 'server' as const, studies, total: studies.length, offset: 0, limit: 20 };
}

/** 화면에 그려진 스터디 이름 — 표의 순서대로. */
const titles = () =>
  screen
    .getAllByRole('link')
    .map((a) => a.textContent)
    .filter((t) => STUDIES.some((s) => s.title.ko === t));
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
    expect(entryFilters('ongoing', null)).toMatchObject({
      status: 'ONGOING',
      publish: 'all',
      category: 'all',
      sort: 'title',
    });
    expect(entryFilters('ongoing', 'AI_ML')).toMatchObject({ status: 'ONGOING', publish: 'live', category: 'AI · ML' });
    expect(entryFilters('recruitment', null)).toMatchObject({ status: 'OPEN', recruit: 'all', sort: 'recruitment' });
    expect(entryFilters('cumulative', 'DATA')).toMatchObject({
      status: 'all',
      publish: 'live',
      category: '데이터',
      sort: 'id',
    });
    expect(entryFilters('ongoing', null)).toMatchObject({ view: '', q: '', form: 'all', page: '1' });
  });

  it('모르는 view 는 무시하고, 모르는 카테고리 코드는 카테고리를 걸지 않는다', () => {
    expect(entryFilters('everything', 'AI_ML')).toBeNull();
    expect(entryFilters(null, null)).toBeNull();
    expect(entryFilters('cumulative', 'NOPE')).toMatchObject({ category: 'all' });
  });

  it('모집 보드 진입 필터를 주소에 표시하고 서버 목록 순서를 유지한다', async () => {
    memoryUrl.set('view=recruitment');
    const result = page([STUDIES[1]!, STUDIES[0]!, STUDIES[4]!]);
    render(<StudiesTable list={result} />);
    expect(titles()).toEqual(['모집 이른 시각', '모집 늦은 시각', '마감 지남']);
    await waitFor(() => expect(urlParams()).toEqual({ status: 'OPEN', sort: 'recruitment' }));
  });

  it('개설 외 상태를 선택하면 모집 보드 전용 정렬을 해제하고 첫 페이지를 요청한다', () => {
    memoryUrl.set('status=OPEN&sort=recruitment&page=2');
    render(<StudiesTable list={page(STUDIES)} />);
    fireEvent.change(screen.getByDisplayValue('개설'), { target: { value: 'all' } });
    expect(urlParams()).toEqual({ sort: 'id' });
  });

  it('열 머리 정렬은 주소를 바꾸며 기존 응답을 로컬에서 재정렬하지 않는다', () => {
    render(<StudiesTable list={page(STUDIES)} />);
    const before = titles();
    expect(screen.getByRole('columnheader', { name: /모집 상태/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: '스터디 오름차순으로 정렬' }));
    expect(urlParams()).toEqual({ sort: 'title' });
    fireEvent.click(screen.getByRole('button', { name: '스터디 내림차순으로 정렬' }));
    expect(urlParams()).toEqual({ sort: 'title:desc' });
    expect(titles()).toEqual(before);
  });

  it('넓은 마감·신청 폼·검색 조건이 있어도 받은 페이지를 다시 거르지 않는다', () => {
    memoryUrl.set('recruit=closed&form=none&q=서버검색');
    render(<StudiesTable list={page([STUDIES[5]!])} />);
    expect(titles()).toEqual(['하 진행']);
    expect(screen.getByDisplayValue('마감')).toBeInTheDocument();
    expect(screen.getByDisplayValue('없음')).toBeInTheDocument();
  });

  it('필터 변경은 검색·다른 조건을 보존하고 페이지를 초기화한다', () => {
    memoryUrl.set('status=OPEN&q=AI&page=3');
    render(<StudiesTable list={page(STUDIES)} />);
    fireEvent.change(screen.getByDisplayValue('신청 폼 전체'), { target: { value: 'none' } });
    expect(urlParams()).toEqual({ status: 'OPEN', q: 'AI', form: 'none' });
  });

  it('검색은 입력 직후 요청하지 않고 300ms 후 첫 페이지 주소에 반영한다', async () => {
    memoryUrl.set('page=2');
    render(<StudiesTable list={page(STUDIES)} />);
    fireEvent.change(screen.getByPlaceholderText('제목 · 한 줄 소개 검색'), { target: { value: 'AI' } });
    expect(urlParams()).toEqual({ page: '2' });
    await waitFor(() => expect(urlParams()).toEqual({ q: 'AI' }));
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
    render(<StudiesTable list={page(STUDIES)} />);
    expect(sessionStorage.getItem('bo:studies-list-search')).toBe('?status=OPEN&publish=live');

    memoryUrl.set('');
    await waitFor(() => expect(sessionStorage.getItem('bo:studies-list-search')).toBeNull());
  });
});

describe('공개 설정 (captain-publish-study 1 · 1-1 · 4)', () => {
  const draft = study(20, '작성 중 폼 있음', { lifecycleStatus: 'DRAFT', published: false });
  const draftNoForm = study(21, '작성 중 폼 없음', {
    lifecycleStatus: 'DRAFT',
    published: false,
    hasApplicationForm: false,
  });
  const open = study(22, '개설');
  const running = ongoing(23, '진행 중');
  const list = page([draft, draftNoForm, open, running]);
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
    await waitFor(() =>
      expect(screen.queryByText('‘작성 중 폼 있음’ 스터디를 공개하시겠습니까?')).not.toBeInTheDocument(),
    );
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
      new Response(
        JSON.stringify({ errorCode: 'APPLICATION_FORM_REQUIRED', errorMessage: '신청 폼을 먼저 연결하세요.' }),
        {
          status: 409,
        },
      ),
    );
    render(<StudiesTable list={list} />);

    fireEvent.click(toggleOf('작성 중 폼 있음'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '공개' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('신청 폼을 먼저 연결하세요.');
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
