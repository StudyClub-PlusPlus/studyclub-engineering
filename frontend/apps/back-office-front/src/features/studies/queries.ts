// 스터디 조회 — 키·fetcher·훅을 한 파일에 둔다.
//
// 키를 딕셔너리 하나에 모으지 않는다. 그건 도메인이 수십 개라 이름이 충돌할 때 필요한 장치다.
// 여기서는 **이 기능을 고치는 사람이 이 파일만 열면 되는 것**이 더 중요하다.
import { useQuery } from '@tanstack/react-query';

import { toRow, type ApiStudyPage, type StudyFilter, type StudyRow } from '@/features/studies/types';
import { http, qs } from '@/lib/http';

/**
 * 키는 넓은 것에서 좁은 것으로 쌓는다 — `['studies']` 를 무효화하면 아래가 전부 딸려 간다.
 * 필터를 키에 넣으므로 조건이 바뀌면 자연히 다른 캐시가 된다.
 */
export const studyKeys = {
  all: ['studies'] as const,
  list: (filter: StudyFilter) => [...studyKeys.all, 'list', filter] as const,
};

/**
 * ⚠️ 규약 예외 — 백오피스는 `/api/admin` 을 불러야 하지만, 백오피스 전용 목록 API 는
 * 다른 담당자가 개발 예정이라 사용자 목록 API 를 중계해 쓴다 (`app/api/studies/route.ts`).
 * 그래서 **공개된 스터디만** 온다.
 */
function fetchStudies(filter: StudyFilter): Promise<ApiStudyPage> {
  return http<ApiStudyPage>(
    `/api/studies${qs({ keyword: filter.keyword, category: filter.category, status: filter.phase, limit: 100 })}`,
  );
}

export function useStudies(filter: StudyFilter) {
  return useQuery({
    queryKey: studyKeys.list(filter),
    queryFn: () => fetchStudies(filter),
    select: (page): { rows: StudyRow[]; total: number } => ({
      rows: page.items.map(toRow),
      total: page.total,
    }),
    // 타이핑 중 이전 결과를 지우지 않는다 — 목록이 깜빡이면 지금 뭘 보고 있었는지 잃는다.
    placeholderData: (previous) => previous,
  });
}
