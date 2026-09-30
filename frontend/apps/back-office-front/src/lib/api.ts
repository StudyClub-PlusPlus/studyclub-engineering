import { CATEGORY_DISPLAY, type Study, type StudyFormat, type StudyStatus } from '@studyclub/mock';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type ApiCohort = {
  cohortId: number;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | string;
  deliveryFormat: 'ONLINE' | 'OFFLINE' | 'HYBRID' | string;
  capacity: number | null;
  currentApplicants: number;
  recruitDeadline: string | null;
  startDate: string | null;
  closingSoon: boolean;
};

type ApiStudy = {
  studyId: number;
  slug: string;
  title: string;
  category: string;
  thumbnailUrl: string | null;
  studyKind: string;
  cohort: ApiCohort;
};

type ApiPage = {
  items: ApiStudy[];
  total: number;
  offset: number;
  limit: number;
};

function mapStatus(status: string): StudyStatus {
  if (status === 'OPEN') return 'recruiting';
  if (status === 'CLOSED') return 'closed';
  return 'recruiting';
}

function mapFormat(format: string): StudyFormat {
  const normalized = format.toLowerCase();
  if (normalized === 'offline') return 'offline';
  if (normalized === 'hybrid') return 'hybrid';
  return 'online';
}

function mapToStudy(api: ApiStudy): Study {
  const cohort = api.cohort;
  const category = CATEGORY_DISPLAY[api.category] ?? api.category;
  const isClosed = cohort.status === 'CLOSED';

  return {
    id: String(api.studyId),
    title: { ko: api.title, en: api.title },
    summary: { ko: '', en: '' },
    status: mapStatus(cohort.status),
    format: mapFormat(cohort.deliveryFormat),
    kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    category,
    image: api.thumbnailUrl ?? undefined,
    date: cohort.startDate?.slice(0, 10),
    published: cohort.status !== 'DRAFT',
    applicantCount: cohort.currentApplicants,
    seats:
      cohort.capacity === null
        ? undefined
        : { total: cohort.capacity, taken: cohort.currentApplicants },
    recruitment: {
      status: isClosed ? 'closed' : 'open',
      deadline: cohort.recruitDeadline?.slice(0, 10),
      capacity: cohort.capacity ?? undefined,
    },
  };
}

export async function fetchStudies(): Promise<Study[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(API_BASE + '/api/studies?offset=0&limit=1000', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('스터디 목록을 불러오지 못했습니다. (' + response.status + ')');
      }

      const page = (await response.json()) as ApiPage;
      return page.items.map(mapToStudy);
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('스터디 목록을 불러오지 못했습니다.');
}
