import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { USER_KEY } from '@/features/auth/auth';
import { syncProfileTimeZone, useDisplayTimeZone } from './use-display-timezone';

const session = (timeZone: string | null) =>
  window.localStorage.setItem(
    USER_KEY,
    JSON.stringify({ id: 6, email: 'a@b.c', nickname: null, picture: null, role: 'ADMIN', timeZone }),
  );
const me = (body: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));

function Zone() {
  return <span>{useDisplayTimeZone()}</span>;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('백오피스를 열 때 프로필 시간대 반영', () => {
  it('로그인 뒤 사이트에서 바꾼 시간대가 다시 로그인하지 않아도 화면 기준이 된다', async () => {
    session('Asia/Seoul');
    me({ id: 6, timeZone: 'America/Los_Angeles' });
    render(<Zone />);
    expect(screen.getByText('Asia/Seoul')).toBeTruthy();

    await act(() => syncProfileTimeZone());

    expect(screen.getByText('America/Los_Angeles')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(USER_KEY)!).id).toBe(6);
  });

  it('프로필을 못 읽으면 로그인 때 받은 시간대를 그대로 쓴다', async () => {
    session('Asia/Seoul');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<Zone />);

    await act(() => syncProfileTimeZone());

    expect(screen.getByText('Asia/Seoul')).toBeTruthy();
  });

  it('로그인 전에는 프로필을 읽지 않는다', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await syncProfileTimeZone();
    expect(fetch).not.toHaveBeenCalled();
  });
});
