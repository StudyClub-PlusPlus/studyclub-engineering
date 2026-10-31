import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const logout = vi.hoisted(() => vi.fn());
vi.mock('@/features/auth/auth', () => ({ logout }));

let handleUnauthorized: typeof import('./query-client').handleUnauthorized;
let ApiError: typeof import('./http').ApiError;
const location = {
  pathname: '/studies/20',
  search: '?tab=results&resultsView=individual&recruitmentId=7',
  replace: vi.fn(),
};

beforeEach(async () => {
  vi.resetModules();
  logout.mockReset().mockResolvedValue(undefined);
  location.pathname = '/studies/20';
  location.replace.mockReset();
  vi.stubGlobal('window', { location });
  ({ ApiError } = await import('./http'));
  ({ handleUnauthorized } = await import('./query-client'));
});

afterEach(() => vi.unstubAllGlobals());

it('쿠키 정리가 끝난 후 로그인으로 이동하고 원래 경로와 필터를 보존한다', async () => {
  let finish!: () => void;
  logout.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
  const pending = handleUnauthorized(new ApiError(401, 'Unauthorized'));
  expect(logout).toHaveBeenCalledOnce();
  expect(location.replace).not.toHaveBeenCalled();
  finish();
  await pending;
  expect(location.replace).toHaveBeenCalledWith(
    `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
  );
});

it('동시 401과 이동 직전 늦게 도착한 401도 정리·이동을 한 번만 실행한다', async () => {
  let finish!: () => void;
  logout.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
  const pending = Array.from({ length: 6 }, () => handleUnauthorized(new ApiError(401, 'Unauthorized')));
  expect(logout).toHaveBeenCalledOnce();
  finish();
  await Promise.all(pending);
  await handleUnauthorized(new ApiError(401, 'Late response'));
  expect(logout).toHaveBeenCalledOnce();
  expect(location.replace).toHaveBeenCalledOnce();
});

it('세션 정리에 실패해도 로그인 화면을 연다', async () => {
  logout.mockRejectedValue(new Error('Storage unavailable'));
  await expect(handleUnauthorized(new ApiError(401, 'Unauthorized'))).resolves.toBeUndefined();
  expect(location.replace).toHaveBeenCalledOnce();
});

it.each([403, 500])('%i는 세션을 지우거나 로그인으로 이동하지 않는다', async (status) => {
  await handleUnauthorized(new ApiError(status, 'Request failed'));
  expect(logout).not.toHaveBeenCalled();
  expect(location.replace).not.toHaveBeenCalled();
});

it('로그인 화면의 실패는 자기 자신으로 다시 이동하지 않는다', async () => {
  location.pathname = '/login';
  await handleUnauthorized(new ApiError(401, 'Unauthorized'));
  expect(logout).not.toHaveBeenCalled();
  expect(location.replace).not.toHaveBeenCalled();
});

it('서버에서 발생한 401은 브라우저 세션 처리를 실행하지 않는다', async () => {
  vi.stubGlobal('window', undefined);
  await handleUnauthorized(new ApiError(401, 'Unauthorized'));
  expect(logout).not.toHaveBeenCalled();
});
