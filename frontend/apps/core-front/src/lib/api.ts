// 백엔드 API 클라이언트 — **서버 전용**.
// `fetchStudies` 는 서버 컴포넌트가 첫 화면을 그릴 때 쓴다(컨테이너 내부 URL + ISR).
// 브라우저 조회는 `features/studies/queries.ts` 가 백엔드를 직접 부른다.
import { CATEGORY_DISPLAY, type Study, type StudyStatus } from '@studyclub/mock';
export type { ApiStudy, ApiStudyDetail, ApiPage } from '@studyclub/mock/msw';
import type { ApiStudy, ApiStudyDetail, ApiPage } from '@studyclub/mock/msw';

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
    date: api.endAt?.slice(0, 10),
    startAt: api.startAt ?? undefined,
    seats: api.capacity ? { total: api.capacity, taken: api.currentApplicants } : undefined,
    recruitment: {
      status: api.recruitStatus !== 'RECRUITING' ? 'closed' : api.recruitDeadlineAt ? 'open' : 'always',
      deadline: api.recruitDeadlineAt?.slice(0, 10),
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

/** TODO(api): GET /api/studies — 서버 전용. 실패하면 던진다 — 호출자가 mock fallback 이나 에러 응답을 고른다. */
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
    startAt: api.startAt ?? undefined,
    discord_url: api.discordChannelUrl ?? undefined,
    driveUrl: api.driveUrl ?? undefined,
    recruitment: {
      status: api.recruitStatus !== 'RECRUITING' ? 'closed' : api.recruitDeadlineAt ? 'open' : 'always',
      deadline: api.recruitDeadlineAt?.slice(0, 10),
    },
  };
}

/** TODO(api): GET /api/studies/{studyId} — 서버 전용. 실패하면 던진다. */
export async function fetchStudy(studyId: number): Promise<Study> {
  const res = await fetch(`${API_BASE}/api/studies/${studyId}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`GET /api/studies/${studyId} failed: ${res.status}`);
  const detail: ApiStudyDetail = await res.json();
  return toStudyFromDetail(detail);
}

// 브라우저에서의 조회는 features/studies/queries.ts 가 한다 — 백엔드를 직접 부른다.
// 중계(route handler)를 두지 않는다: 하는 일이 "그대로 넘기기"뿐이라 파일만 는다.
