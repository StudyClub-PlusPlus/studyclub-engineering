import type { ApiAdminRetros, ApiRetroList, ApiRetroStatus, RetroSectionKey } from '@/features/meeting-retro/types';
import type { ApiMeeting } from '@/features/schedule/repository';
import { dateWithDow, tzAbbr, wallParts } from '@/features/schedule/time';

type RetroField = 'good' | 'improve' | 'feeling';

/** 표 · CSV 의 열 순서. */
export const RETRO_SECTIONS: { key: RetroField; api: RetroSectionKey; label: string }[] = [
  { key: 'good', api: 'GOOD', label: '좋았던 점' },
  { key: 'improve', api: 'IMPROVE', label: '개선할 점' },
  { key: 'feeling', api: 'FEELING', label: '소감' },
];

export const sectionOf = (api: RetroSectionKey) => RETRO_SECTIONS.find((s) => s.api === api)!;

/* ── 회고 탭 ─────────────────────────────────────────────────────────────── */

export type RetroMeeting = {
  meetingId: number;
  label: string;
  scheduledAt: string;
  deadline: string;
  open: boolean;
};

/** 미팅이 끝난 회차 — 오래된 것부터. 킥오프는 서버가 null 로 준다. */
export function endedRetroMeetings(
  status: ApiRetroStatus | undefined,
  meetings: ApiMeeting[] | undefined,
  now = Date.now(),
): RetroMeeting[] {
  if (!status || !meetings) return [];
  const byId = new Map(meetings.map((m) => [m.id, m]));
  const out: RetroMeeting[] = [];
  for (const s of status.meetings) {
    const m = byId.get(s.meetingId);
    if (!m || s.meetingEndAt === null || s.retroDeadline === null || s.retroOpen === null) continue;
    if (new Date(s.meetingEndAt).getTime() > now) continue;
    out.push({
      meetingId: s.meetingId,
      label: `${m.number}회차`,
      scheduledAt: m.scheduledAt,
      deadline: s.retroDeadline,
      open: s.retroOpen,
    });
  }
  return out.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export type RetroEntry = { retroId: number; authorName: string; answer: string; likes: number };

/** 한 문항의 답 — 비운 답은 빼고 👍 많은 순, 같으면 쓴 순서(서버가 writtenAt 오름차순으로 준다). */
export function sectionEntries(list: ApiRetroList, section: (typeof RETRO_SECTIONS)[number]): RetroEntry[] {
  return list.retros
    .map((r, order) => ({
      order,
      retroId: r.retroId,
      authorName: r.author.displayName,
      answer: r[section.key] ?? '',
      likes: r.likes[section.api] ?? 0,
    }))
    .filter((e) => e.answer.trim() !== '')
    .sort((a, b) => b.likes - a.likes || a.order - b.order)
    .map((e) => ({ retroId: e.retroId, authorName: e.authorName, answer: e.answer, likes: e.likes }));
}

export type WritingStatus = {
  targets: number;
  written: number;
  rows: { participantId: number; name: string; wrote: boolean }[];
};

/** 작성 현황 — 쓴 사람이 앞, 안 쓴 사람이 뒤. 서버가 targets 를 비워 주면(캡틴 권한이 아닌 응답) 그리지 않는다. */
export function writingStatus(list: ApiRetroList): WritingStatus | null {
  if (list.targets === null) return null;
  return {
    targets: list.targets,
    written: list.retros.length,
    rows: [
      ...list.retros.map((r) => ({ participantId: r.author.participantId, name: r.author.displayName, wrote: true })),
      ...list.missing.map((m) => ({ participantId: m.participantId, name: m.displayName, wrote: false })),
    ],
  };
}

/* ── 표시 ───────────────────────────────────────────────────────────────── */

/** `11.27 20:00 KST` — 콘솔 표시 시간대의 벽시계와 그 순간의 약칭. */
export function shortDateTime(iso: string, zone: string): string {
  const at = new Date(iso);
  const { date, time } = wallParts(at, zone);
  const [, m, d] = date.split('-');
  return `${m}.${d} ${time} ${tzAbbr(zone, at)}`;
}

export function deadlineText(meeting: Pick<RetroMeeting, 'deadline' | 'open'>, zone: string): string {
  const at = shortDateTime(meeting.deadline, zone);
  return meeting.open ? `${at}까지` : `${at} 마감`;
}

/** `2026-11-20 (금)` — 회차 시작 순간을 표시 시간대로 옮긴 날짜. */
export function meetingDate(iso: string, zone: string): string {
  return dateWithDow(wallParts(new Date(iso), zone).date);
}

/* ── 회고 모아보기 ──────────────────────────────────────────────────────── */

/** 작성률 — 기한 지난 줄만 센다. 기한 지난 회차가 없으면 null. */
export function writingRate(summary: ApiAdminRetros['summary']): number | null {
  if (summary.closedRows === 0) return null;
  return Math.round((summary.closedWritten / summary.closedRows) * 100);
}

export function sectionCount(summary: ApiAdminRetros['summary'], api: RetroSectionKey): number {
  return summary[sectionOf(api).key];
}

/**
 * 회차 고르기 — 고른 스터디의 반마다 이미 시작한 정규 회차, 반 이름순 · 회차순. 킥오프는 회고가 없어 뺀다.
 * 반이 하나면 반 이름을 붙이지 않는다.
 */
export function retroMeetingOptions(
  groups: { groupId: number; name: string; meetings: ApiMeeting[] | undefined }[],
  now = Date.now(),
): { value: string; label: string }[] {
  const named = groups.length > 1;
  return groups.flatMap((g) =>
    (g.meetings ?? [])
      .filter((m) => m.type !== 'KICKOFF' && new Date(m.scheduledAt).getTime() <= now)
      .sort((a, b) => a.number - b.number)
      .map((m) => ({ value: String(m.id), label: named ? `${g.name} · ${m.number}회차` : `${m.number}회차` })),
  );
}
