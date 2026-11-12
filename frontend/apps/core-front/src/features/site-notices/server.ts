import type { ApiPage } from '@studyclub/mock/msw';

import { fetchNotice, fetchNotices } from './repository';
import type { ApiSiteNoticeDetail, ApiSiteNoticeSummary } from './types';

/** 사이트 공지 목록 한 쪽. API 가 실패하면 null — 빈 목록으로 주면 화면이 「공지 없음」·없는 쪽 404 와 구분하지 못한다. */
export async function getNotices(offset: number, limit: number): Promise<ApiPage<ApiSiteNoticeSummary> | null> {
  try {
    return await fetchNotices(offset, limit);
  } catch (e) {
    console.error('[content] GET /api/notices failed:', e);
    return null;
  }
}

/** 공지 한 건. 없거나 삭제됐으면 null(화면이 404). 서버 장애면 'failed' — 없는 공지로 위장하지 않고 화면이 오류 안내를 그린다. */
export async function getNotice(noticeId: string): Promise<ApiSiteNoticeDetail | null | 'failed'> {
  try {
    return await fetchNotice(noticeId);
  } catch (e) {
    console.error(`[content] GET /api/notices/${noticeId} failed:`, e);
    return 'failed';
  }
}
