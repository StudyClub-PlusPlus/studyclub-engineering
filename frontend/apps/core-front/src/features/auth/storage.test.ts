import { beforeEach, describe, expect, it } from 'vitest';

import { getUser } from './auth';
import { getApplications } from '@/features/applications/storage';
import { getBookmarks } from '@/features/bookmarks/storage';

beforeEach(() => localStorage.clear());
describe('persisted user input validation', () => {
  it('rejects valid JSON with an invalid session shape', () => {
    localStorage.setItem('sc_user', JSON.stringify({ id: '1', nickname: [] }));
    expect(getUser()).toBeNull();
  });
  it('rejects mixed bookmark arrays', () => {
    localStorage.setItem('sc_bookmarks', JSON.stringify(['12', 13]));
    expect(getBookmarks()).toEqual([]);
  });
  it('rejects incomplete application snapshots', () => {
    localStorage.setItem('sc_applications', JSON.stringify([{ studyId: '1' }]));
    expect(getApplications()).toEqual([]);
  });
});
