import { afterEach, expect, it, vi } from 'vitest';

import { ApiError } from './http';
import { handleUnauthorized } from './query-client';

vi.mock('./auth', () => ({ clearSession: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it('로그인 만료 시 신청 결과의 보기와 모집 회차를 복귀 주소에 보존한다', () => {
  const location = { pathname: '/studies/20', search: '?tab=results&resultsView=individual&recruitmentId=7', href: '' };
  vi.stubGlobal('window', { location });
  handleUnauthorized(new ApiError(401, 'Unauthorized'));
  expect(location.href).toBe(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
});
