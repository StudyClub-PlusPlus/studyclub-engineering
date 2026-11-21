'use client';

import { meetingWindow, meetingsOf } from '@core/lib/attendance';
import { isKickoff, meetingLabel, type ProtoMeeting } from '@core/lib/meetings';
import { ME_ID, participantsOf, type Participant } from '@core/lib/schedule-board';
import type { Study } from '@studyclub/types';

/**
 * 스터디 미팅 회고 (프로토) — 미팅이 끝나면 참여자가 좋았던 점 · 개선할 점 · 소감을 남기고,
 * 같은 반 참여자가 문항마다 👍 로 공감한다.
 *
 * 프로토에는 서버가 없다. **서버가 내려줄 판정**(쓸 수 있는가 · 기한 · 작성 현황)을 여기서 흉내 낸다.
 * 화면은 이 값을 그리기만 한다. 내 회고와 내가 누른 👍 는 브라우저(localStorage)에만 남는다.
 *
 * TODO(api): GET  /api/studies/{studyId}/meetings/{meetingId}/retros
 *            PUT  /api/studies/{studyId}/meetings/{meetingId}/retros/me
 *            PUT  /api/studies/{studyId}/meetings/{meetingId}/retros/{retroId}/likes/{section}
 *            DELETE 같은 경로 — 👍 취소
 */

export const RETRO_MAX = 500;
/** 마지막 회차는 다음 회차가 없어 미팅 종료 뒤 이 기간까지 쓴다. */
export const LAST_MEETING_GRACE_DAYS = 7;

export type RetroSection = 'good' | 'improve' | 'feeling';

export const RETRO_SECTIONS: {
  key: RetroSection;
  label: string;
  required: boolean;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: 'good',
    label: '좋았던 점',
    required: true,
    hint: '이번 미팅에서 도움이 됐거나 다음에도 이어 가고 싶은 것',
    placeholder: '예: 같은 예제로 비교해 줘서 차이가 바로 보였어요.',
  },
  {
    key: 'improve',
    label: '개선할 점',
    required: true,
    hint: '다음 미팅에서 바꾸면 좋을 것',
    placeholder: '예: 실습 코드를 미리 공유해 주면 따라가기 쉬울 것 같아요.',
  },
  {
    key: 'feeling',
    label: '소감',
    required: false,
    hint: '오늘 미팅을 마친 느낌을 자유롭게 적어 주세요',
    placeholder: '예: 발표 준비하면서 개념이 정리됐어요. 다음 회차도 기대돼요!',
  },
];

export type RetroAnswers = { good: string; improve: string; feeling: string };

export type Retro = RetroAnswers & {
  authorId: string;
  authorName: string;
  /** 네비게이터면 표시한다. */
  navigator: boolean;
  me: boolean;
  writtenAt: string;
  /** 문항별 👍 수 — 내가 누른 것까지 더한 값. 소감이 비면 그 칸은 없다. */
  likes: Record<RetroSection, number>;
  /** 내가 👍 를 누른 문항. */
  liked: Record<RetroSection, boolean>;
};

/** 회차 한 줄의 회고 상태 — 스터디 일정 회고 칸과 회고 탭 머리가 쓴다. */
export type RetroMeetingStatus = {
  meeting: ProtoMeeting;
  label: string;
  /** 미팅이 끝났는가. 끝나기 전에는 회고가 열리지 않는다. */
  ended: boolean;
  /** 쓰고 고칠 수 있는 마지막 순간. 다음 정규 회차 시작, 마지막 회차는 종료 뒤 7일. */
  deadline: Date;
  /** 지금 쓸 수 있는가 — 끝났고 기한 전. */
  open: boolean;
  /** 내가 썼는가. */
  mine: boolean;
  /** 이 회차 회고를 쓸 사람 — 그날 반에 있던 참여자. */
  targets: number;
  written: number;
};

/* ── 저장 ───────────────────────────────────────────────────────────────── */

const KEY = 'sc_meeting_retros';

