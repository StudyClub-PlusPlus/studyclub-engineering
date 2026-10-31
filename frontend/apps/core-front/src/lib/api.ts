// 백엔드 API 클라이언트 — **서버 전용**.
// `fetchStudies` 는 서버 컴포넌트가 첫 화면을 그릴 때 쓴다(컨테이너 내부 URL + ISR).
// 브라우저 조회는 `features/studies/queries.ts` 가 백엔드를 직접 부른다.
import { CATEGORY_DISPLAY, type Study, type StudyStatus } from '@studyclub/mock';
import type { ApiPage, ApiStudy, ApiStudyApplicationForm, ApiStudyDetail } from '@studyclub/mock/msw';

import { seoulDate } from './seoul-date';

export type { ApiPage, ApiStudy, ApiStudyApplicationForm, ApiStudyDetail };

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export type StudyPhaseFilter = 'recruiting' | 'ongoing' | 'closed';
export type StudyTimezoneFilter = 'KST' | 'PST' | 'both';

/** 스터디 목록 조건. 전부 선택 — 비우면 그 조건을 걸지 않는다. `category` 는 API enum 값(`AI_ML` …). */
export type StudySearch = {
  keyword?: string;
  status?: StudyPhaseFilter;
  timezone?: StudyTimezoneFilter;
  category?: string;
};

const PHASE_STATUS: Record<ApiStudy['phase'], StudyStatus> = {
  RECRUITING: 'recruiting',
  ONGOING: 'ongoing',
  CLOSED: 'closed',
};

function l10n(text: string): { ko: string; en: string } {
  return { ko: text, en: text };
}

/** 응답의 시간대. `null`(미정)은 비워 둔다 — 문구 추정은 `studyTimezone` 이 한다. */
function toTimezone(tz: ApiStudy['timezone']): Study['timezone'] {
  if (tz === 'BOTH') return 'both';
  return tz ?? undefined;
}

export function toStudy(api: ApiStudy): Study {
  return {
    id: String(api.studyId),
    study_id: api.studyId,
    format: 'online', // 진행 방식 컬럼은 V30 에서 삭제 — 전부 온라인
    title: l10n(api.title),
    summary: l10n(api.oneLineSummary),
    status: PHASE_STATUS[api.phase],
    kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    category: CATEGORY_DISPLAY[api.category] ?? api.category,
    image: api.thumbnailUrl ?? undefined,
    schedule: api.schedule ? l10n(api.schedule) : undefined,
    timezone: toTimezone(api.timezone),
    date: api.endAt?.slice(0, 10),
    startAt: api.startAt ?? undefined,
    seats: api.capacity ? { total: api.capacity, taken: api.currentApplicants } : undefined,
    recruitment: {
      status: api.recruitStatus !== 'RECRUITING' ? 'closed' : api.recruitDeadlineAt ? 'open' : 'always',
      deadline: seoulDate(api.recruitDeadlineAt),
    },
  };
}

/** 화면 조건 → 백엔드 쿼리. enum 은 대문자로 올린다. */
export function studyQuery(search: StudySearch): URLSearchParams {
  // ponytail: 목록 화면이 페이지를 나누지 않아 한 번에 100건까지 받는다. 넘으면 무한 스크롤로 offset 을 쓴다
  const q = new URLSearchParams({ limit: '100' });
  const keyword = search.keyword?.trim();
  if (keyword) q.set('keyword', keyword);
  if (search.status) q.set('status', search.status.toUpperCase());
  if (search.timezone) q.set('timezone', search.timezone.toUpperCase());
  if (search.category) q.set('category', search.category);
  return q;
}

/** GET /api/studies — 서버 전용. 실패하면 던진다 — 호출자가 빈 상태나 에러 응답을 고른다. */
export async function fetchStudies(search: StudySearch = {}): Promise<Study[]> {
  const res = await fetch(`${API_BASE}/api/studies?${studyQuery(search)}`, {
    next: { revalidate: 60 }, // ISR: 60초마다 갱신
  });
  if (!res.ok) throw new Error(`GET /api/studies failed: ${res.status}`);

  const page: ApiPage<ApiStudy> = await res.json();
  return page.items.map(toStudy);
}

