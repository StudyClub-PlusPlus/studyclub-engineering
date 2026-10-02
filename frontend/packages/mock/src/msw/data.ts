import { CATEGORY_DISPLAY, studies as mockStudies } from '..';
import type { Study } from '..';

// ── 스터디 목록/상세 API 타입 ───────────────────────────────────────────
export type ApiStudy = {
  studyId: number;
  title: string;
  oneLineSummary: string;
  category: string;
  studyKind: 'STUDY' | 'CLUB';
  thumbnailUrl: string | null;
  schedule: string | null;
  timezone: 'KST' | 'PST' | 'BOTH' | null;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  phase: 'RECRUITING' | 'ONGOING' | 'CLOSED';
  recruitStatus: 'RECRUITING' | 'RECRUIT_CLOSED';
  capacity: number | null;
  currentApplicants: number;
  recruitDeadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  closingSoon: boolean;
};

export type ApiStudyDetail = {
  id: number;
  programId: number;
  title: string;
  oneLineSummary: string;
  description: string | null;
  category: string;
  studyKind: 'STUDY' | 'CLUB';
  thumbnailUrl: string | null;
  status: 'DRAFT' | 'OPEN' | 'ONGOING' | 'ENDED' | 'CLOSED';
  recruitStatus: 'RECRUITING' | 'RECRUIT_CLOSED' | null;
  curriculum: string | null;
  capacity: number | null;
  recruitDeadlineAt: string | null;
  schedule: string | null;
  startAt: string | null;
  endAt: string | null;
  discordChannelUrl: string | null;
  driveUrl: string | null;
};

export type ApiPage<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

// ── 변환 헬퍼 ─────────────────────────────────────────────────────────

const DISPLAY_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_DISPLAY).map(([k, v]) => [v, k]),
);

function categoryEnum(displayName: string): string {
  return DISPLAY_TO_ENUM[displayName] ?? displayName;
}

function isoDate(date?: string): string | null {
  return date ? `${date}T00:00:00Z` : null;
}

function toPhase(status: Study['status']): ApiStudy['phase'] {
  if (status === 'recruiting') return 'RECRUITING';
  if (status === 'ongoing') return 'ONGOING';
  return 'CLOSED';
}

function toStudyStatus(status: Study['status']): 'DRAFT' | 'OPEN' | 'CLOSED' {
  return status === 'closed' ? 'CLOSED' : 'OPEN';
}

function toTimezone(tz?: Study['timezone']): ApiStudy['timezone'] {
  if (!tz) return null;
  if (tz === 'both') return 'BOTH';
  return tz;
}

export function studyToApiStudy(s: Study): ApiStudy {
  const recruitClosed = s.recruitment?.status === 'closed';
  return {
    studyId: s.study_id,
    title: s.title.ko,
    oneLineSummary: s.summary.ko,
    category: categoryEnum(s.category ?? ''),
    studyKind: s.kind === 'club' ? 'CLUB' : 'STUDY',
    thumbnailUrl: s.image ?? null,
    schedule: s.schedule?.ko ?? null,
    timezone: toTimezone(s.timezone),
    status: toStudyStatus(s.status),
    phase: toPhase(s.status),
    recruitStatus: recruitClosed ? 'RECRUIT_CLOSED' : 'RECRUITING',
    capacity: s.seats?.total ?? null,
    currentApplicants: s.seats?.taken ?? 0,
    recruitDeadlineAt: isoDate(s.recruitment?.deadline),
    startAt: isoDate(s.startAt),
    endAt: isoDate(s.date),
    closingSoon: false,
  };
}

export function studyToApiStudyDetail(s: Study): ApiStudyDetail {
  const recruitClosed = s.recruitment?.status === 'closed';
  return {
    id: s.study_id,
    programId: s.study_id,
    title: s.title.ko,
    oneLineSummary: s.summary.ko,
    description: s.description?.ko ?? null,
    category: categoryEnum(s.category ?? ''),
    studyKind: s.kind === 'club' ? 'CLUB' : 'STUDY',
    thumbnailUrl: s.image ?? null,
    status: toStudyStatus(s.status),
    recruitStatus: recruitClosed ? 'RECRUIT_CLOSED' : 'RECRUITING',
    curriculum: null,
    capacity: s.seats?.total ?? null,
    recruitDeadlineAt: isoDate(s.recruitment?.deadline),
    schedule: s.schedule?.ko ?? null,
    startAt: isoDate(s.startAt),
    endAt: isoDate(s.date),
    discordChannelUrl: s.discord_url ?? null,
    driveUrl: s.driveUrl ?? null,
  };
}

export const apiStudies: ApiStudy[] = mockStudies.map(studyToApiStudy);

export function findApiStudyDetail(studyId: number): ApiStudyDetail | undefined {
  const s = mockStudies.find((m) => m.study_id === studyId);
  return s ? studyToApiStudyDetail(s) : undefined;
}
