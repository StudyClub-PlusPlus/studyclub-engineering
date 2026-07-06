// StudyClub++ 콘텐츠 접근자.
// 예전 dogfood 버전은 파일시스템 yaml 을 읽었지만, public 레포에선
// 하드코딩 mock (@studyclub/mock) 을 소스로 쓴다. 함수 시그니처/반환 모양은 동일 유지.
// TODO(api): 팀 합류 후 api.studyclub-plusplus.com fetch 로 교체.
import {
  studies as studiesData,
  events as eventsData,
  operators as operatorsData,
  members as membersData,
  site as siteData,
  announcements as announcementsData,
} from "@studyclub/mock";

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
} from "@studyclub/mock";

import type { Study, StudyclubEvent, Operator, Member, Site, Announcement } from "@studyclub/mock";

function sortByOrder<T extends { id: string; order?: number }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id),
  );
}

export async function getStudies(): Promise<Study[]> {
  // date 없으면 year 기준 1/1 로 추정 주입 (날짜 필터/정렬용).
  const withDate = studiesData.map((s) => ({
    ...s,
    date: s.date ?? (s.year ? `${s.year}-01-01` : undefined),
  }));
  return sortByOrder(withDate);
}
export async function getEvents(): Promise<StudyclubEvent[]> {
  return sortByOrder(eventsData);
}
export async function getOperators(): Promise<Operator[]> {
  return sortByOrder(operatorsData);
}
export async function getMembers(): Promise<Member[]> {
  return sortByOrder(membersData);
}

export async function getStudyMap(): Promise<Record<string, Study>> {
  const studies = await getStudies();
  return Object.fromEntries(studies.map((s) => [s.id, s]));
}

export async function getStudy(id: string): Promise<Study | null> {
  return (await getStudies()).find((s) => s.id === id) ?? null;
}

export async function getEvent(id: string): Promise<StudyclubEvent | null> {
  return (await getEvents()).find((e) => e.id === id) ?? null;
}

/** members 중 특정 study 에 참여하는 사람 */
export async function getMembersByStudy(studyId: string): Promise<Member[]> {
  return (await getMembers()).filter((mem) => (mem.studies ?? []).includes(studyId));
}

export async function getSite(): Promise<Site> {
  return siteData;
}

export async function getOperatorMap(): Promise<Record<string, Operator>> {
  const ops = await getOperators();
  return Object.fromEntries(ops.map((o) => [o.id, o]));
}

/** 공지사항 — 고정(pinned) 먼저, 그다음 날짜 내림차순. */
export async function getNotices(): Promise<Announcement[]> {
  return [...announcementsData].sort(
    (a, b) =>
      Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
      b.date.localeCompare(a.date),
  );
}
