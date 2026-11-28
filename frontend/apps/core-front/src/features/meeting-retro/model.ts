import type {
  ApiRetroList,
  ApiRetroStatus,
  ApiRetroViewer,
  RetroAnswers,
  RetroSectionKey,
} from '@/features/meeting-retro/types';
import { dateWithDow, wallParts } from '@/features/schedule/meetings';
import { zoneAbbreviation } from '@/features/schedule/timezone';
import type { ApiMeetingList } from '@/features/schedule/types';
import { ApiError } from '@/lib/http';

export const RETRO_MAX = 500;

type RetroField = keyof RetroAnswers;

export const RETRO_SECTIONS: {
  key: RetroField;
  api: RetroSectionKey;
  label: string;
  required: boolean;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: 'good',
    api: 'GOOD',
    label: '좋았던 점',
    required: true,
    hint: '이번 미팅에서 도움이 됐거나 다음에도 이어 가고 싶은 것',
    placeholder: '예: 같은 예제로 비교해 줘서 차이가 바로 보였어요.',
  },
  {
    key: 'improve',
    api: 'IMPROVE',
    label: '개선할 점',
    required: true,
    hint: '다음 미팅에서 바꾸면 좋을 것',
    placeholder: '예: 실습 코드를 미리 공유해 주면 따라가기 쉬울 것 같아요.',
  },
  {
    key: 'feeling',
    api: 'FEELING',
    label: '소감',
    required: false,
    hint: '오늘 미팅을 마친 느낌을 자유롭게 적어 주세요',
    placeholder: '예: 발표 준비하면서 개념이 정리됐어요. 다음 회차도 기대돼요!',
  },
];

/* ── 회차 ───────────────────────────────────────────────────────────────── */

export type RetroMeeting = {
  meetingId: number;
  number: number;
  label: string;
  title: string | null;
  scheduledAt: string;
  /** 미팅 종료 — 서버가 준 값. 없으면 표시하지 않는다. */
  meetingEndAt: string | null;
  deadline: string;
  open: boolean;
  /** 캡틴(쓸 사람이 아님)은 null. */
  mine: boolean | null;
};

/**
 * 미팅이 끝난 회차 — 오래된 것부터. 킥오프는 서버가 null 로 준다.
 * 서버가 준 미팅 종료(meetingEndAt)로 가른다. 그 칸이 없는 이전 서버면 열려 있거나 기한이 지난 회차를 끝난 것으로 본다.
 */
