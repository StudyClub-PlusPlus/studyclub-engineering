import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchStudies } from '@/lib/api';

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
  };
}

/** total 건을 offset·limit 대로 잘라 주는 서버. */
function serverWith(total: number) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => apiStudy(offset + i + 1));
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

describe('fetchStudies — 서버는 한 번에 100건까지 준다', () => {
  it('total 까지 100건씩 나눠 받아 하나로 합친다', async () => {
    serverWith(230);

    const studies = await fetchStudies();

    expect(requested()).toEqual(['?offset=0&limit=100', '?offset=100&limit=100', '?offset=200&limit=100']);
    expect(studies).toHaveLength(230);
    expect(studies.map((s) => s.study_id)).toEqual(Array.from({ length: 230 }, (_, i) => i + 1));
  });

  it('100건 이하면 한 번만 부른다 — 백오피스 토큰만 Authorization 으로 보낸다', async () => {
    serverWith(7);

    await fetchStudies();

    expect(requested()).toEqual(['?offset=0&limit=100']);
    expect(fetchMock.mock.calls[0]![1]!.headers).toEqual({ Authorization: 'Bearer bo-token' });
  });

  it('모집 마감은 시각까지 둔다 — 모집 마감순이 같은 날 안에서도 시각으로 가른다', async () => {
    serverWith(1);

    const [first] = await fetchStudies();

    expect(first!.recruitment?.deadline).toBe('2026-09-18T14:59:00Z');
  });

  it('받는 사이 행이 밀려 같은 스터디가 두 번 와도 하나만 남긴다', async () => {
    fetchMock.mockImplementation(async (input) => {
      const offset = Number(new URL(String(input)).searchParams.get('offset'));
      // 첫 장 1~100, 둘째 장은 한 칸 밀려 100~198 — 100 이 두 번 온다
      const ids = offset === 0 ? Array.from({ length: 100 }, (_, i) => i + 1) : Array.from({ length: 99 }, (_, i) => i + 100);
      return new Response(JSON.stringify({ items: ids.map(apiStudy), total: 199, offset, limit: 100 }), { status: 200 });
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const studies = await fetchStudies();

    expect(studies).toHaveLength(198);
    expect(new Set(studies.map((s) => s.study_id)).size).toBe(198);
    expect(console.warn).toHaveBeenCalled();
  });

  it('잠깐 끊긴 연결(503)은 다시 시도한다', async () => {
    serverWith(3);
    const ok = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(async () => new Response('', { status: 503 }));
    fetchMock.mockImplementation(ok);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const studies = await fetchStudies();

    vi.useRealTimers();
    expect(studies).toHaveLength(3);
    expect(requested()).toEqual(['?offset=0&limit=100', '?offset=0&limit=100']);
  });

  it('서버가 거절하면 상태 코드와 함께 실패한다', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ errorCode: 'INVALID_INPUT' }), { status: 400 }));

    await expect(fetchStudies()).rejects.toThrow('스터디 목록을 불러오지 못했습니다. (400)');
  });
});