type MeetingStore = {
  mine?: RetroAnswers & { writtenAt: string };
  /** `${authorId}:${section}` */
  liked?: string[];
};
type Store = Record<string, Record<string, MeetingStore>>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(studyId: string, meetingId: string, patch: (m: MeetingStore) => MeetingStore): void {
  const store = read();
  const study = store[studyId] ?? {};
  study[meetingId] = patch(study[meetingId] ?? {});
  store[studyId] = study;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}

/* ── 프로토 가정 데이터 ───────────────────────────────────────────────── */

const GOOD = [
  '같은 예제로 비교해 줘서 차이가 바로 보였어요.',
  '발표자가 예제를 직접 만들어 와서 토론이 구체적이었어요.',
  '질문을 많이 받아서 발표 준비한 보람이 있었어요.',
  '표로 정리한 비교 자료가 좋았어요.',
  '실무 사례 이야기가 도움이 됐어요.',
  '시간 안에 딱 끝나서 집중이 잘 됐어요.',
  '다른 사람 코드를 같이 읽어서 배울 게 많았어요.',
];
const IMPROVE = [
  '실습 코드를 미리 공유해 주면 따라가기 쉬울 것 같아요.',
  '시간이 10분 넘었어요. 다음엔 발표 25분으로 끊을게요.',
  '마지막 장까지는 시간이 부족했어요.',
  '화면 공유 글씨가 작았어요.',
  '녹화본이 있으면 좋겠어요.',
  '토론 주제를 미리 알려 주세요.',
  '시작 시간이 자꾸 늦어져요.',
];
const FEELING = [
  '첫 발표라 떨렸는데 끝나고 나니 뿌듯해요.',
  '다들 질문을 많이 해 주셔서 힘이 났어요.',
  '점점 스터디가 습관이 되는 느낌이에요.',
  '',
  '혼자 하던 걸 같이 하니 좋아요.',
  '',
  '다음 주가 기다려져요.',
];

/** 문자열에서 결정적인 작은 수 — 새로고침해도 같은 가정 데이터가 나온다. */
function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/* ── 판정 ───────────────────────────────────────────────────────────────── */

function regularOf(study: Study): ProtoMeeting[] {
  return meetingsOf(study).filter((m) => !isKickoff(m));
}

function deadlineOf(study: Study, list: ProtoMeeting[], i: number): Date {
  const next = list[i + 1];
  if (next) return meetingWindow(study, next).start;
  return new Date(meetingWindow(study, list[i]).end.getTime() + LAST_MEETING_GRACE_DAYS * 86_400_000);
}

/** 그 회차 시작 때 반에 있던 참여자 — 그전에 참여를 중단한 사람은 뺀다. 캡틴은 미팅 참여자가 아니라 뺀다. */
function targetsOf(study: Study, m: ProtoMeeting, people = participantsOf(study)): Participant[] {
  const start = meetingWindow(study, m).start.getTime();
  return people.filter((p) => p.role !== 'captain' && (!p.left || new Date(p.left.at).getTime() >= start));
}

/** 가정 — 다른 참여자는 끝난 회차마다 열에 여섯 꼴로 썼다. 내 회고는 가장 최근에 끝난 회차만 비워 둔다. */
function seededWrote(meetingId: string, authorId: string): boolean {
  return seed(`${meetingId}|${authorId}`) % 10 < 6;
}

export function retroStatuses(study: Study, now = new Date()): RetroMeetingStatus[] {
  const list = regularOf(study);
  const store = read()[study.id] ?? {};
  const endedIds = list.filter((m) => meetingWindow(study, m).end.getTime() <= now.getTime()).map((m) => m.id);
  const latestEnded = endedIds[endedIds.length - 1];
  const people = participantsOf(study);
  return list.map((m, i) => {
    const ended = meetingWindow(study, m).end.getTime() <= now.getTime();
    const deadline = deadlineOf(study, list, i);
    const targets = targetsOf(study, m, people);
    const iWrite = targets.some((p) => p.id === ME_ID);
    const mine = iWrite && (Boolean(store[m.id]?.mine) || (ended && m.id !== latestEnded));
    const others = ended ? targets.filter((p) => p.id !== ME_ID && seededWrote(m.id, p.id)).length : 0;
    return {
      meeting: m,
      label: meetingLabel(m),
      ended,
      deadline,
      open: ended && now.getTime() < deadline.getTime(),
      mine: ended && mine,
      targets: targets.length,
      written: others + (ended && mine ? 1 : 0),
    };
  });
}

