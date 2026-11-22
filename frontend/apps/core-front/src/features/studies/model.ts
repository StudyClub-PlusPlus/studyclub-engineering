import { type Study, type StudyStatus } from '@studyclub/types';
import { CATEGORY_DISPLAY } from '@studyclub/utils';
import { seoulDate } from '@studyclub/utils';

import type { ApiStudy, ApiStudyDetail, StudySearch } from './types';


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
