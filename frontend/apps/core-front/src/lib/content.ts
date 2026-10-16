// StudyClub++ 콘텐츠 접근자.
// 스터디는 백엔드 API 에서 가져온다. 실패하면 예시 데이터로 메우지 않고 빈 목록·null 을 준다 —
// 화면은 빈 상태를 그린다(상세는 클라이언트가 404·500 에 반응한다).
// 행사·운영진·공지는 아직 API 가 없어 빈 목록이다. 사이트 설정(디스코드 초대·커뮤니티 규모)만 상수로 둔다.
import type { Study, StudyclubEvent, Operator, Site, Announcement } from '@studyclub/mock';
import { site as siteData } from '@studyclub/mock';

import { fetchStudies, fetchStudy } from './api';

export type {
  Locale,
  L10n,
  StudyStatus,
  StudyFormat,
  StudyKind,
  RecruitmentStatus,
  Recruitment,
  StudyWeek,
  StudyReview,
  StudyStats,
  Study,
  StudyclubEvent,
  Operator,
  Member,
  Site,
  Announcement,
} from '@studyclub/mock';

/** 사용자 사이트용 스터디 목록. API 가 실패하면 빈 목록 — 예시 스터디로 메우지 않는다. */
export async function getStudies(): Promise<Study[]> {
  try {
    return await fetchStudies();
  } catch (e) {
    console.error('[content] GET /api/studies failed:', e);
    return [];
  }
}

// TODO(api): GET /api/events — 행사 API 가 생기면 연동. 그전까지는 빈 목록(화면은 빈 상태).
export async function getEvents(): Promise<StudyclubEvent[]> {
  return [];
}

// TODO(api): GET /api/operators — 운영진 API 가 생기면 연동. 빈 목록이면 소개 페이지가 섹션을 숨긴다.
export async function getOperators(): Promise<Operator[]> {
  return [];
}

/** 스터디 단건. API 가 실패하면 null — 메타데이터만 비고, 본문은 클라이언트가 404·500 을 그린다. */
export async function getStudy(studyId: number): Promise<Study | null> {
  try {
    return await fetchStudy(studyId);
  } catch (e) {
    console.error(`[content] GET /api/studies/${studyId} failed:`, e);
    return null;
  }
}

export async function getEvent(id: string): Promise<StudyclubEvent | null> {
  return (await getEvents()).find((e) => e.id === id) ?? null;
}

export async function getSite(): Promise<Site> {
  return siteData;
}

export async function getOperatorMap(): Promise<Record<string, Operator>> {
  const ops = await getOperators();
  return Object.fromEntries(ops.map((o) => [o.id, o]));
}

// TODO(api): GET /api/announcements — 공지 API 가 생기면 연동(고정 먼저, 날짜 내림차순). 그전까지는 빈 목록.
export async function getNotices(): Promise<Announcement[]> {
  return [];
}
