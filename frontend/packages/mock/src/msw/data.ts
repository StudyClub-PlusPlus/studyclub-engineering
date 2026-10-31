import type { Study } from '@studyclub/types';
import { CATEGORY_DISPLAY, toISODate } from '@studyclub/utils';

import { studies as mockStudies } from '..';

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
  status: 'DRAFT' | 'OPEN' | 'ONGOING' | 'ENDED' | 'CLOSED';
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
  timezone: 'KST' | 'PST' | 'BOTH' | null;
  startAt: string | null;
  endAt: string | null;
  discordChannelUrl: string | null;
  driveUrl: string | null;
  /** 프로그램(시리즈) 이름. 별도 프로그램이 없는 예시 스터디는 자신의 제목을 사용한다. */
  programTitle: string;
  /** 스터디에 디스코드 채널이 연결됐는지 — 실제 API `StudyDetailResponse.discordLinked` */
  discordLinked: boolean;
};

export type ApiPage<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

// ── 변환 헬퍼 ─────────────────────────────────────────────────────────

const DISPLAY_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_DISPLAY).map(([k, v]) => [v, k])
);

function categoryEnum(displayName: string): string {
  return DISPLAY_TO_ENUM[displayName] ?? displayName;
}

/**
 * 날짜 → 실제 API 가 주는 시각. 백오피스는 날짜 입력을 서울 시각으로 저장한다
 * (back-office-front StudyForm: 시작 · 종료 `00:00+09:00`, 모집 마감 `23:59:59+09:00`).
 */
function seoulInstant(date: string | undefined, time: string): string | null {
  // 목 데이터에 `2026/03/21` 같은 표기가 섞여 있다 — yyyy-mm-dd 로 맞춘 뒤 읽고, 그래도 날짜가 아니면 null
  const ymd = toISODate(date);
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const at = new Date(`${ymd}T${time}+09:00`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

function isoDate(date?: string): string | null {
  return seoulInstant(date, '00:00:00');
}

function isoDeadline(date?: string): string | null {
  return seoulInstant(date, '23:59:59');
}

function toPhase(status: Study['status']): ApiStudy['phase'] {
  if (status === 'recruiting') return 'RECRUITING';
  if (status === 'ongoing') return 'ONGOING';
  return 'CLOSED';
}

function toStudyStatus(status: Study['status']): ApiStudyDetail['status'] {
  if (status === 'closed') return 'CLOSED';
  if (status === 'ongoing') return 'ONGOING';
  return 'OPEN';
}

function toTimezone(tz?: Study['timezone']): ApiStudy['timezone'] {
  if (!tz) return null;
  if (tz === 'both') return 'BOTH';
  return tz;
}

export function studyToApiStudy(s: Study): ApiStudy {
  const recruitClosed =
    s.status === 'closed' || s.status === 'ongoing' || s.recruitment?.status === 'closed';
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
    recruitDeadlineAt: isoDeadline(s.recruitment?.deadline),
    startAt: isoDate(s.startAt),
    endAt: isoDate(s.date),
    closingSoon: false,
  };
}

export function studyToApiStudyDetail(s: Study): ApiStudyDetail {
  const recruitClosed =
    s.status === 'closed' || s.status === 'ongoing' || s.recruitment?.status === 'closed';
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
    recruitDeadlineAt: isoDeadline(s.recruitment?.deadline),
    schedule: s.schedule?.ko ?? null,
    timezone: toTimezone(s.timezone),
    startAt: isoDate(s.startAt),
    endAt: isoDate(s.date),
    discordChannelUrl: s.discord_url ?? null,
    driveUrl: s.driveUrl ?? null,
    programTitle: s.program?.title.ko ?? s.title.ko,
    discordLinked: Boolean(s.discord_url),
  };
}

export type ApiApplicationFormQuestion = {
  id: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'RADIO' | 'CHECKBOX' | 'SELECT';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
  allowOther?: boolean;
};

export type ApiStudyApplicationForm = {
  studyId: number;
  title: string;
  description: string | null;
  schedule: string | null;
  recruitDeadline: string | null;
  category: string;
  summary: string;
  detail: string | null;
  questions: ApiApplicationFormQuestion[];
};

export function findApiApplicationForm(studyId: number): ApiStudyApplicationForm | undefined {
  const s = mockStudies.find((m) => m.study_id === studyId);
  if (!s) return undefined;
  return {
    studyId: s.study_id,
    title: s.applicationFormTitle ?? s.title.ko,
    description: s.applicationFormDescription ?? s.summary.ko ?? null,
    schedule: s.schedule?.ko ?? null,
    recruitDeadline: isoDeadline(s.recruitment?.deadline),
    category: categoryEnum(s.category ?? ''),
    summary: s.summary.ko,
    detail: s.description?.ko ?? null,
    questions: (s.applicationForm ?? []).map((q) => ({
      ...q,
      type: q.type.toUpperCase() as ApiApplicationFormQuestion['type'],
    })),
  };
}

export const apiStudies: ApiStudy[] = mockStudies.map(studyToApiStudy);

export function findApiStudyDetail(studyId: number): ApiStudyDetail | undefined {
  const s = mockStudies.find((m) => m.study_id === studyId);
  return s ? studyToApiStudyDetail(s) : undefined;
}