export function retroStatusOf(study: Study, meetingId: string, now = new Date()): RetroMeetingStatus | undefined {
  return retroStatuses(study, now).find((s) => s.meeting.id === meetingId);
}

/** 한 회차의 회고 목록 — 내 회고가 맨 앞, 나머지는 쓴 순서. */
export function retrosOf(study: Study, meetingId: string, now = new Date()): Retro[] {
  const status = retroStatusOf(study, meetingId, now);
  if (!status?.ended) return [];
  return buildRetros(study, status, targetsOf(study, status.meeting));
}

/** 회차 상태와 쓸 사람을 이미 구했으면 이걸 부른다 — 모아보기가 회차마다 다시 구하지 않게. */
function buildRetros(study: Study, status: RetroMeetingStatus, people: Participant[]): Retro[] {
  const meetingId = status.meeting.id;
  const saved = read()[study.id]?.[meetingId] ?? {};
  const liked = new Set(saved.liked ?? []);
  const end = meetingWindow(study, status.meeting).end.getTime();
  const out: Retro[] = [];

  for (const p of people) {
    const me = p.id === ME_ID;
    let answers: (RetroAnswers & { writtenAt: string }) | undefined;
    if (me) {
      if (saved.mine) answers = saved.mine;
      else if (status.mine) {
        const s = seed(`${meetingId}|me`);
        answers = {
          good: GOOD[s % GOOD.length],
          improve: IMPROVE[(s >> 3) % IMPROVE.length],
          feeling: FEELING[(s >> 5) % FEELING.length] || FEELING[0],
          writtenAt: new Date(end + 90 * 60_000).toISOString(),
        };
      }
    } else if (seededWrote(meetingId, p.id)) {
      const s = seed(`${meetingId}|${p.id}`);
      answers = {
        good: GOOD[s % GOOD.length],
        improve: IMPROVE[(s >> 3) % IMPROVE.length],
        feeling: FEELING[(s >> 5) % FEELING.length],
        writtenAt: new Date(end + ((s >> 7) % 900) * 60_000).toISOString(),
      };
    }
    if (!answers) continue;

    const likes = {} as Record<RetroSection, number>;
    const mineLiked = {} as Record<RetroSection, boolean>;
    for (const { key } of RETRO_SECTIONS) {
      const on = !me && liked.has(`${p.id}:${key}`);
      mineLiked[key] = on;
      // 가정 — 다른 사람이 누른 수. 0 도 나온다. 이 브라우저에서 방금 쓴 내 회고는 아직 아무도 누르지 않았다.
      const seeded = me && saved.mine ? 0 : seed(`${meetingId}|${p.id}|${key}`) % 6;
      likes[key] = answers[key] ? seeded + (on ? 1 : 0) : 0;
    }
    out.push({
      ...answers,
      authorId: p.id,
      // 동명이인이면 구분이 붙은 이름 (participantsOf)
      authorName: p.name,
      navigator: p.role === 'navigator',
      me,
      writtenAt: answers.writtenAt,
      likes,
      liked: mineLiked,
    });
  }
  return out.sort((a, b) => (a.me === b.me ? a.writtenAt.localeCompare(b.writtenAt) : a.me ? -1 : 1));
}

/** 아직 안 쓴 참여자 — 쓴 사람만 보이면 누가 빠졌는지 모른다. */
export function missingOf(study: Study, meetingId: string, now = new Date()): { id: string; name: string }[] {
  const status = retroStatusOf(study, meetingId, now);
  if (!status?.ended) return [];
  const wrote = new Set(retrosOf(study, meetingId, now).map((r) => r.authorId));
  return targetsOf(study, status.meeting)
    .filter((p) => !wrote.has(p.id))
    .map((p) => ({ id: p.id, name: p.id === ME_ID ? `${p.name} (나)` : p.name }));
}

