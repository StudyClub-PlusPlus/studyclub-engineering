import { CATEGORY_DISPLAY } from '@studyclub/utils';

// 백오피스 스터디 상세·등록·수정이 쓰는 타입.

/** 기준 시간대 (STUDY.TIMEZONE). `BOTH` = 동시 진행(KST·PST). */
export type StudyTimezone = 'KST' | 'PST' | 'BOTH';

/** 상세 응답. 백엔드 StudyDetailResponse 와 1:1 이다. 날짜는 ISO 8601 UTC. */
export type ApiStudyDetail = {
  id: number;
  programId: number;
  /** 프로그램 제목. 정보 탭이 프로그램을 읽기 전용으로 보여 주는 데 쓴다. */
  programTitle: string;
  title: string;
  oneLineSummary: string;
  description: string | null;
  category: string;
  studyKind: 'STUDY' | 'CLUB';
  thumbnailUrl: string | null;
  status: 'DRAFT' | 'OPEN' | 'ONGOING' | 'ENDED' | 'CLOSED';
  /** `status != OPEN` 이면 null — 모집 상태가 "없는" 것이지 마감이 아니다. */
  recruitStatus: 'RECRUITING' | 'RECRUIT_CLOSED' | null;
  curriculum: string | null;
  capacity: number | null;
  schedule: string | null;
  /** 운영자가 고른 값 그대로. null = 미정 — 일정 문구로 추정한 값이 아니다. */
  timezone: StudyTimezone | null;
  recruitDeadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  /** STUDY_DISCORD_LINK 행 존재 여부. 채널 URL 입력 여부와 별개다. */
  discordLinked: boolean;
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
  /** 비우면 미정. */
  timezone?: StudyTimezone;
  capacity?: number | null;
  startAt?: string | null;
  discordChannelUrl?: string | null;
  driveUrl?: string | null;
  /** 썸네일 — `POST /api/uploads/images` 가 준 번호. 주소 문자열은 받지 않는다. */
  thumbnailFileId?: number;
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
  /** `null` 이면 미정으로 되돌린다. */
  timezone?: StudyTimezone | null;
  capacity?: number | null;
  startAt?: string | null;
  discordChannelUrl?: string | null;
  driveUrl?: string | null;
  /** 새로 올린 썸네일 번호. `null` 이면 썸네일을 지운다. */
  thumbnailFileId?: number | null;
};

export const STATUS_LABEL: Record<ApiStudyDetail['status'], string> = {
  DRAFT: '비공개',
  OPEN: '모집',
  ONGOING: '진행중',
  ENDED: '종료',
  CLOSED: '운영 종료',
};

/** 백엔드 enum 순서를 그대로 쓴다 — 사용자 사이트 필터와 순서가 어긋나면 같은 화면을 다르게 읽게 된다. */
export const CATEGORY_OPTIONS = Object.entries(CATEGORY_DISPLAY).map(([value, label]) => ({ value, label }));
