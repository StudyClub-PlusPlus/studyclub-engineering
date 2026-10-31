import type { Study, StudyLifecycleStatus, StudyStatus } from '@studyclub/types';
import { CATEGORY_DISPLAY } from '@studyclub/utils';

import type { ApiStudy } from '@/features/studies/server';

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

export function mapToStudy(api: ApiStudy): Study {
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
    timezone: api.timezone === 'BOTH' ? 'both' : (api.timezone ?? undefined),
    date: api.startAt?.slice(0, 10),
    published: lifecycleStatus !== 'DRAFT',
    applicantCount: api.currentApplicants,
    hasApplicationForm: api.hasApplicationForm,
    authorNickname: api.authorNickname ?? undefined,
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
