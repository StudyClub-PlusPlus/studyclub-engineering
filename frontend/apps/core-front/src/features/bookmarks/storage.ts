'use client';

import { readJSON, writeJSON } from '@studyclub/utils';
import { z } from 'zod';

/**
 * 로그인 전 관심 스터디 — 이 브라우저에만 남기고 로그아웃할 때 지운다(`clearSession`).
 * 로그인(온보딩 완료)하면 서버에 저장한다 → `features/bookmarks/queries.ts`.
 */
export const BOOKMARK_KEY = 'sc_bookmarks';

export function getBookmarks(): string[] {
  return readJSON(BOOKMARK_KEY, z.array(z.string()), []);
}

export function setBookmarked(studyId: string, on: boolean) {
  const ids = getBookmarks().filter((x) => x !== studyId);
  writeJSON(BOOKMARK_KEY, on ? [...ids, studyId] : ids);
}
