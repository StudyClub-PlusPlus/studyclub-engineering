import {
  apiSiteNoticeDetailSchema,
  apiSiteNoticePageSchema,
  emptyResponseSchema,
} from '@/features/site-notices/response-schema';
import type { SiteNoticeFilter, SiteNoticePayload } from '@/features/site-notices/types';
import { http, qs } from '@/lib/http';

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

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function siteNotices(filter: SiteNoticeFilter) {
  return http(siteNoticesPath(filter), apiSiteNoticePageSchema);
}

export function siteNotice(noticeId: number | null) {
  return http(`/api/admin/notices/${noticeId}`, apiSiteNoticeDetailSchema);
}

export function createSiteNotice(payload: SiteNoticePayload) {
  return http('/api/admin/notices', emptyResponseSchema, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

export function updateSiteNotice(noticeId: number, payload: SiteNoticePayload) {
  return http(`/api/admin/notices/${noticeId}`, emptyResponseSchema, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

export function deleteSiteNotice(noticeId: number) {
  return http(`/api/admin/notices/${noticeId}`, emptyResponseSchema, { method: 'DELETE' });
}
