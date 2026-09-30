// 스터디 조회·수정·삭제 — 키·fetcher·훅을 한 파일에 둔다.
//
// 키를 딕셔너리 하나에 모으지 않는다. 그건 도메인이 수십 개라 이름이 충돌할 때 필요한 장치다.
// 여기서는 **이 기능을 고치는 사람이 이 파일만 열면 되는 것**이 더 중요하다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  toRow,
  type ApiStudyDetail,
  type ApiStudyPage,
  type StudyFilter,
  type StudyRow,
  type StudyUpdatePayload,
} from '@/features/studies/types';
import { http, qs } from '@/lib/http';

/**
 * 키는 넓은 것에서 좁은 것으로 쌓는다 — `['studies']` 를 무효화하면 아래가 전부 딸려 간다.
 * 필터를 키에 넣으므로 조건이 바뀌면 자연히 다른 캐시가 된다.
 */
export const studyKeys = {
  all: ['studies'] as const,
  list: (filter: StudyFilter) => [...studyKeys.all, 'list', filter] as const,
  detail: (studyId: number) => [...studyKeys.all, 'detail', studyId] as const,
};

/**
 * ⚠️ 규약 예외 — 백오피스는 `/api/admin` 을 불러야 하지만, 목록은 아직 **사용자 사이트용 목록 API** 를 쓴다.
 * 그래서 **공개된 스터디만** 온다(숨김·DRAFT 제외).
 * 백오피스 목록 `GET /api/admin/studies` 는 있지만 검색어·상태·페이지 조건이 없고 응답 모양(`items` 만)이 달라,
 * 옮기려면 그쪽 조건과 `toRow` 를 함께 맞춰야 한다 — specs/study/spec.md 「관객별 엔드포인트」
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

/**
 * 상세·수정·삭제는 백오피스 경로(`/api/admin/studies/{id}`)를 쓴다 — 캡틴만 통과하고, 상세는 DRAFT 도 보인다.
 * 네비게이터의 수정은 사용자 사이트 경로(`PATCH /api/studies/{id}`)가 따로 받는다. 서버 로직은 같다.
 */
export function useStudyDetail(studyId: number) {
  return useQuery({
    queryKey: studyKeys.detail(studyId),
    queryFn: () => http<ApiStudyDetail>(`/api/admin/studies/${studyId}`),
    retry: false,
  });
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function useUpdateStudy(studyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudyUpdatePayload) =>
      http<null>(`/api/admin/studies/${studyId}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      }),
    // 목록의 정원·마감도 바뀌므로 상세만이 아니라 스터디 전체를 무효화한다
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studyKeys.all }),
  });
}

export function useDeleteStudy(studyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http<null>(`/api/admin/studies/${studyId}`, { method: 'DELETE' }),
    onSuccess: () => {
      // 지워진 상세를 다시 불러오면 404 다 — 무효화하지 않고 캐시에서 뺀다
      queryClient.removeQueries({ queryKey: studyKeys.detail(studyId) });
      return queryClient.invalidateQueries({ queryKey: [...studyKeys.all, 'list'] });
    },
  });
}
