import { cookies } from 'next/headers';

import { CATEGORY_DISPLAY, type Study, type StudyLifecycleStatus, type StudyStatus } from '@studyclub/mock';

import { ACCESS_COOKIE } from '@/lib/cookie-names';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type ApiStudy = {
  studyId: number;
  programId: number;
  title: string;
  category: string;
  studyKind: string;
  status: string;
  recruitmentCapacity: number | null;
  currentApplicants: number;
  /** 서버 판정 (specs/study-recruit-status). OPEN 이 아니면 null. */
  recruitStatus: 'RECRUITING' | 'RECRUIT_CLOSED' | null;
  recruitmentStartAt: string | null;
  recruitDeadlineAt: string | null;
  startAt: string | null;
  timezone: string | null;
  hasApplicationForm: boolean;
};

type ApiPage = {
  items: ApiStudy[];
  total: number;
  offset: number;
  limit: number;
};

function mapLifecycleStatus(status: string): StudyLifecycleStatus {
  if (status === 'OPEN' || status === 'ONGOING' || status === 'ENDED' || status === 'CLOSED') return status;
  // 서버 enum 밖의 값 = 백엔드·프론트 배포가 어긋났다. 공개된 것처럼 보이지 않게 비공개로 둔다
  if (status !== 'DRAFT') console.error('[admin/studies] 알 수 없는 STUDY.STATUS — 비공개로 취급:', status);
  return 'DRAFT';
}

function mapStatus(status: StudyLifecycleStatus): StudyStatus {
  if (status === 'ONGOING') return 'ongoing';
  if (status === 'ENDED' || status === 'CLOSED') return 'closed';
  return 'recruiting';
}

const TIMEZONE_DISPLAY: Record<string, string> = {
  KST: 'KST',
  PST: 'PST',
  BOTH: '동시 진행(KST·PST)',
};

function mapToStudy(api: ApiStudy): Study {
  const category = CATEGORY_DISPLAY[api.category] ?? api.category;
  const lifecycleStatus = mapLifecycleStatus(api.status);

  return {
    id: String(api.studyId),
    study_id: api.studyId,
    title: { ko: api.title, en: api.title },
    summary: { ko: '', en: '' },
    status: mapStatus(lifecycleStatus),
    lifecycleStatus,
    format: 'online',
    kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    // 목록 API 는 프로그램 제목을 주지 않는다 — 목록은 P-ID 만 쓴다
    program: {
      id: String(api.programId),
      title: { ko: '', en: '' },
      kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    },
    category,
    schedule: api.timezone ? { ko: TIMEZONE_DISPLAY[api.timezone] ?? api.timezone, en: api.timezone } : undefined,
    date: api.startAt?.slice(0, 10),
    published: lifecycleStatus !== 'DRAFT',
    applicantCount: api.currentApplicants,
    hasApplicationForm: api.hasApplicationForm,
    seats:
      api.recruitmentCapacity === null ? undefined : { total: api.recruitmentCapacity, taken: api.currentApplicants },
    recruitment: {
      // 모집 상태는 서버 판정 그대로 — core-front/src/lib/api.ts 와 같은 방식
      status: api.recruitStatus === 'RECRUITING' ? 'open' : 'closed',
      form_url: undefined,
      start: api.recruitmentStartAt?.slice(0, 10),
      // 시각까지 둔다 — 모집 마감순은 같은 날 안에서도 마감 시각으로 가른다(서버 정렬과 같게). 날짜만 쓰는 곳은 toISODate 로 자른다
      deadline: api.recruitDeadlineAt ?? undefined,
      capacity: api.recruitmentCapacity ?? undefined,
    },
  };
}

/** `GET /api/admin/studies` 가 한 번에 주는 최대 행 수 — 서버가 1~100 만 받는다 (specs/dashboard 4.4). */
const PAGE_LIMIT = 100;
/** 나눠 받는 장 수 상한 — 1만 건. 넘으면 잘라 보이지 않고 실패로 알린다. */
const MAX_PAGES = 100;

async function fetchStudyPage(token: string | undefined, offset: number): Promise<ApiPage> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(API_BASE + '/api/admin/studies?offset=' + offset + '&limit=' + PAGE_LIMIT, {
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

    return (await response.json()) as ApiPage;
  }

  throw new Error('스터디 목록을 불러오지 못했습니다.');
}

/**
 * 스터디 관리 목록 — 전부 받아 화면이 거르고 정렬한다(StudiesTable).
 * 서버는 한 번에 100건까지만 주므로 첫 장으로 total 을 알고 나머지 장을 한꺼번에 받는다.
 * 요청 사이에 행이 밀려 같은 스터디가 두 번 오면 하나만 남긴다.
 */
export async function fetchStudies(): Promise<Study[]> {
  // 쿠키를 통째로 넘기지 않는다 — 사이트(sc_) 쿠키도 같이 실려 API 가 다른 앱의 계정으로 판단한다(2026-10-16 stage /studies 403).
  // 백오피스 액세스 토큰만 Authorization 으로 보낸다 (core-front bff 와 같은 방식)
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const first = await fetchStudyPage(token, 0);
  const pageCount = Math.ceil(first.total / PAGE_LIMIT);
  if (pageCount > MAX_PAGES) throw new Error('스터디가 너무 많아 목록을 한 번에 불러올 수 없습니다.');

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => fetchStudyPage(token, (i + 1) * PAGE_LIMIT)),
  );
  const byId = new Map<number, ApiStudy>();
  for (const page of [first, ...rest]) for (const item of page.items) byId.set(item.studyId, item);
  // 받는 사이에 스터디가 지워지면 한 건이 밀려 빠질 수 있다 — 드문 일이라 다시 받지 않고 남겨만 둔다
  if (byId.size < first.total) {
    console.warn(`[admin/studies] total ${first.total} 중 ${byId.size}건만 받았다 — 받는 사이 목록이 바뀌었다`);
  }

  return [...byId.values()].map(mapToStudy);
}
