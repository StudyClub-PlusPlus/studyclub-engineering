import { beforeEach, describe, expect, it } from 'vitest';

import { clearMyLocalData, dropLegacyDemoSeed } from './local-state';
import { addApplication, getApplications } from '@/features/applications/storage';
import { getBookmarks, setBookmarked } from '@/features/bookmarks/storage';

beforeEach(() => localStorage.clear());
describe('account local data cleanup', () => {
  it('clears member caches without deleting the auth session owned by logout', () => {
    setBookmarked('1', true);
    addApplication({ studyId: '1', appliedAt: '2026-10-31', status: 'pending', region: 'KR' });
    localStorage.setItem('sc_user', 'session');
    clearMyLocalData();
    expect(getBookmarks()).toEqual([]);
    expect(getApplications()).toEqual([]);
    expect(localStorage.getItem('sc_user')).toBe('session');
  });
  it('only removes legacy seeded bookmarks when the seed marker exists', () => {
    setBookmarked('1', true);
    dropLegacyDemoSeed();
    expect(getBookmarks()).toEqual(['1']);
    localStorage.setItem('sc_demo_seed', 'true');
    dropLegacyDemoSeed();
    expect(getBookmarks()).toEqual([]);
    expect(localStorage.getItem('sc_demo_seed')).toBeNull();
  });
});
