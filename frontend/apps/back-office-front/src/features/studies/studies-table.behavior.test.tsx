import type { Study } from '@studyclub/mock';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudiesTable, entryFilters } from '@/features/studies/StudiesTable';

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
    usePathname: () => '/studies',
  };
});

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
});

describe('대시보드 진입 주소 → 목록 필터·정렬 (specs/dashboard 4.4)', () => {
  it('view 를 이 목록의 필터·정렬로 바꾸고 나머지 조건은 비운다', () => {
    expect(entryFilters('ongoing', null)).toMatchObject({ status: 'ONGOING', publish: 'all', category: 'all', sort: 'title' });
    expect(entryFilters('ongoing', 'AI_ML')).toMatchObject({ status: 'ONGOING', publish: 'live', category: 'AI · ML' });
    expect(entryFilters('recruitment', null)).toMatchObject({ status: 'OPEN', recruit: 'all', sort: 'recruitment' });
    expect(entryFilters('cumulative', 'DATA')).toMatchObject({ status: 'all', publish: 'live', category: '데이터', sort: 'id' });
    expect(entryFilters('ongoing', null)).toMatchObject({ view: '', q: '', kind: 'all', noForm: '', page: '1' });
  });

  it('모르는 view 는 무시하고, 모르는 카테고리 코드는 카테고리를 걸지 않는다', () => {
    expect(entryFilters('everything', 'AI_ML')).toBeNull();
    expect(entryFilters(null, null)).toBeNull();
    expect(entryFilters('cumulative', 'NOPE')).toMatchObject({ category: 'all' });
  });

  it('모집중 전체 보기 — 개설만, 모집중 먼저 마감 시각 순(없으면 끝), 그다음 마감. 주소는 목록 필터로 바뀐다', async () => {
    memoryUrl.set('view=recruitment');
    render(<StudiesTable studies={STUDIES} />);

    expect(titles()).toEqual(['모집 이른 시각', '모집 늦은 시각', '모집 마감 없음', '마감 지남', '마감 정원']);
    await waitFor(() => expect(urlParams()).toEqual({ status: 'OPEN', sort: 'recruitment' }));
  });

  it('카테고리 진행중 — 그 카테고리의 진행 중을 이름순으로', async () => {
    memoryUrl.set('view=ongoing&category=AI_ML');
    render(<StudiesTable studies={STUDIES} />);

    expect(titles()).toEqual(['가 진행', '하 진행']);
    await waitFor(() =>
      expect(urlParams()).toEqual({ category: 'AI · ML', status: 'ONGOING', publish: 'live', sort: 'title' }),
    );
  });

  it('카테고리 누적 — 작성 중을 뺀 전체를 최근 등록순으로', () => {
    memoryUrl.set('view=cumulative&category=DATA');
    render(<StudiesTable studies={STUDIES} />);

    expect(titles()).toEqual(['나 진행']);
  });

  it('모집 마감순에서 상태를 「개설」이 아닌 것으로 바꾸면 최근 등록순이 된다', async () => {
    memoryUrl.set('status=OPEN&sort=recruitment');
    render(<StudiesTable studies={STUDIES} />);

    fireEvent.change(screen.getByDisplayValue('개설'), { target: { value: 'all' } });
    await waitFor(() => expect(urlParams()).toEqual({ sort: 'id' }));
    expect(titles().slice(0, 3)).toEqual(['작성 중', '나 진행', '가 진행']);
  });

  it('카테고리 없이 들어와도 주소를 목록 필터로 옮겨 적는다 — 진행중 · 누적', async () => {
    memoryUrl.set('view=ongoing');
    const { unmount } = render(<StudiesTable studies={STUDIES} />);
    expect(titles()).toEqual(['가 진행', '나 진행', '하 진행']);
    await waitFor(() => expect(urlParams()).toEqual({ status: 'ONGOING', sort: 'title' }));
    unmount();

    memoryUrl.set('view=cumulative');
    render(<StudiesTable studies={STUDIES} />);
    await waitFor(() => expect(urlParams()).toEqual({ publish: 'live', sort: 'id' }));
  });

  it('주소를 옮겨 적기 전에 조건을 바꿔도 진입 조건 위에 얹는다', () => {
    memoryUrl.set('view=ongoing&category=AI_ML');
    // 옮겨 적기가 아직 안 된 상태를 만든다
    vi.mocked(window.history.replaceState).mockImplementation(() => {});
    render(<StudiesTable studies={STUDIES} />);

    fireEvent.change(screen.getByDisplayValue('종류 전체'), { target: { value: 'club' } });
    expect(urlParams()).toEqual({ category: 'AI · ML', status: 'ONGOING', publish: 'live', sort: 'title', kind: 'club' });
  });

  it('이름이 같으면 기수 ID 순, 마감 시각이 같으면 이름·ID 순 — 서버 정렬과 같다', () => {
    const tied = [
      ongoing(31, '같은 이름'),
      ongoing(30, '같은 이름'),
      study(41, '나 같은 마감', { recruitment: { status: 'open', deadline: '2026-09-18T14:59:00Z' } }),
      study(40, '가 같은 마감', { recruitment: { status: 'open', deadline: '2026-09-18T14:59:00Z' } }),
    ];
    memoryUrl.set('status=ONGOING&sort=title');
    const { unmount } = render(<StudiesTable studies={tied} />);
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href')).filter((h) => h?.startsWith('/studies/'))).toEqual([
      '/studies/30',
      '/studies/31',
    ]);
    unmount();

    memoryUrl.set('status=OPEN&sort=recruitment');
    render(<StudiesTable studies={tied} />);
    expect(screen.getAllByRole('link').map((a) => a.textContent).filter((t) => t?.includes('같은 마감'))).toEqual([
      '가 같은 마감',
      '나 같은 마감',
    ]);
  });

  it('모집 마감순은 「개설」일 때만 고를 수 있다', () => {
    memoryUrl.set('status=ONGOING');
    render(<StudiesTable studies={STUDIES} />);

    const options = [...screen.getByRole('combobox', { name: '정렬' }).querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['기본 순서', '이름순', '최근 등록순']);
  });

  it('주소에 view 가 없으면 지금까지처럼 기본 순서로 그린다 — 주소를 건드리지 않는다', () => {
    render(<StudiesTable studies={STUDIES} />);

    // 기본 순서는 이 PR 전과 같다 — 마감일이 오늘 이후인(여기서는 마감 없는) 모집중이 맨 앞
    expect(titles()[0]).toBe('모집 마감 없음');
    expect(memoryUrl.get()).toBe('');
  });
});
