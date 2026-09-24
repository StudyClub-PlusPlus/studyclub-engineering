// 백오피스 스터디 목록이 쓰는 타입과 변환.
// 응답 정의는 백엔드 StudyListResponse.StudySummary 와 1:1 이다.
import { CATEGORY_DISPLAY } from '@studyclub/mock';

export type StudyPhase = 'RECRUITING' | 'ONGOING' | 'CLOSED';

export type ApiStudySummary = {
  studyId: number;
  slug: string;
  title: string;
  oneLineSummary: string;
  category: string;
  studyKind: 'STUDY' | 'CLUB';
  schedule: string | null;
  timezone: 'KST' | 'PST' | 'BOTH';
  phase: StudyPhase;
  capacity: number | null;
  currentApplicants: number;
  recruitDeadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  closingSoon: boolean;
};

export type ApiStudyPage = {
  items: ApiStudySummary[];
  total: number;
  offset: number;
  limit: number;
};

/** 목록 조건. 비우면 그 조건을 걸지 않는다. 쿼리 키에 그대로 들어간다. */
export type StudyFilter = {
  keyword?: string;
  category?: string;
  phase?: StudyPhase;
};

/** 목록 한 줄이 실제로 그리는 값. API 가 안 주는 값(출석률 등)은 아예 두지 않는다. */
export type StudyRow = {
  studyId: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  phase: StudyPhase;
  /** 지금 신청을 받는가. 단계 판정은 백엔드가 한다 — 화면에서 다시 계산하지 않는다. */
  recruiting: boolean;
  /** 모집 마감일(YYYY-MM-DD). null 이면 상시 모집. */
  deadline: string | null;
  applicants: number;
  capacity: number | null;
  closingSoon: boolean;
};

export const PHASE_LABEL: Record<StudyPhase, string> = {
  RECRUITING: '모집중',
  ONGOING: '진행중',
  CLOSED: '종료',
};

/** 백엔드 enum 순서를 그대로 쓴다 — 사용자 사이트 필터와 순서가 어긋나면 같은 화면을 다르게 읽게 된다. */
export const CATEGORY_OPTIONS = Object.entries(CATEGORY_DISPLAY).map(([value, label]) => ({ value, label }));

export function toRow(api: ApiStudySummary): StudyRow {
  return {
    studyId: api.studyId,
    slug: api.slug,
    title: api.title,
    summary: api.oneLineSummary,
    category: CATEGORY_DISPLAY[api.category] ?? api.category,
    phase: api.phase,
    recruiting: api.phase === 'RECRUITING',
    deadline: api.recruitDeadlineAt?.slice(0, 10) ?? null,
    applicants: api.currentApplicants,
    capacity: api.capacity,
    closingSoon: api.closingSoon,
  };
}
