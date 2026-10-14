'use client';

import { type MemberRegion, type Study, type StudyMeeting } from '@studyclub/mock';

import { meetingsOf } from '@/lib/attendance';
import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';

export type WallTz = 'KST' | 'PDT';

/**
 * 크루가 보는 참여 상태. 스터디 진행이 아니라 나와의 관계다.
 * - upcoming : 승인은 됐지만 아직 시작 전
 * - active   : 지금 들어가는 중
 * - ended    : 나와의 관계가 끝남 (완주 · 참여 중단)
 */
export type LifeStatus = 'upcoming' | 'active' | 'ended';

export type EndKind = 'completed' | 'withdrawn';

export const LIFE_LABEL: Record<LifeStatus, string> = {
  upcoming: '시작전',
  active: '참여중',
  ended: '종료',
};

/** 참여 중단 배지. 완주는 이 배지를 쓰지 않는다. */
export const LEFT_BADGE = { label: '종료', tone: 'ended' as const };

/** 프로토용 명부. 서버가 생기면 STUDY_PARTICIPANT.STATUS 로 교체한다. */
const END_KIND: Record<string, EndKind> = {
  '19': 'withdrawn', // system-design-interview-ongoing
  'system-design-interview-ongoing': 'withdrawn',
};

/**
 * 관계가 끝난 이유.
 * TODO(api): GET /api/me/studies 응답의 STUDY_PARTICIPANT.STATUS 로 교체.
 *            WITHDRAWN(참여 중단)은 서버에서 내려줘야 한다 — 스터디 status 로는 판정 불가.
 */
export function endKindOf(study: Study): EndKind | undefined {
  const fixed = END_KIND[study.id] ?? (study.study_id !== undefined ? END_KIND[String(study.study_id)] : undefined);
  if (fixed) return fixed;
  if (study.status === 'closed') return 'completed';
  return undefined;
}

export function lifeStatus(study: Study): LifeStatus {
  if (endKindOf(study)) return 'ended';
  if (study.status === 'recruiting') return 'upcoming';
  return 'active';
}

export function isCompleted(study: Study): boolean {
  return endKindOf(study) === 'completed';
}

/** 프로필 거주 지역 → 기본 표시 타임존. 북미만 PDT, 나머지는 KST. */
export function userWallTz(region: MemberRegion): WallTz {
  return region === 'NA' ? 'PDT' : 'KST';
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(ymd: string, n: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return toYmd(d);
}

/** 그 날이 속한 주의 월요일. 주는 월~일이다. */
export function mondayOf(ymd: string): string {
  const d = parseYmd(ymd);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return toYmd(d);
}

export function ymdInTz(at: Date, tz: WallTz): string {
  const iana = tz === 'KST' ? 'Asia/Seoul' : 'America/Los_Angeles';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: iana,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** 일정 문구(「매주 목 20:00 · 8주」)에서 KST 시각을 뽑는다. 없으면 20:00. */
function meetingClock(study: Study): string {
  const raw = study.schedule?.ko ?? '';
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '20:00';
}

/** 일정 문구의 시각은 KST 로 적혀 있다고 본다. */
function asKstInstant(date: string, clock: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = clock.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, 0));
}

function formatInTz(instant: Date, tz: WallTz): { date: string; time: string } {
  const iana = tz === 'KST' ? 'Asia/Seoul' : 'America/Los_Angeles';
  return {
    date: new Intl.DateTimeFormat('en-CA', {
      timeZone: iana,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant),
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone: iana,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(instant),
  };
}

/** 첫 회차 ~ 마지막 회차. 예정일(SCHEDULED_AT)을 고른 타임존 날짜로 붙인다. 킥오프(no === 0)는 제외한다. */
export function durationOf(study: Study, locale: Locale, tz: WallTz = 'KST'): string {
  const meetings = meetingsOf(study).filter((m) => m.no !== 0);
  if (meetings.length === 0) return locale === 'en' ? 'Dates TBD' : '기간 미정';
  const clock = meetingClock(study);
  const start = formatInTz(asKstInstant(meetings[0].date, clock), tz).date;
  const end = formatInTz(asKstInstant(meetings[meetings.length - 1].date, clock), tz).date;
  return `${start} ~ ${end}`;
}

/** 회차 예정일(SCHEDULED_AT)을 고른 타임존 날짜(yyyy-mm-dd)로. */
export function meetingWallDate(study: Study, meeting: StudyMeeting, tz: WallTz): string {
  return formatInTz(asKstInstant(meeting.date, meetingClock(study)), tz).date;
}

/** 다가오는 회차. 참여 종료·완주는 없다. */
export function upcomingMeeting(study: Study, tz: WallTz = 'KST'): StudyMeeting | undefined {
  const life = lifeStatus(study);
  if (life === 'ended') return undefined;
  const today = ymdInTz(new Date(), tz);
  const meetings = meetingsOf(study);
  return life === 'upcoming' ? meetings[0] : meetings.find((m) => m.date >= today);
}

function meetingLabel(meeting: StudyMeeting): string {
  return meeting.no === 0 ? '킥오프' : `${meeting.no}회차`;
}

/** 다가오는 일정 문구. 회차·날짜·시각을 선택한 타임존으로 붙인다. */
export function upcomingOf(study: Study, locale: Locale, tz: WallTz = 'KST'): string {
  const next = upcomingMeeting(study, tz);
  if (next) {
    const clock = meetingClock(study);
    const { date, time } = formatInTz(asKstInstant(next.date, clock), tz);
    return `${meetingLabel(next)} · ${date} ${time}`;
  }
  if (lifeStatus(study) === 'ended') return locale === 'en' ? 'No upcoming meeting' : '다음 일정 없음';
  return study.schedule ? t(study.schedule, locale) : locale === 'en' ? 'No upcoming meeting' : '오늘 이후 회차 없음';
}

export type WeekHit = {
  studyId: string;
  meetingId: string;
  title: string;
  no: number;
  time: string;
};

export type WeekDay = {
  date: string;
  label: string;
  day: number;
  today: boolean;
  hits: WeekHit[];
};

const DOW_KO = ['월', '화', '수', '목', '금', '토', '일'];
const DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * 이번 주(월~일) 회차. 참여 종료·완주는 뺀다 — 이미 끝난 관계다.
 * 날짜는 고른 타임존 벽시계 기준이다.
 */
export function weekDays(studies: Study[], locale: Locale, tz: WallTz, monday: string): WeekDay[] {
  const today = ymdInTz(new Date(), tz);
  const end = addDays(monday, 6);
  const byDate = new Map<string, WeekHit[]>();

  for (const study of studies) {
    if (lifeStatus(study) === 'ended') continue;
    const clock = meetingClock(study);
    for (const m of meetingsOf(study)) {
      const { date, time } = formatInTz(asKstInstant(m.date, clock), tz);
      if (date < monday || date > end) continue;
      const hits = byDate.get(date) ?? [];
      hits.push({ studyId: study.id, meetingId: m.id, title: t(study.title, locale), no: m.no, time });
      byDate.set(date, hits);
    }
  }

  const labels = locale === 'en' ? DOW_EN : DOW_KO;
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const hits = (byDate.get(date) ?? []).sort(
      (a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title),
    );
    return {
      date,
      label: labels[i],
      day: Number(date.slice(8, 10)),
      today: date === today,
      hits,
    };
  });
}
