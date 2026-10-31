'use client';

import type { JoinedMeeting, JoinedStudy, ScheduleRole } from '@/features/my-studies/queries';
import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';
import { wallParts } from '@/lib/meetings';
import { zoneAbbreviation } from '@/lib/schedule-timezone';

export type WallTz = string;

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

export const SCHEDULE_ROLE_LABEL: Record<ScheduleRole, string> = {
  captain: '캡틴',
  navigator: '네비게이터',
  crew: '크루',
};

/** 관계가 끝난 이유 — 서버의 `relation`(명부 STATUS)이 정한다. */
export function endKindOf(study: JoinedStudy): EndKind | undefined {
  if (study.relation === 'COMPLETED') return 'completed';
  if (study.relation === 'WITHDRAWN') return 'withdrawn';
  return undefined;
}

export function lifeStatus(study: JoinedStudy): LifeStatus {
  if (endKindOf(study)) return 'ended';
  if (study.relation === 'UPCOMING') return 'upcoming';
  return 'active';
}

export function isCompleted(study: JoinedStudy): boolean {
  return endKindOf(study) === 'completed';
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
  return wallParts(at, tz).date;
}

/** 회차 길이 컬럼이 없어 예정 종료는 시작 + 120분으로 본다 (specs/my-studies 「화면이 응답에서 계산하는 것」). */
const MEETING_MIN = 120;

/** 회차 종료 기준 — 실제 종료가 있으면 그것, 없으면 예정 시각 + 120분. */
export function meetingEnd(meeting: JoinedMeeting): Date {
  return meeting.endAt
    ? new Date(meeting.endAt)
    : new Date(new Date(meeting.scheduledAt).getTime() + MEETING_MIN * 60_000);
}

function formatInTz(instant: Date, tz: WallTz): { date: string; time: string } {
  return wallParts(instant, tz);
}

/** 첫 회차 ~ 마지막 회차. 예정일(SCHEDULED_AT)을 고른 타임존 날짜로 붙인다. 킥오프(no === 0)는 제외한다. */
export function durationOf(study: JoinedStudy, locale: Locale, tz: WallTz = 'Asia/Seoul'): string {
  const meetings = study.meetings.filter((m) => m.no !== 0);
  if (meetings.length === 0) return locale === 'en' ? 'Dates TBD' : '기간 미정';
  const start = formatInTz(new Date(meetings[0].scheduledAt), tz).date;
  const end = formatInTz(new Date(meetings[meetings.length - 1].scheduledAt), tz).date;
  return `${start} ~ ${end}`;
}

/** 다가오는 회차. 참여 종료·완주는 없다. 진행 중인 회차는 끝날 때까지 다음 회차로 남는다. */
export function upcomingMeeting(study: JoinedStudy): JoinedMeeting | undefined {
  const life = lifeStatus(study);
  if (life === 'ended') return undefined;
  if (life === 'upcoming') return study.meetings[0];
  const now = Date.now();
  return study.meetings.find((m) => meetingEnd(m).getTime() > now);
}

function meetingLabel(meeting: JoinedMeeting): string {
  return meeting.no === 0 ? '킥오프' : `${meeting.no}회차`;
}

/** 다가오는 일정 문구. 회차·날짜·시각을 선택한 타임존으로 붙인다. */
export function upcomingOf(study: JoinedStudy, locale: Locale, tz: WallTz = 'Asia/Seoul'): string {
  const next = upcomingMeeting(study);
  if (next) {
    const { date, time } = formatInTz(new Date(next.scheduledAt), tz);
    return `${meetingLabel(next)} · ${date} ${time} ${zoneAbbreviation(tz, new Date(next.scheduledAt))}`;
  }
  if (lifeStatus(study) === 'ended') return locale === 'en' ? 'No upcoming meeting' : '다음 일정 없음';
  return locale === 'en' ? 'No upcoming meeting' : '오늘 이후 회차 없음';
}

export type WeekHit = {
  studyId: string;
  meetingId: string;
  title: string;
  no: number;
  time: string;
  abbreviation: string;
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
export function weekDays(studies: JoinedStudy[], locale: Locale, tz: WallTz, monday: string): WeekDay[] {
  const today = ymdInTz(new Date(), tz);
  const end = addDays(monday, 6);
  const byDate = new Map<string, WeekHit[]>();

  for (const study of studies) {
    if (lifeStatus(study) === 'ended') continue;
    for (const m of study.meetings) {
      const { date, time } = formatInTz(new Date(m.scheduledAt), tz);
      if (date < monday || date > end) continue;
      const hits = byDate.get(date) ?? [];
      hits.push({
        studyId: study.id,
        meetingId: m.id,
        title: t(study.title, locale),
        no: m.no,
        time,
        abbreviation: zoneAbbreviation(tz, new Date(m.scheduledAt)),
      });
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
