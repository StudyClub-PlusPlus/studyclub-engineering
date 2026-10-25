import { describe, expect, it } from 'vitest';

import { URL_DEFAULTS, resolveListFilters, serverListQuery } from '@/features/studies/list-filters';

const query = (params: Record<string, string | string[]>) => serverListQuery(resolveListFilters(params));

describe('serverListQuery — 목록 필터를 GET /api/admin/studies Query 로 (specs/dashboard 4.4)', () => {
  it('대시보드 진입 주소는 스펙 표의 Query 와 첫 페이지(offset 0 · limit 20)가 된다', () => {
    expect(query({ view: 'ongoing' })).toBe('status=ONGOING&sort=TITLE_ASC&offset=0&limit=20');
    expect(query({ view: 'recruitment' })).toBe('status=OPEN&sort=RECRUITMENT&offset=0&limit=20');
    expect(query({ view: 'ongoing', category: 'AI_ML' })).toBe(
      'category=AI_ML&status=ONGOING&visibility=PUBLIC&sort=TITLE_ASC&offset=0&limit=20',
    );
    expect(query({ view: 'cumulative', category: 'DATA' })).toBe(
      'category=DATA&visibility=PUBLIC&sort=ID_DESC&offset=0&limit=20',
    );
  });

  it('목록에서 고른 조건도 서버 Query 로 옮긴다 — 카테고리는 코드로, 페이지는 offset 으로', () => {
    expect(
      query({ category: 'AI · ML', kind: 'club', recruit: 'apply', publish: 'draft', status: 'OPEN', sort: 'id', page: '3' }),
    ).toBe('category=AI_ML&status=OPEN&studyKind=CLUB&recruitStatus=RECRUITING&visibility=PRIVATE&sort=ID_DESC&offset=40&limit=20');
  });

  it('모집 마감순은 「개설」에서만 — 다른 상태면 최근 등록순으로 보낸다', () => {
    expect(query({ status: 'ONGOING', sort: 'recruitment' })).toBe('status=ONGOING&sort=ID_DESC&offset=0&limit=20');
  });

  it('서버에 없는 조건이 하나라도 걸리면 null — 전체를 받아 화면이 거른다', () => {
    expect(query({ sort: 'all' })).toBeNull(); // 기본 순서
    expect(query({})).toBeNull();
    expect(query({ sort: 'title', q: '리딩' })).toBeNull();
    expect(query({ sort: 'title', noForm: '1' })).toBeNull();
    // 화면의 「마감」은 진행 중 · 종료까지 포함한다 — 서버 RECRUIT_CLOSED(개설 기수만)와 뜻이 다르다
    expect(query({ sort: 'title', recruit: 'closed' })).toBeNull();
  });

  it('허용 밖 값은 기본값으로 읽는다 — 주소는 누구나 고칠 수 있다', () => {
    expect(resolveListFilters({ status: 'NOPE', sort: ['title', 'id'], page: 'x' })).toEqual({
      ...URL_DEFAULTS,
      sort: 'title',
      page: 'x',
    });
    expect(query({ status: 'NOPE', sort: 'title', page: 'x' })).toBe('sort=TITLE_ASC&offset=0&limit=20');
  });
});
