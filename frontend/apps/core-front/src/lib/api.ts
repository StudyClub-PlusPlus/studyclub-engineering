// TODO(api): 백엔드 API 클라이언트.
// Server Component(SSR)에서 호출. 서버 내부 URL 을 우선 쓴다.
import { CATEGORY_DISPLAY, type Study, type StudyStatus, type StudyFormat } from '@studyclub/mock';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type ApiCohort = {
  cohortId: number;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  deliveryFormat: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  capacity: number | null;
  currentApplicants: number;
  recruitDeadline: string;
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

type ApiPage<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

function mapStatus(cohortStatus: string): StudyStatus {
  switch (cohortStatus) {
    case 'OPEN': return 'recruiting';
    case 'DRAFT': return 'recruiting'; // 모집 예정도 "모집중" 버킷
    case 'CLOSED': return 'closed';
    default: return 'closed';
  }
}

function mapFormat(format: string): StudyFormat {
  return (format.toLowerCase() as StudyFormat) ?? 'online';
}

function mapToStudy(api: ApiStudy): Study {
  const categoryDisplay = CATEGORY_DISPLAY[api.category] ?? api.category;
  const deadline = api.cohort.recruitDeadline?.slice(0, 10);

  return {
    id: api.slug,
    title: { ko: api.title, en: api.title },
    summary: { ko: '', en: '' },
    status: mapStatus(api.cohort.status),
    format: mapFormat(api.cohort.deliveryFormat),
    kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    category: categoryDisplay,
    image: api.thumbnailUrl ?? undefined,
    seats: api.cohort.capacity
      ? { total: api.cohort.capacity, taken: api.cohort.currentApplicants }
      : undefined,
    recruitment: {
      status: api.cohort.status === 'CLOSED' ? 'closed' : 'open',
      deadline,
    },
  };
}

export async function fetchStudies(): Promise<Study[]> {
  const res = await fetch(`${API_BASE}/api/studies?size=100`, {
    next: { revalidate: 60 }, // ISR: 60초마다 갱신
  });

  if (!res.ok) {
    console.error(`[api] GET /api/studies failed: ${res.status}`);
    return [];
  }

  const page: ApiPage<ApiStudy> = await res.json();
  return page.items.map(mapToStudy);
}
