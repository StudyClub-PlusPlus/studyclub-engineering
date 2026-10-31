import { afterEach, describe, expect, it, vi } from 'vitest';

import { getActiveNavigatorStudies } from './repository';

afterEach(() => vi.unstubAllGlobals());

describe('account withdrawal navigator check', () => {
  it('includes only ongoing studies led by the account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { studyId: 1, title: 'Active', relation: 'ONGOING', participantRole: 'LEADER' },
            { studyId: 2, title: 'Upcoming', relation: 'UPCOMING', participantRole: 'LEADER' },
            { studyId: 3, title: 'Member', relation: 'ONGOING', participantRole: 'MEMBER' },
          ],
        }),
      }),
    );
    await expect(getActiveNavigatorStudies()).resolves.toEqual({
      status: 'ok',
      studies: [{ studyId: 1, title: 'Active' }],
    });
  });
  it('distinguishes a failed check from an empty result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(getActiveNavigatorStudies()).resolves.toEqual({ status: 'unknown' });
  });
});
