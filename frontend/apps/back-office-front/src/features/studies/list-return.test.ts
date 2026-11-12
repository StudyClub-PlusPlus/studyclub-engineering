import { afterEach, describe, expect, it } from 'vitest';

import { rememberStudiesListSearch, studiesListHref } from '@/features/studies/list-return';

afterEach(() => sessionStorage.clear());

describe('스터디 목록으로 돌아가는 주소', () => {
  it('목록이 적어 둔 필터 · 페이지 쿼리를 붙인다', () => {
    rememberStudiesListSearch('?status=OPEN&publish=draft&page=2');
    expect(studiesListHref()).toBe('/studies?status=OPEN&publish=draft&page=2');
  });

  it('조건이 없으면(빈 쿼리) 지우고 기본 목록으로', () => {
    rememberStudiesListSearch('?status=OPEN');
    rememberStudiesListSearch('');
    expect(studiesListHref()).toBe('/studies');
  });

  it('적어 둔 게 없거나 모양이 이상하면 기본 목록으로', () => {
    expect(studiesListHref()).toBe('/studies');
    sessionStorage.setItem('bo:studies-list-search', 'https://evil.example');
    expect(studiesListHref()).toBe('/studies');
  });
});