export function endedRetroMeetings(
  status: ApiRetroStatus | undefined,
  meetings: ApiMeetingList['meetings'] | undefined,
  now = Date.now(),
): RetroMeeting[] {
  if (!status || !meetings) return [];
  const byId = new Map(meetings.map((m) => [m.id, m]));
  const out: RetroMeeting[] = [];
  for (const s of status.meetings) {
    const m = byId.get(s.meetingId);
    if (!m || s.retroDeadline === null || s.retroOpen === null) continue;
    const ended = s.meetingEndAt
      ? new Date(s.meetingEndAt).getTime() <= now
      : s.retroOpen || new Date(s.retroDeadline).getTime() <= now;
    if (!ended) continue;
    out.push({
      meetingId: s.meetingId,
      number: m.number,
      label: `${m.number}회차`,
      title: m.title || null,
      scheduledAt: m.scheduledAt,
      meetingEndAt: s.meetingEndAt ?? null,
      deadline: s.retroDeadline,
      open: s.retroOpen,
      mine: s.retroMine,
    });
  }
  return out.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

/** 회고 탭 옆 점 — 지금 쓸 수 있는데 아직 안 쓴 회차 수. 캡틴은 retroMine 이 null 이라 0. */
export function pendingRetroCount(status: ApiRetroStatus | undefined): number {
  return status?.meetings.filter((s) => s.retroOpen === true && s.retroMine === false).length ?? 0;
}

/* ── 목록 ───────────────────────────────────────────────────────────────── */

export type RetroEntry = {
  retroId: number;
  authorName: string;
  me: boolean;
  answer: string;
  likes: number;
  liked: boolean;
};

/** 한 문항의 답 — 비운 답은 빼고 👍 많은 순, 같으면 쓴 순서(서버가 writtenAt 오름차순으로 준다). */
/**
 * 내 답인지는 회고 작성자와 내 participantId(일정 응답의 me)로 가른다 — 👍 상태 응답이 실패해도 내 답에 👍 를 열지 않는다.
 * 내가 누른 👍 만 뷰어 응답(viewer)에서 읽는다.
 */
export function sectionEntries(
  list: ApiRetroList,
  viewer: ApiRetroViewer | undefined,
  section: (typeof RETRO_SECTIONS)[number],
  myParticipantId: number | null,
): RetroEntry[] {
  return list.retros
    .map((r, order) => ({
      order,
      retroId: r.retroId,
      authorName: r.author.displayName,
      me: myParticipantId !== null && r.author.participantId === myParticipantId,
      answer: r[section.key] ?? '',
      likes: r.likes[section.api] ?? 0,
      liked: Boolean(viewer?.liked[String(r.retroId)]?.[section.api]),
    }))
    .filter((e) => e.answer.trim() !== '')
    .sort((a, b) => b.likes - a.likes || a.order - b.order)
    .map((e) => ({
      retroId: e.retroId,
      authorName: e.authorName,
      me: e.me,
      answer: e.answer,
      likes: e.likes,
      liked: e.liked,
    }));
}

export type WritingStatus = {
  targets: number;
  written: number;
  rows: { participantId: number; name: string; me: boolean; wrote: boolean }[];
};

/** 작성 현황 — 서버가 targets 를 채워 준 사람(네비게이터 · 캡틴)만. 쓴 사람이 앞, 안 쓴 사람이 뒤. */
export function writingStatus(list: ApiRetroList, me: number | null): WritingStatus | null {
  if (list.targets === null) return null;
  return {
    targets: list.targets,
    written: list.retros.length,
    rows: [
      ...list.retros.map((r) => ({
        participantId: r.author.participantId,
        name: r.author.displayName,
        me: me !== null && r.author.participantId === me,
        wrote: true,
      })),
      ...list.missing.map((m) => ({
        participantId: m.participantId,
        name: m.displayName,
        me: me !== null && m.participantId === me,
        wrote: false,
      })),
    ],
  };
}

/* ── 👍 낙관적 반영 ─────────────────────────────────────────────────────── */

/** 누른 수를 바꾼다. `count` 를 주면 서버가 돌려준 수로, 없으면 ±1. */
export function withLikeCount(
  list: ApiRetroList,
  retroId: number,
  section: RetroSectionKey,
  liked: boolean,
  count?: number,
): ApiRetroList {
  return {
    ...list,
    retros: list.retros.map((r) => {
      if (r.retroId !== retroId) return r;
      const now = r.likes[section] ?? 0;
      return { ...r, likes: { ...r.likes, [section]: count ?? Math.max(0, now + (liked ? 1 : -1)) } };
    }),
  };
}

export function withLiked(
  viewer: ApiRetroViewer,
  retroId: number,
  section: RetroSectionKey,
  liked: boolean,
): ApiRetroViewer {
  const key = String(retroId);
  return { ...viewer, liked: { ...viewer.liked, [key]: { ...viewer.liked[key], [section]: liked } } };
}

export function myAnswers(list: ApiRetroList | undefined, myParticipantId: number | null): RetroAnswers | null {
  if (!list || myParticipantId === null) return null;
  const mine = list.retros.find((r) => r.author.participantId === myParticipantId);
  return mine ? { good: mine.good, improve: mine.improve, feeling: mine.feeling ?? '' } : null;
}

/* ── 작성 ───────────────────────────────────────────────────────────────── */

export type RetroErrors = Partial<Record<RetroField, string>>;

export function validateRetro(a: RetroAnswers): RetroErrors {
  const errors: RetroErrors = {};
  for (const s of RETRO_SECTIONS) {
    const v = a[s.key].trim();
    if (s.required && !v) errors[s.key] = `${s.label}을 적어 주세요.`;
    else if (v.length > RETRO_MAX) errors[s.key] = `${RETRO_MAX}자까지 쓸 수 있어요.`;
  }
  return errors;
}

export function trimAnswers(a: RetroAnswers): RetroAnswers {
  return { good: a.good.trim(), improve: a.improve.trim(), feeling: a.feeling.trim() };
}

export function retroErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body as { errorCode?: unknown } | undefined;
  return typeof body?.errorCode === 'string' ? body.errorCode : null;
}

export function saveFailureMessage(error: unknown): string {
  const code = retroErrorCode(error);
  if (code === 'RETRO_CLOSED') return '작성 기한이 지나 저장하지 못했어요.';
  if (code === 'RETRO_NOT_OPEN') return '미팅이 끝나면 회고를 쓸 수 있어요.';
  return '회고를 저장하지 못했어요. 다시 시도해 주세요.';
}

/* ── 표시 ───────────────────────────────────────────────────────────────── */

/** `11.27 20:00 EST` — 보는 사람의 프로필 시간대 벽시계와 그 순간의 약칭. */
export function shortDateTime(iso: string, zone: string): string {
  const at = new Date(iso);
  const { date, time } = wallParts(at, zone);
  const [, m, d] = date.split('-');
  return `${m}.${d} ${time} ${zoneAbbreviation(zone, at)}`;
}

export function deadlineText(meeting: Pick<RetroMeeting, 'deadline' | 'open'>, zone: string): string {
  const at = shortDateTime(meeting.deadline, zone);
  return meeting.open ? `${at}까지` : `${at} 마감`;
}

/** `2026-11-20 (금)` — 회차 시작 순간을 프로필 시간대로 옮긴 날짜. */
export function meetingDate(scheduledAt: string, zone: string): string {
  return dateWithDow(wallParts(new Date(scheduledAt), zone).date);
}

export function retroHref(locale: string, studyId: string | number, meetingId?: number, write = false): string {
  const base = `/${locale}/my/joined/${studyId}/schedule/retro${write ? '/write' : ''}`;
  return meetingId != null ? `${base}?meeting=${meetingId}` : base;
}
