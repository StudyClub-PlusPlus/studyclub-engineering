import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { blockHistoryNavigation, trackHistoryNavigation } from './history-guard';

const key = 'studyclubHistoryIndex';

describe('history-guard', () => {
  let untrack: () => void;
  let unblock: (() => void) | undefined;
  beforeEach(() => {
    untrack = trackHistoryNavigation();
  });
  afterEach(() => {
    unblock?.();
    unblock = undefined;
    untrack();
  });

  it('해시 이동으로 생긴 항목에도 위치 번호를 붙인다', async () => {
    const start = window.history.state[key] as number;
    window.location.hash = `#h${Date.now()}`;
    await waitFor(() => expect(window.history.state?.[key]).toBe(start + 1));
  });

  it('이동을 이어간 뒤에도 다음 뒤로가기를 다시 막는다', async () => {
    window.history.pushState(null, '', '/a');
    window.history.pushState(null, '', '/b');
    const blocker = vi.fn<(resume: () => void) => void>();
    unblock = blockHistoryNavigation(blocker);

    window.history.back();
    await waitFor(() => expect(blocker).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe('/b');

    blocker.mock.calls[0]![0]();
    await waitFor(() => expect(window.location.pathname).toBe('/a'));

    window.history.back();
    await waitFor(() => expect(blocker).toHaveBeenCalledTimes(2));
    expect(window.location.pathname).toBe('/a');
  });
});
