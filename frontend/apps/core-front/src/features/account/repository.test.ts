import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLeaveStudies } from './repository';

afterEach(() => vi.unstubAllGlobals());

describe('account withdrawal study check', () => {
  it('separates ongoing study roles and excludes ended, upcoming and captain-only memberships', async () => {
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
            { studyId: 4, title: 'Captain as crew', relation: 'ONGOING', participantRole: 'MEMBER', captain: true },
            { studyId: 5, title: 'Captain only', relation: 'ONGOING', participantRole: null, captain: true },
            ...(['MEMBER', 'LEADER'] as const).flatMap((participantRole, index) =>
              (['UPCOMING', 'COMPLETED', 'WITHDRAWN'] as const).map((relation, offset) => ({
                studyId: 10 + index * 3 + offset,
                title: `${participantRole} ${relation}`,
                relation,
                participantRole,
              })),
            ),
          ],
        }),
      }),
    );
    await expect(getLeaveStudies()).resolves.toEqual({
      status: 'ok',
      crewStudies: [
        { studyId: 3, title: 'Member' },
        { studyId: 4, title: 'Captain as crew' },
      ],
      navigatorStudies: [{ studyId: 1, title: 'Active' }],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/me/studies'), {
      credentials: 'include',
      cache: 'no-store',
    });
  });
  it('distinguishes a failed check from an empty result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(getLeaveStudies()).resolves.toEqual({ status: 'unknown' });
  });

  it('returns confirmed empty lists when the account has no studies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [] }) }));
    await expect(getLeaveStudies()).resolves.toEqual({ status: 'ok', crewStudies: [], navigatorStudies: [] });
  });

  it('preserves withdrawal for an onboarding-incomplete account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(getLeaveStudies()).resolves.toEqual({ status: 'ok', crewStudies: [], navigatorStudies: [] });
  });

  it.each([401, 500])('does not interpret HTTP %s as an empty membership list', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
    await expect(getLeaveStudies()).resolves.toEqual({ status: 'unknown' });
  });

  it('does not silently drop a study whose role could not be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [{ studyId: 1, title: 'Unknown role', relation: 'ONGOING' }] }),
      }),
    );
    await expect(getLeaveStudies()).resolves.toEqual({ status: 'unknown' });
  });
});