const LIFECYCLE_STATUS: Record<ApiStudyDetail['status'], StudyStatus> = {
  DRAFT: 'recruiting',
  OPEN: 'recruiting',
  ONGOING: 'ongoing',
  ENDED: 'closed',
  CLOSED: 'closed',
};

export function toStudyFromDetail(api: ApiStudyDetail): Study {
  return {
    id: String(api.id),
    study_id: api.id,
    format: 'online', // 진행 방식 컬럼은 V30 에서 삭제 — 전부 온라인
    title: l10n(api.title),
    summary: l10n(api.oneLineSummary),
    description: api.description ? l10n(api.description) : undefined,
    status: LIFECYCLE_STATUS[api.status],
    kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    category: CATEGORY_DISPLAY[api.category] ?? api.category,
    image: api.thumbnailUrl ?? undefined,
    schedule: api.schedule ? l10n(api.schedule) : undefined,
    timezone: toTimezone(api.timezone),
    startAt: api.startAt ?? undefined,
    discord_url: api.discordChannelUrl ?? undefined,
    driveUrl: api.driveUrl ?? undefined,
    recruitment: {
      status: api.recruitStatus !== 'RECRUITING' ? 'closed' : api.recruitDeadlineAt ? 'open' : 'always',
      deadline: seoulDate(api.recruitDeadlineAt),
    },
  };
}

/** GET /api/studies/{studyId} — 서버 전용. 실패하면 던진다. */
export async function fetchStudy(studyId: number): Promise<Study> {
  const res = await fetch(`${API_BASE}/api/studies/${studyId}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`GET /api/studies/${studyId} failed: ${res.status}`);
  const detail: ApiStudyDetail = await res.json();
  return toStudyFromDetail(detail);
}

// ── 사이트 공지 (specs/site-notice/spec.md) ──────────────────────────────────────
// 등록 즉시 보여야 해서 캐시하지 않는다(no-store). 삭제된 건은 서버가 걸러서 보낸다.

/** 목록 한 건. 상세의 이웃(newer·older)도 같은 모양이다. */
export type ApiSiteNoticeSummary = { noticeId: number; title: string; publishedAt: string };

/** `newer` 는 더 최신(화면의 「다음 공지」), `older` 는 더 오래된 공지(「이전 공지」). 끝이면 null. */
export type ApiSiteNoticeDetail = ApiSiteNoticeSummary & {
  body: string;
  newer: ApiSiteNoticeSummary | null;
  older: ApiSiteNoticeSummary | null;
};

/** GET /api/notices — 서버 전용. 실패하면 던진다. */
export async function fetchNotices(offset: number, limit: number): Promise<ApiPage<ApiSiteNoticeSummary>> {
  const q = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/notices?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/notices failed: ${res.status}`);
  return res.json();
}

/**
 * GET /api/notices/{noticeId} — 서버 전용. 없는 ID·삭제된 공지(404)와 숫자가 아닌 주소(400)는 null — 화면이 notFound() 를 낸다.
 * 그 밖의 실패는 던진다 — 서버가 죽었을 때 「없는 공지」로 보이면 안 된다.
 */
export async function fetchNotice(noticeId: string): Promise<ApiSiteNoticeDetail | null> {
  const res = await fetch(`${API_BASE}/api/notices/${encodeURIComponent(noticeId)}`, { cache: 'no-store' });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`GET /api/notices/${noticeId} failed: ${res.status}`);
  return res.json();
}

// 브라우저에서의 조회는 features/studies/queries.ts, features/applications/queries.ts 가 한다 — 백엔드를 직접 부른다.
// 중계(route handler)를 두지 않는다: 하는 일이 "그대로 넘기기"뿐이라 파일만 는다.