export function myRetro(study: Study, meetingId: string, now = new Date()): Retro | undefined {
  return retrosOf(study, meetingId, now).find((r) => r.me);
}

export type RetroErrors = Partial<Record<RetroSection, string>>;

export function validateRetro(a: RetroAnswers): RetroErrors {
  const errors: RetroErrors = {};
  for (const s of RETRO_SECTIONS) {
    const v = a[s.key].trim();
    if (s.required && !v) errors[s.key] = `${s.label}을 적어 주세요.`;
    else if (v.length > RETRO_MAX) errors[s.key] = `${RETRO_MAX}자까지 쓸 수 있어요.`;
  }
  return errors;
}

/**
 * 내 회고를 저장한다. 처음이면 작성, 있으면 수정. 기한이 지났거나 미팅이 안 끝났으면 거절한다.
 * 고쳐도 받은 👍 는 남는다.
 */
export function saveMyRetro(
  study: Study,
  meetingId: string,
  answers: RetroAnswers,
  now = new Date(),
): { ok: true } | { ok: false; reason: 'NOT_ENDED' | 'CLOSED' | 'INVALID' } {
  const status = retroStatusOf(study, meetingId, now);
  if (!status?.ended) return { ok: false, reason: 'NOT_ENDED' };
  if (!status.open) return { ok: false, reason: 'CLOSED' };
  if (Object.keys(validateRetro(answers)).length > 0) return { ok: false, reason: 'INVALID' };
  const clean = { good: answers.good.trim(), improve: answers.improve.trim(), feeling: answers.feeling.trim() };
  write(study.id, meetingId, (m) => ({ ...m, mine: { ...clean, writtenAt: now.toISOString() } }));
  return { ok: true };
}

/** 👍 를 누르거나 취소한다. 내 회고에는 누르지 못한다. 소감이 빈 칸에는 누르지 못한다. */
export function toggleLike(study: Study, meetingId: string, authorId: string, section: RetroSection): void {
  if (authorId === ME_ID) return;
  const k = `${authorId}:${section}`;
  write(study.id, meetingId, (m) => {
    const set = new Set(m.liked ?? []);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    return { ...m, liked: [...set] };
  });
}

/** 회고 탭 주소 — 회차를 쿼리로 넘긴다. */
export function retroHref(locale: string, studyId: string | number, meetingId?: string, write = false): string {
  const base = `/proto/core/${locale}/my/joined/${studyId}/schedule/retro${write ? '/write' : ''}`;
  return meetingId ? `${base}?meeting=${encodeURIComponent(meetingId)}` : base;
}

export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ── 백오피스 모아보기 ─────────────────────────────────────────────────── */

export type RetroRow = {
  studyId: string;
  meetingId: string;
  meetingNo: number;
  meetingLabel: string;
  meetingDate: string;
  authorId: string;
  authorName: string;
  /** 없으면 미작성. */
  retro?: Retro;
};

/** 한 스터디의 끝난 회차마다 쓸 사람 한 줄씩 — 안 쓴 사람도 미작성 줄로 넣는다. */
export function retroRowsOf(study: Study, now = new Date()): RetroRow[] {
  const rows: RetroRow[] = [];
  const people = participantsOf(study);
  for (const s of retroStatuses(study, now)) {
    if (!s.ended) continue;
    const targets = targetsOf(study, s.meeting, people);
    const byAuthor = new Map(buildRetros(study, s, targets).map((r) => [r.authorId, r]));
    for (const p of targets) {
      rows.push({
        studyId: study.id,
        meetingId: s.meeting.id,
        meetingNo: s.meeting.no,
        meetingLabel: s.label,
        meetingDate: s.meeting.date,
        authorId: p.id,
        // 표 칸이 좁아 디스코드 구분 없는 닉네임 — 줄은 회차 · 스터디와 함께 보여 동명이인을 가린다
        authorName: p.nickname ?? p.name,
        retro: byAuthor.get(p.id),
      });
    }
  }
  return rows;
}
