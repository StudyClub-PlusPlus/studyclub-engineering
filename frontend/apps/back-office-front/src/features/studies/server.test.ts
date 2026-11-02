import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchStudyListPage } from '@/features/studies/server';

vi.mock('next/headers', () => ({
  // 사이트 쿠키(sc_)가 같이 있어도 백오피스 토큰만 꺼내 보내는지 본다
  cookies: async () => ({
    get: (name: string) => ({ bo_access_token: { value: 'bo-token' }, sc_access_token: { value: 'sc-token' } })[name],
  }),
}));

const fetchMock = vi.fn<typeof fetch>();

function apiStudy(id: number) {
  return {
    studyId: id,
    programId: id,
    title: `스터디 ${id}`,
    category: 'AI_ML',
    studyKind: 'STUDY',
    status: 'OPEN',
    recruitmentCapacity: null,
    currentApplicants: 0,
    recruitStatus: 'RECRUITING',
    recruitmentStartAt: null,
    recruitDeadlineAt: '2026-09-18T14:59:00Z',
    startAt: null,
    timezone: 'KST',
    hasApplicationForm: true,
    authorNickname: null,
  };
}

/** total 건을 offset·limit 대로 잘라 주는 서버. */
function serverWith(total: number) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) =>
      apiStudy(offset + i + 1),
    );
    return new Response(JSON.stringify({ items, total, offset, limit }), { status: 200 });
  });
}

const requested = () => fetchMock.mock.calls.map(([input]) => new URL(String(input)).search);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchStudyListPage — 서버가 거르고 정렬한 한 페이지', () => {
  it('전체가 1만 건을 넘어도 조건에 맞는 한 페이지만 요청한다', async () => {
    serverWith(10001);
    const query =
      'keyword=AI&recruitFilter=NOT_RECRUITING&hasApplicationForm=false&sort=APPLICANTS_DESC&offset=0&limit=20';
    const page = await fetchStudyListPage(query);
    expect(requested()).toEqual(['?' + query]);
    expect(page.studies).toHaveLength(20);
    expect(page.total).toBe(10001);
    expect(fetchMock.mock.calls[0]![1]!.headers).toEqual({ Authorization: 'Bearer bo-token' });
    expect(page.studies[0]!.recruitment?.deadline).toBe('2026-09-18T14:59:00Z');
  });

  it('연결이 잠깐 끊기면 같은 페이지만 재시도한다', async () => {
    serverWith(3);
    fetchMock.mockImplementationOnce(async () => new Response('', { status: 503 }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const page = await fetchStudyListPage('sort=RECRUITMENT_FIRST&offset=0&limit=20');
      expect(page.studies).toHaveLength(3);
      expect(requested()).toEqual(Array(2).fill('?sort=RECRUITMENT_FIRST&offset=0&limit=20'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('서버가 거절하면 실패하고 전체 조회로 우회하지 않는다', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 400 }));
    await expect(fetchStudyListPage('offset=0&limit=20')).rejects.toThrow('(400)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('받은 Query 그대로 한 번 부르고 total · offset · limit 을 넘긴다', async () => {
    serverWith(45);

    const page = await fetchStudyListPage('status=ONGOING&sort=TITLE_ASC&offset=20&limit=20');

    expect(requested()).toEqual(['?status=ONGOING&sort=TITLE_ASC&offset=20&limit=20']);
    expect(page).toMatchObject({ mode: 'server', total: 45, offset: 20, limit: 20 });
    expect(page.studies.map((s) => s.study_id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 21));
  });

  it('끝을 넘는 페이지면 마지막 페이지를 다시 받는다', async () => {
    serverWith(22);

    const page = await fetchStudyListPage('sort=ID_DESC&offset=80&limit=20');

    expect(requested()).toEqual(['?sort=ID_DESC&offset=80&limit=20', '?sort=ID_DESC&offset=20&limit=20']);
    expect(page).toMatchObject({ total: 22, offset: 20 });
    expect(page.studies).toHaveLength(2);
  });

  it('조건에 맞는 것이 없으면(total 0) 다시 부르지 않는다', async () => {
    serverWith(0);

    const page = await fetchStudyListPage('sort=ID_DESC&offset=40&limit=20');

    expect(requested()).toHaveLength(1);
    expect(page).toMatchObject({ total: 0, studies: [] });
  });
});

it('서버 목록의 잘못된 필수 필드는 매핑 전에 거절하고 다시 요청하지 않는다', async () => {
  fetchMock.mockResolvedValue(
    Response.json({ items: [{ ...apiStudy(1), currentApplicants: 'wrong' }], total: 1, offset: 0, limit: 20 }),
  );
  await expect(fetchStudyListPage('offset=0&limit=20')).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
