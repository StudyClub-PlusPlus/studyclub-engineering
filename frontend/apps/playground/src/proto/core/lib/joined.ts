import { meetingsOf } from '@core/lib/attendance';
import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { site, type MemberRegion, type Study, type StudyMeeting } from '@studyclub/mock';

export type WallTz = 'KST' | 'PDT';
export type MeetRegion = 'kr' | 'us' | 'both';

/**
 * 크루가 보는 참여 상태. 스터디 진행이 아니라 **나와의 관계**다.
 * - upcoming : 승인은 됐지만 아직 시작 전
 * - active   : 지금 들어가는 중
 * - ended    : 나와의 관계가 끝남 (완주 · 참여 중단)
 */
export type LifeStatus = 'upcoming' | 'active' | 'ended';

/**
 * 관계가 끝난 이유.
 * 크루 화면에서 참여 중단 배지는 참여 종료다. 완주만 따로 기린다.
 */
export type EndKind = 'completed' | 'withdrawn' | 'expelled';

export const LIFE_LABEL: Record<LifeStatus, string> = {
  upcoming: '시작전',
  active: '참여중',
  ended: '참여 종료',
};

/** 프로토용 명부. 서버가 생기면 STUDY_PARTICIPANT.STATUS 로 교체한다. */
const END_KIND: Record<string, EndKind> = {
  'renaissance-club': 'withdrawn',
  'system-design-interview-ongoing': 'expelled',
};

export function endKindOf(study: Study): EndKind | undefined {
  const fixed = END_KIND[study.id];
  if (fixed) return fixed;
  if (study.status === 'closed') return 'completed';
  return undefined;
}

export function lifeStatus(study: Study): LifeStatus {
  if (endKindOf(study)) return 'ended';
  if (study.id === 'ai-paper-study') return 'active';
  if (study.status === 'closed') return 'ended';
  if (study.status === 'recruiting') return 'upcoming';
  return 'active';
}

/** 참여 중단 배지. 완주는 이 배지를 쓰지 않는다. */
export const LEFT_BADGE = { label: '참여 종료', tone: 'ended' as const };

export function isCompleted(study: Study): boolean {
  return endKindOf(study) === 'completed';
}

const FORMAT_LABEL: Record<Study['format'], { ko: string; en: string }> = {
  online: { ko: '온라인', en: 'Online' },
  offline: { ko: '오프라인', en: 'Offline' },
  hybrid: { ko: '온·오프라인', en: 'Hybrid' },
};

const MEET_LABEL: Record<MeetRegion, { ko: string; en: string }> = {
  kr: { ko: '한국', en: 'Korea' },
  us: { ko: '미국', en: 'US' },
  both: { ko: '동시', en: 'Both' },
};

/** 스터디가 모이는 권역. mock 에 필드가 없어 프로토에서 고정한다. */
export function meetRegionOf(study: Study): MeetRegion {
  if (study.id === 'ai-paper-study') return 'kr';
  if (study.id === 'leetcode150-2026') return 'us';
  return 'both';
}

/** 짧은 태그. 주제 문장을 태그에 넣지 않는다 — 한눈에 분류만 한다. */
export function tagsOf(study: Study, locale: Locale, categoryLabel: string): string[] {
  const tags = [categoryLabel, t(FORMAT_LABEL[study.format], locale), t(MEET_LABEL[meetRegionOf(study)], locale)];
  if (study.kind === 'club') tags.push(locale === 'en' ? 'Club' : '클럽');
  return tags;
}

/** 프로필 거주 지역 → 기본 표시 타임존. 북미만 PDT, 나머지는 KST. */
export function userWallTz(region: MemberRegion): WallTz {
  return region === 'NA' ? 'PDT' : 'KST';
}

/** 첫 회차 ~ 마지막 회차. 예정일(SCHEDULED_AT)을 고른 타임존 날짜로 붙인다. */
export function durationOf(study: Study, locale: Locale, tz: WallTz = 'KST'): string {
  const meetings = meetingsOf(study);
  if (meetings.length === 0) return locale === 'en' ? 'Dates TBD' : '기간 미정';
  const clock = meetingClock(study);
  const start = formatInTz(asKstInstant(meetings[0].date, clock), tz).date;
  const end = formatInTz(asKstInstant(meetings[meetings.length - 1].date, clock), tz).date;
  return `${start} ~ ${end}`;
}

function meetingClock(study: Study): string {
  const raw = study.schedule?.ko ?? '';
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '20:00';
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
    for (const m of meetingsOf(study)) {
      const { date, time } = formatInTz(asKstInstant(m.date, meetingClock(study)), tz);
      if (date < monday || date > end) continue;
      const hits = byDate.get(date) ?? [];
      hits.push({ studyId: study.id, meetingId: m.id, title: t(study.title, locale), no: m.no, time });
      byDate.set(date, hits);
    }
  }

  const labels = locale === 'en' ? DOW_EN : DOW_KO;
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const hits = (byDate.get(date) ?? []).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
    return {
      date,
      label: labels[i],
      day: Number(date.slice(8, 10)),
      today: date === today,
      hits,
    };
  });
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

/** 다가오는 일정. 회차·날짜·시각을 선택한 타임존으로 붙인다. */
export function upcomingOf(study: Study, locale: Locale, tz: WallTz = 'KST'): string {
  const next = upcomingMeeting(study, tz);
  if (next) {
    const { date, time } = formatInTz(asKstInstant(next.date, meetingClock(study)), tz);
    return `${next.no}회차 · ${date} ${time}`;
  }
  if (lifeStatus(study) === 'ended') return locale === 'en' ? 'No upcoming meeting' : '다음 일정 없음';
  return study.schedule ? t(study.schedule, locale) : locale === 'en' ? 'No upcoming meeting' : '오늘 이후 회차 없음';
}

/** 스터디 채널. 완주면 채널이 닫혀 클럽 로비(초대)로 보낸다. */
export function discordUrl(study: Study): string {
  if (isCompleted(study)) return site.discord_invite;
  return study.discord_url || site.discord_invite;
}

/** 출석 이력은 참여 중단 뒤에도 본다. */
export function canOpenAttendance(): boolean {
  return true;
}

/** 참여 중단은 채널에 못 들어간다. 완주는 로비로 보낸다. */
export function canOpenDiscord(study: Study): boolean {
  const end = endKindOf(study);
  return !end || end === 'completed';
}

/** 자료실은 아직 관계 있거나 완주한 사람만. 참여 중단은 닫는다. */
export function canOpenDrive(study: Study): boolean {
  const end = endKindOf(study);
  return !end || end === 'completed';
}

/** 프로토용 자료실. 서버가 생기면 스터디별 드라이브 주소로 교체한다. */
export function driveUrl(study: Study): string {
  return `https://drive.google.com/drive/folders/studyclub-${study.id}`;
}
