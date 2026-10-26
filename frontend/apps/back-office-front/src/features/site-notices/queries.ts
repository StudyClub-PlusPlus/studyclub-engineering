// 백오피스 사이트 공지 — 목록·한 건·등록·수정·삭제. 키·fetcher·훅을 한 파일에 둔다.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ApiSiteNoticeDetail,
  ApiSiteNoticePage,
  SiteNoticeFilter,
  SiteNoticePayload,
} from '@/features/site-notices/types';
import { http, qs } from '@/lib/http';

/** 키는 넓은 것에서 좁은 것으로 쌓는다 — `['site-notices']` 를 무효화하면 목록·한 건이 전부 딸려 간다. */
export const siteNoticeKeys = {
  all: ['site-notices'] as const,
  list: (filter: SiteNoticeFilter) => [...siteNoticeKeys.all, 'list', filter] as const,
  detail: (noticeId: number) => [...siteNoticeKeys.all, 'detail', noticeId] as const,
};

/** 목록 요청 경로. 값이 없는 조건은 넣지 않는다. 기본 정렬(publishedAt desc)은 서버 기본값과 같아 싣지 않는다. */
export function siteNoticesPath(filter: SiteNoticeFilter): string {
  let sort: SiteNoticeFilter['sort'] | undefined = filter.sort;
  if (sort === 'publishedAt') sort = undefined;
  let order: SiteNoticeFilter['order'] | undefined = filter.order;
  if (order === 'desc') order = undefined;
  return `/api/admin/notices${qs({
    q: filter.q?.trim(),
    sort,
    order,
    offset: filter.offset,
    limit: filter.limit,
  })}`;
}

export function useSiteNotices(filter: SiteNoticeFilter) {
  return useQuery({
    queryKey: siteNoticeKeys.list(filter),
    queryFn: () => http<ApiSiteNoticePage>(siteNoticesPath(filter)),
    // 검색·정렬·페이지를 바꾸는 동안 이전 결과를 지우지 않는다 — 표가 깜빡이면 보던 자리를 잃는다
    placeholderData: keepPreviousData,
  });
}

/** 편집 팝업이 열릴 때만 부른다(`enabled`). 목록 행에 본문이 없어서다. */
export function useSiteNotice(noticeId: number | null) {
  return useQuery({
    queryKey: siteNoticeKeys.detail(noticeId ?? 0),
    queryFn: () => http<ApiSiteNoticeDetail>(`/api/admin/notices/${noticeId}`),
    enabled: noticeId !== null,
  });
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** 등록. 성공하면 목록을 다시 받는다 — 응답이 돌아온 순간 사이트에도 올라가 있다. */
export function useCreateSiteNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SiteNoticePayload) =>
      http<null>('/api/admin/notices', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteNoticeKeys.all }),
  });
}

/** 수정. 제목·본문을 둘 다 보낸다 — 팝업이 한 번에 저장하므로 부분 수정이 없다. */
export function useUpdateSiteNotice(noticeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SiteNoticePayload) =>
      http<null>(`/api/admin/notices/${noticeId}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteNoticeKeys.all }),
  });
}

/** 삭제(소프트). 목록만 다시 받는다 — 지워진 한 건을 다시 불러오면 404 라 한 건은 무효화하지 않는다. */
export function useDeleteSiteNotice(noticeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http<null>(`/api/admin/notices/${noticeId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...siteNoticeKeys.all, 'list'] }),
  });
}
