import { describe, expect, it } from 'vitest';

import {
  URL_DEFAULTS,
  headerSortOf,
  nextSortFor,
  resolveListFilters,
  serverListQuery,
} from '@/features/studies/list-filters';

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
      query({ category: 'AI · ML', recruit: 'apply', publish: 'draft', status: 'OPEN', sort: 'id', page: '3' }),
    ).toBe('category=AI_ML&status=OPEN&recruitFilter=RECRUITING&visibility=PRIVATE&sort=ID_DESC&offset=40&limit=20');
  });

  it('모집 마감순은 「개설」에서만 — 다른 상태면 최근 등록순으로 보낸다', () => {
    expect(query({ status: 'ONGOING', sort: 'recruitment' })).toBe('status=ONGOING&sort=ID_DESC&offset=0&limit=20');
  });

  it('일반 목록의 기본 순서도 서버에 요청한다', () => {
    expect(query({})).toBe('sort=RECRUITMENT_FIRST&offset=0&limit=20');
  });

  it('검색·신청 폼·넓은 마감 조건을 함께 서버에 전달한다', () => {
    const result = new URLSearchParams(
      query({ q: '  AI _%  ', status: 'OPEN', recruit: 'closed', form: 'none', page: '2' }),
    );
    expect(Object.fromEntries(result)).toEqual({
      status: 'OPEN',
      recruitFilter: 'NOT_RECRUITING',
      keyword: 'AI _%',
      hasApplicationForm: 'false',
      sort: 'RECRUITMENT_FIRST',
      offset: '20',
      limit: '20',
    });
    expect(new URLSearchParams(query({ form: 'has' })).get('hasApplicationForm')).toBe('true');
    expect(new URLSearchParams(query({ q: '   ' })).has('keyword')).toBe(false);
  });

  it.each([
    ['program', 'PROGRAM'],
    ['title', 'TITLE'],
    ['status', 'STATUS'],
    ['category', 'CATEGORY'],
    ['timezone', 'TIMEZONE'],
    ['recruitStart', 'RECRUIT_START'],
    ['recruitEnd', 'RECRUIT_END'],
    ['recruit', 'RECRUIT'],
    ['crew', 'APPLICANTS'],
    ['startAt', 'START_AT'],
    ['form', 'FORM'],
    ['publish', 'VISIBILITY'],
    ['author', 'AUTHOR'],
  ])('열 %s의 두 정렬 방향을 서버에 전달한다', (column, server) => {
    for (const direction of ['asc', 'desc']) {
      expect(new URLSearchParams(query({ sort: `${column}:${direction}` })).get('sort')).toBe(
        `${server}_${direction.toUpperCase()}`,
      );
    }
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

describe('열 머리 정렬 (captain-list-all-studies 9)', () => {
  it('기본 순서 · 모집 마감순은 「모집 상태」 오름차순, 이름순은 「스터디」 오름차순으로 보인다. 최근 등록순은 강조하지 않는다', () => {
    expect(headerSortOf('all')).toEqual({ key: 'recruit', dir: 'asc' });
    expect(headerSortOf('recruitment')).toEqual({ key: 'recruit', dir: 'asc' });
    expect(headerSortOf('title')).toEqual({ key: 'title', dir: 'asc' });
    expect(headerSortOf('id')).toBeNull();
    expect(headerSortOf('crew:desc')).toEqual({ key: 'crew', dir: 'desc' });
  });

  it('누르면 오름차순, 다시 누르면 내림차순 — 서버가 정렬할 수 있는 값으로 접는다', () => {
    expect(nextSortFor('all', 'crew')).toBe('crew:asc');
    expect(nextSortFor('crew:asc', 'crew')).toBe('crew:desc');
    expect(nextSortFor('crew:desc', 'crew')).toBe('crew:asc');
    expect(nextSortFor('crew:desc', 'title')).toBe('title'); // 이름 오름차순 = 서버 TITLE_ASC
    expect(nextSortFor('title', 'title')).toBe('title:desc');
    expect(nextSortFor('all', 'recruit')).toBe('recruit:desc'); // 기본이 이미 모집 상태 오름차순
    expect(nextSortFor('recruit:desc', 'recruit')).toBe('all');
  });

  it('주소의 열 정렬 값은 허용 목록으로 읽는다', () => {
    expect(resolveListFilters({ sort: 'author:desc' }).sort).toBe('author:desc');
    expect(resolveListFilters({ sort: 'nope:asc' }).sort).toBe('all');
  });
});
