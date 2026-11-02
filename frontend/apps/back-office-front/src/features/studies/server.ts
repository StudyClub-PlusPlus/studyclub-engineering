import { cookies } from 'next/headers';

import { z } from 'zod';

import type { StudyListData } from '@/features/studies/list-filters';
import { mapToStudy } from '@/features/studies/model';
import { ACCESS_COOKIE } from '@/lib/cookie-names';
import { ApiResponseError } from '@/lib/http';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

const apiStudySchema = z.object({
  studyId: z.number(),
  programId: z.number(),
  title: z.string(),
  category: z.string(),
  studyKind: z.string(),
  status: z.string(),
  recruitmentCapacity: z.number().nullable(),
  currentApplicants: z.number(),
  recruitStatus: z.enum(['RECRUITING', 'RECRUIT_CLOSED']).nullable(),
  recruitmentStartAt: z.string().nullable(),
  recruitDeadlineAt: z.string().nullable(),
  startAt: z.string().nullable(),
  timezone: z.enum(['KST', 'PST', 'BOTH']).nullable(),
  hasApplicationForm: z.boolean(),
  authorNickname: z.string().nullable(),
});
const apiPageSchema = z.object({
  items: z.array(apiStudySchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number().positive(),
});
export type ApiStudy = z.infer<typeof apiStudySchema>;
type ApiPage = z.infer<typeof apiPageSchema>;

/** `query` 는 `offset`·`limit` 를 포함한 목록 Query. 연결 실패 · 502~504 는 두 번까지 다시 시도한다. */
async function fetchStudyPage(token: string | undefined, query: string): Promise<ApiPage> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(API_BASE + '/api/admin/studies?' + query, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch (error) {
      // Only retry connection failures from fetch, never parsing or mapping errors.
      if (!(error instanceof TypeError) || attempt === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }

    if (!response.ok) {
      const retryable = [502, 503, 504].includes(response.status);
      if (retryable && attempt < maxRetries) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        continue;
      }
      throw new Error('스터디 목록을 불러오지 못했습니다. (' + response.status + ')');
    }

    try {
      return apiPageSchema.parse(await response.json());
    } catch (error) {
      throw new ApiResponseError(error);
    }
  }

  throw new Error('스터디 목록을 불러오지 못했습니다.');
}

/** 쿠키를 통째로 넘기지 않는다 — 사이트(sc_) 쿠키도 같이 실려 API 가 다른 앱의 계정으로 판단한다(2026-10-16 stage /studies 403).
 * 백오피스 액세스 토큰만 Authorization 으로 보낸다 (core-front bff 와 같은 방식) */
async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

/**
 * 스터디 관리 목록 한 페이지 — 서버가 거르고 정렬해 자른다 (specs/dashboard 4.4).
 * `query` 는 features/studies/list-filters 의 serverListQuery 가 만든다. 끝을 넘는 페이지면 서버가 빈 items 와
 * 실제 total 을 주므로 마지막 페이지를 다시 받는다 — 지워진 뒤 뒤로 가기로 온 주소가 빈 표가 되지 않게.
 */
export async function fetchStudyListPage(query: string): Promise<StudyListData & { mode: 'server' }> {
  const token = await accessToken();
  let page = await fetchStudyPage(token, query);
  if (page.items.length === 0 && page.total > 0 && page.offset > 0) {
    const lastOffset = Math.floor((page.total - 1) / page.limit) * page.limit;
    const params = new URLSearchParams(query);
    params.set('offset', String(lastOffset));
    page = await fetchStudyPage(token, params.toString());
  }
  return {
    mode: 'server',
    studies: page.items.map(mapToStudy),
    total: page.total,
    offset: page.offset,
    limit: page.limit,
  };
}
