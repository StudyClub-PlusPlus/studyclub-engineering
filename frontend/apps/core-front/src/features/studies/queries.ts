// 스터디 목록 조회 — 키·fetcher·훅을 한곳에. 브라우저가 백엔드를 직접 부른다.
import { useQuery } from '@tanstack/react-query';

import { studyQuery, toStudy, type ApiPage, type ApiStudy, type StudySearch } from '@/lib/api';
import type { Study } from '@/lib/content';
import { http } from '@/lib/http';

export const studyKeys = {
  all: ['studies'] as const,
  list: (search: StudySearch) => [...studyKeys.all, 'list', search] as const,
};

/**
 * 목록. 공개 API 라 로그인 없이도 받는다.
 *
 * `initial` 은 서버가 기본 조건으로 이미 받아 둔 첫 화면이다 — 같은 조건이면 요청을 한 번 더 보내지
 * 않도록 `initialData` 로 심는다. 필터를 건드리면 키가 달라져 자연히 새로 받는다.
 */
export function useStudies(search: StudySearch, initial?: Study[]) {
  const isDefault = Object.values(search).every((v) => v === undefined);
  return useQuery({
    queryKey: studyKeys.list(search),
    queryFn: async () => {
      const page = await http<ApiPage<ApiStudy>>(`/api/studies?${studyQuery(search)}`);
      return page.items.map(toStudy);
    },
    initialData: isDefault ? initial : undefined,
    // 필터를 바꾸는 동안 이전 목록을 지우지 않는다 — 비었다 다시 차면 어디를 보고 있었는지 잃는다
    placeholderData: (previous) => previous,
  });
}
