'use client';

// 관심 스터디(하트) — 로그인(온보딩 완료)했으면 서버(specs/study-bookmark), 아니면 이 브라우저(storage.ts).
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getBookmarks, setBookmarked } from './storage';
import { getUser, USER_CHANGED_EVENT } from '@/features/auth/auth';
import { emptyResponseSchema, http } from '@/lib/http';

const bookmarkListSchema = z.object({ items: z.array(z.object({ studyId: z.number() })) });

// ponytail: 100개까지만 읽는다(서버 limit 상한). 그보다 많이 담는 사람이 생기면 페이지를 이어 받는다
/** GET /api/me/bookmarks — 담은 순서(오래된 것 먼저) */
export async function fetchMyBookmarkIds(): Promise<string[]> {
  const { items } = await http('/api/me/bookmarks?limit=100', bookmarkListSchema);
  return items.map((it) => String(it.studyId));
}

export function saveBookmark(studyId: string, on: boolean): Promise<null> {
  return http(`/api/me/bookmarks/${encodeURIComponent(studyId)}`, emptyResponseSchema, {
    method: on ? 'POST' : 'DELETE',
  });
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(USER_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(USER_CHANGED_EVENT, onChange);
  };
}

/** 서버 북마크 API 는 온보딩을 마친 회원만 부른다(@RequireOnboarding). 그 회원의 id, 아니면 null */
function onboardedUserId(): string | null {
  const user = getUser();
  return user?.onboardingCompletedAt ? String(user.id) : null;
}

export function useBookmarks() {
  const userId = useSyncExternalStore(subscribe, onboardedUserId, () => null);
  const queryClient = useQueryClient();
  // 키에 회원 id 를 넣는다 — 같은 탭에서 다른 계정으로 바꿔 로그인해도 앞 사람 하트가 보이지 않는다
  const queryKey = ['bookmarks', userId] as const;
  const server = useQuery({ queryKey, queryFn: fetchMyBookmarkIds, enabled: userId !== null });

  // 로그인 전 값은 서버 렌더와 어긋나지 않게 마운트 뒤에 읽는다
  const [local, setLocal] = useState<string[] | null>(null);
  useEffect(() => setLocal(getBookmarks()), [userId]);

  const ids = userId ? server.data : local;

  async function toggle(studyId: string, on: boolean) {
    if (!userId) {
      setBookmarked(studyId, on);
      setLocal(getBookmarks());
      return;
    }
    queryClient.setQueryData<string[]>(queryKey, (prev = []) => [
      ...prev.filter((x) => x !== studyId),
      ...(on ? [studyId] : []),
    ]);
    try {
      await saveBookmark(studyId, on);
    } catch {
      await queryClient.invalidateQueries({ queryKey });
    }
  }

  return { ids: ids ?? [], ready: ids !== undefined && ids !== null, toggle };
}
