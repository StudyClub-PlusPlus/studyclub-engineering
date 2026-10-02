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

/** 상세 응답. 백엔드 StudyDetailResponse 와 1:1 이다. 날짜는 ISO 8601 UTC. */
export type ApiStudyDetail = {
  id: number;
  programId: number;
  /** 프로그램 제목. 정보 탭이 프로그램을 읽기 전용으로 보여 주는 데 쓴다. */
  programTitle: string;
  slug: string;
  title: string;
  oneLineSummary: string;
  description: string | null;
  category: string;
  studyKind: 'STUDY' | 'CLUB';
  thumbnailUrl: string | null;
  deliveryFormat: string;
  status: 'DRAFT' | 'OPEN' | 'ONGOING' | 'ENDED' | 'CLOSED';
  /** `status != OPEN` 이면 null — 모집 상태가 "없는" 것이지 마감이 아니다. */
  recruitStatus: 'RECRUITING' | 'RECRUIT_CLOSED' | null;
  curriculum: string | null;
  capacity: number | null;
  schedule: string | null;
  recruitDeadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  discordChannelUrl: string | null;
  driveUrl: string | null;
};

/**
 * 등록 모달의 「기존 클럽의 새 기수」 드롭다운 항목 — `GET /api/admin/study-programs?studyKind=CLUB`.
 * `latestStudyId` 로 그 클럽의 최신 기수 상세를 다시 불러 폼을 채운다.
 */
export type ApiStudyProgram = {
  programId: number;
  title: string;
  latestStudyId: number | null;
};

/**
 * POST 바디. 프로그램은 둘 중 하나만 보낸다 — 새 프로그램이면 `studyKind`, 기존 클럽의 새 기수면
 * `studyProgramId`. 둘을 함께 보내면 서버가 400 으로 거절한다(종류는 한 번 정하면 못 바꾼다).
 */
export type StudyCreatePayload = {
  studyProgramId?: number;
  studyKind?: 'STUDY' | 'CLUB';
  title: string;
  oneLineSummary: string;
  description?: string;
  category: string;
  recruitDeadline: string;
  schedule?: string;
  capacity?: number | null;
  startAt?: string | null;
  discordChannelUrl?: string | null;
  driveUrl?: string | null;
};

/**
 * PATCH 바디. 키를 빼면 그 값은 그대로 두고, `null` 을 보내면 비운다(정원 제한 없음 · 시작일 미정 · 주소 없음).
 * 정보 탭은 폼 전체를 보내므로 모든 키를 채운다.
 */
export type StudyUpdatePayload = {
  title?: string;
  oneLineSummary?: string;
  description?: string;
  category?: string;
  recruitDeadline?: string;
  schedule?: string;
  capacity?: number | null;
  startAt?: string | null;
  discordChannelUrl?: string | null;
  driveUrl?: string | null;
};

export const STATUS_LABEL: Record<ApiStudyDetail['status'], string> = {
  DRAFT: '비공개',
  OPEN: '모집',
  ONGOING: '진행중',
  ENDED: '종료',
  CLOSED: '운영 종료',
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
