'use client';

import { readJSON, writeJSON } from '@studyclub/utils';
import { z } from 'zod';


/** 관심 스터디는 저장 API가 없어 이 브라우저에만 남긴다. */
export const BOOKMARK_KEY = 'sc_bookmarks';

export function getBookmarks(): string[] {
  return readJSON(BOOKMARK_KEY, z.array(z.string()), []);
}

export function setBookmarked(studyId: string, on: boolean) {
  const ids = getBookmarks().filter((x) => x !== studyId);
  writeJSON(BOOKMARK_KEY, on ? [...ids, studyId] : ids);
}
