// StudyClub 콘텐츠 접근자.
// 스터디는 백엔드 API 에서 가져온다. 실패하면 예시 데이터로 메우지 않고 빈 목록·null 을 준다 —
// 화면은 빈 상태를 그린다(상세는 클라이언트가 404·500 에 반응한다).
// 행사는 기능 개발 전이라 예시 데이터(@studyclub/mock events)를 그대로 보여 준다 — 실제 지난 행사들이다.
// 공지는 백엔드 API 에서 가져온다 — 등록 즉시 보여야 해서 캐시하지 않는다.
// 운영진은 아직 API 가 없어 빈 목록이다. 사이트 설정(디스코드 초대·커뮤니티 규모)은 상수로 둔다.
import type { Study, StudyclubEvent, Operator, Site } from '@studyclub/mock';
import { events as eventsData, site as siteData } from '@studyclub/mock';

import {
  fetchNotice,
  fetchNotices,
  fetchStudies,
  fetchStudy,
  type ApiPage,
  type ApiSiteNoticeDetail,
  type ApiSiteNoticeSummary,
} from './api';

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

// TODO(api): GET /api/events — 행사 API 가 생기면 연동. 그전까지는 mock 데이터.
export async function getEvents(): Promise<StudyclubEvent[]> {
  return [...eventsData].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id));
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

/** 사이트 공지 목록 한 쪽. API 가 실패하면 빈 목록 — 화면은 빈 상태를 그린다. */
export async function getNotices(offset: number, limit: number): Promise<ApiPage<ApiSiteNoticeSummary>> {
  try {
    return await fetchNotices(offset, limit);
  } catch (e) {
    console.error('[content] GET /api/notices failed:', e);
    return { items: [], total: 0, offset, limit };
  }
}

/** 공지 한 건. 없거나 삭제됐으면 null(화면이 404). 서버 장애는 던진다 — 없는 공지로 위장하지 않는다. */
export async function getNotice(noticeId: string): Promise<ApiSiteNoticeDetail | null> {
  return fetchNotice(noticeId);
}
