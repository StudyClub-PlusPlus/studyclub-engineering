import { cookies } from 'next/headers';

import { CATEGORY_DISPLAY, type Study, type StudyLifecycleStatus, type StudyStatus } from '@studyclub/mock';


const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type ApiStudy = {
  studyId: number;
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
  KST: '한국 시간 (KST)',
  PST: '태평양 시간 (PST)',
  BOTH: '한국·태평양 시간',
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
      deadline: api.recruitDeadlineAt?.slice(0, 10),
      capacity: api.recruitmentCapacity ?? undefined,
    },
  };
}

export async function fetchStudies(): Promise<Study[]> {
  const cookieHeader = (await cookies()).toString();
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(API_BASE + '/api/admin/studies?offset=0&limit=1000', {
        cache: 'no-store',
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
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

    const page = (await response.json()) as ApiPage;
    return page.items.map(mapToStudy);
  }

  throw new Error('스터디 목록을 불러오지 못했습니다.');
}
