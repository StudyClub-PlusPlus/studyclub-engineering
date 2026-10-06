import { CATEGORY_DISPLAY, type Study, type StudyLifecycleStatus, type StudyStatus } from '@studyclub/mock';

import { cookies } from 'next/headers';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type ApiStudy = {
  studyId: number;
  title: string;
  category: string;
  studyKind: string;
  status: string;
  recruitmentCapacity: number | null;
  currentApplicants: number;
  recruitmentStartAt: string | null;
  recruitDeadlineAt: string | null;
  startAt: string | null;
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
  return 'DRAFT';
}

function mapStatus(status: StudyLifecycleStatus): StudyStatus {
  if (status === 'ONGOING') return 'ongoing';
  if (status === 'ENDED' || status === 'CLOSED') return 'closed';
  return 'recruiting';
}

function mapToStudy(api: ApiStudy): Study {
  const category = CATEGORY_DISPLAY[api.category] ?? api.category;
  const lifecycleStatus = mapLifecycleStatus(api.status);
  const isClosed = api.status === 'ENDED' || api.status === 'CLOSED';

  return {
    id: String(api.studyId),
    title: { ko: api.title, en: api.title },
    summary: { ko: '', en: '' },
    status: mapStatus(lifecycleStatus),
    lifecycleStatus,
    format: 'online',
    kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    category,
    date: api.startAt?.slice(0, 10),
    published: api.status !== 'DRAFT',
    applicantCount: api.currentApplicants,
    seats:
      api.recruitmentCapacity === null
        ? undefined
        : { total: api.recruitmentCapacity, taken: api.currentApplicants },
    recruitment: {
      status: isClosed ? 'closed' : 'open',
      form_url: api.hasApplicationForm ? '#' : undefined,
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
