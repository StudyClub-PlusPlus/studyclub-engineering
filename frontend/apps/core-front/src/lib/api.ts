// 백엔드 API 클라이언트.
// `fetchStudies` 는 서버(SSR · route handler)에서 호출한다 — 서버 내부 URL 을 우선 쓴다.
// `searchStudies` 는 브라우저에서 호출한다 — 같은 출처의 `/api/studies` route handler 를 거친다.
import { CATEGORY_DISPLAY, type Study, type StudyFormat, type StudyStatus } from '@studyclub/mock';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export type StudyPhaseFilter = 'recruiting' | 'ongoing' | 'closed';
export type StudyTimezoneFilter = 'KST' | 'PST' | 'both';
export type StudySort = 'default' | 'deadline' | 'participants' | 'ended' | 'completion';

/** 스터디 목록 조건. 전부 선택 — 비우면 그 조건을 걸지 않는다. `category` 는 API enum 값(`AI_ML` …). */
export type StudySearch = {
  keyword?: string;
  status?: StudyPhaseFilter;
  timezone?: StudyTimezoneFilter;
  category?: string;
  sort?: StudySort;
};

type ApiStudy = {
  studyId: number;
  slug: string;
  title: string;
  oneLineSummary: string;
  category: string;
  studyKind: 'STUDY' | 'CLUB';
  thumbnailUrl: string | null;
  schedule: string | null;
  timezone: 'KST' | 'PST' | 'BOTH';
  status: 'OPEN' | 'CLOSED';
  phase: 'RECRUITING' | 'ONGOING' | 'CLOSED';
  recruitStatus: 'RECRUITING' | 'RECRUIT_CLOSED' | null;
  deliveryFormat: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  capacity: number | null;
  currentApplicants: number;
  participantCount: number;
  completionRate: number | null;
  recruitDeadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  closingSoon: boolean;
};

type ApiPage<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

const PHASE_STATUS: Record<ApiStudy['phase'], StudyStatus> = {
  RECRUITING: 'recruiting',
  ONGOING: 'ongoing',
  CLOSED: 'closed',
};

function l10n(text: string): { ko: string; en: string } {
  return { ko: text, en: text };
}

export function toStudy(api: ApiStudy): Study {
  return {
    id: api.slug,
    study_id: api.studyId,
    title: l10n(api.title),
    summary: l10n(api.oneLineSummary),
    status: PHASE_STATUS[api.phase],
    format: api.deliveryFormat.toLowerCase() as StudyFormat,
    kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    category: CATEGORY_DISPLAY[api.category] ?? api.category,
    image: api.thumbnailUrl ?? undefined,
    schedule: api.schedule ? l10n(api.schedule) : undefined,
    date: api.endAt?.slice(0, 10),
    start_at: api.startAt ?? undefined,
    seats: api.capacity ? { total: api.capacity, taken: api.currentApplicants } : undefined,
    recruitment: {
      status: api.recruitStatus !== 'RECRUITING' ? 'closed' : api.recruitDeadlineAt ? 'open' : 'always',
      deadline: api.recruitDeadlineAt?.slice(0, 10),
    },
    stats: { participants: api.participantCount, completion_rate: api.completionRate ?? undefined },
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
  if (search.sort && search.sort !== 'default') q.set('sort', search.sort.toUpperCase());
  return q;
}

/** 서버 전용. 실패하면 던진다 — 호출자가 mock fallback 이나 에러 응답을 고른다. */
export async function fetchStudies(search: StudySearch = {}): Promise<Study[]> {
  const res = await fetch(`${API_BASE}/api/studies?${studyQuery(search)}`, {
    next: { revalidate: 60 }, // ISR: 60초마다 갱신
  });
  if (!res.ok) throw new Error(`GET /api/studies failed: ${res.status}`);

  const page: ApiPage<ApiStudy> = await res.json();
  return page.items.map(toStudy);
}

/** 브라우저 전용 — 필터를 바꿀 때 호출한다. 조건은 route handler 가 그대로 백엔드에 넘긴다. */
export async function searchStudies(search: StudySearch, signal?: AbortSignal): Promise<Study[]> {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) if (value) q.set(key, value);
  const res = await fetch(`/api/studies?${q}`, { signal });
  if (!res.ok) throw new Error(`GET /api/studies failed: ${res.status}`);
  return res.json();
}
