import type { ApiPage } from '@studyclub/mock/msw';

import { apiSiteNoticePageSchema, apiSiteNoticeDetailSchema } from './response-schema';
import type { ApiSiteNoticeDetail, ApiSiteNoticeSummary } from './types';

// 서버 전용 조회. 등록 즉시 보여야 하므로 공지는 캐시하지 않는다.


const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

/** GET /api/notices — 서버 전용. 실패하면 던진다. */
export async function fetchNotices(offset: number, limit: number): Promise<ApiPage<ApiSiteNoticeSummary>> {
  const q = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/notices?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/notices failed: ${res.status}`);
  return apiSiteNoticePageSchema.parse(await res.json());
}

/**
 * GET /api/notices/{noticeId} — 서버 전용. 없는 ID·삭제된 공지(404)와 숫자가 아닌 주소(400)는 null — 화면이 notFound() 를 낸다.
 * 그 밖의 실패는 던진다 — 서버가 죽었을 때 「없는 공지」로 보이면 안 된다.
 */
export async function fetchNotice(noticeId: string): Promise<ApiSiteNoticeDetail | null> {
  const res = await fetch(`${API_BASE}/api/notices/${encodeURIComponent(noticeId)}`, { cache: 'no-store' });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`GET /api/notices/${noticeId} failed: ${res.status}`);
  return apiSiteNoticeDetailSchema.parse(await res.json());
}
