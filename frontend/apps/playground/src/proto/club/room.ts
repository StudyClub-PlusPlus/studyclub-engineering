'use client';

import { useEffect, useState } from 'react';

import { seedMembers } from '@console/lib/club-seed';
import type { ClubBook, ClubConfig, ClubMember } from '@console/lib/clubs';
import {
  addDays,
  currentStreak,
  dayRate,
  doneDays,
  goalOf,
  monthKey,
  mondayOf,
  seedMyClub,
  weekTotal,
  type DemoDay,
  type MyClubState,
  type RecordSource,
} from '@core/lib/my-club';
import type { AttendanceStatus } from '@studyclub/types';

/**
 * 클럽 한 곳의 이번 달 기록 — 멤버 전원.
 *
 * 크루의 「오늘」 탭(내 기록)과 「출석」 탭(함께 보기), 캡틴의 출석부가 **같은 기록**을 본다.
 * 크루는 자기 줄만 남기고(또는 자동으로 들어오고), 캡틴은 누구 줄이든 고친다.
 *
 * TODO(api): GET /api/clubs/{programId}/board?month= (멤버) · GET /api/admin/clubs/{programId}/checkins (캡틴)
 */
export type ClubRoom = {
  club: ClubConfig;
  today: string;
  members: ClubMember[];
  /** 멤버 id → 그 사람의 기록 (「내 클럽」과 같은 모양) */
  states: Record<string, MyClubState>;
  /** 프로토의 「나」 — 명단 첫 사람 */
  meId: string;
};

/** 시드 — 다섯째 사람은 이번 달을 쉬고, 참여 중단한 사람은 그날 뒤 기록이 없다 */
export function seedRoom(club: ClubConfig, today: string, meResting = false): ClubRoom {
  const members = seedMembers(club);
  const states: Record<string, MyClubState> = {};
  members.forEach((m, i) => {
    const resting = i === 0 ? meResting : i === 5;
    const st = seedMyClub(club, today, resting ? { kind: 'resting', until: monthKey(today) } : { kind: 'active' }, i);
    if (m.leftOn) {
      for (const d of Object.keys(st.days)) if (d > m.leftOn) delete st.days[d];
      for (const d of Object.keys(st.minutes)) if (d > m.leftOn) delete st.minutes[d];
    }
    // 캡틴이 고친 칸 예시 — 시트에서 옮기며 한 칸 고쳤다
    if (i === 2 && club.rules.record === 'check') {
      const d = addDays(today, -4);
      st.days[d] = 'present';
      st.byCaptain = { [d]: true };
    }
    states[m.id] = st;
  });
  return { club, today, members, states, meId: members[0].id };
}

/* ── 같은 기록을 여러 화면이 본다 — 프로토는 모듈 안에 들고 있는다 ─────────── */

const rooms = new Map<string, ClubRoom>();
const listeners = new Set<() => void>();
const keyOf = (club: ClubConfig, today: string, meResting: boolean) => `${club.key}:${today}:${meResting}`;

export function getRoom(club: ClubConfig, today: string, meResting = false): ClubRoom {
  const k = keyOf(club, today, meResting);
  if (!rooms.has(k)) rooms.set(k, seedRoom(club, today, meResting));
  return rooms.get(k)!;
}

/** 같은 클럽 · 같은 「오늘」이면 어느 화면에서 고쳐도 다른 화면에 보인다 */
export function useClubRoom(
  club: ClubConfig,
  today: string,
  meResting = false,
): [ClubRoom, (f: (r: ClubRoom) => ClubRoom) => void] {
  const [room, setLocal] = useState(() => getRoom(club, today, meResting));
  useEffect(() => {
    const on = () => setLocal(getRoom(club, today, meResting));
    on();
    listeners.add(on);
    return () => void listeners.delete(on);
  }, [club, today, meResting]);
  const set = (f: (r: ClubRoom) => ClubRoom) => {
    rooms.set(keyOf(club, today, meResting), f(getRoom(club, today, meResting)));
    listeners.forEach((l) => l());
  };
  return [room, set];
}

/** 한 사람의 기록만 바꾼다 */
export function patchMember(room: ClubRoom, id: string, f: (s: MyClubState) => MyClubState): ClubRoom {
  return { ...room, states: { ...room.states, [id]: f(room.states[id]) } };
}

/* ── 기록 → 숫자 · 출처 ─────────────────────────────────────────────── */

export function sourceOf(room: ClubRoom, id: string, day: string): RecordSource {
  if (room.states[id]?.byCaptain?.[day]) return 'captain';
  return room.club.rules.source;
}

/** 출석부 오른쪽 칸 — 클럽 설정의 앞에 보이는 숫자 */
export function metricOf(room: ClubRoom, id: string): { main: string; sub: string } {
  const s = room.states[id];
  const { today, club } = room;
  if (!s || s.membership.kind === 'resting') return { main: '쉼', sub: '' };
  const month = monthKey(today);
  if (club.rules.metric === 'streak')
    return { main: `${currentStreak(s, today)}일`, sub: `한 날 ${doneDays(s, month)}` };
  if (club.rules.metric === 'weekPercent') {
    const w = mondayOf(today);
    const goal = goalOf(s, w).min;
    return goal === 0
      ? { main: '쉬는 주', sub: '' }
      : { main: `${Math.round((weekTotal(s, w) / goal) * 1000) / 10}%`, sub: '이번 주' };
  }
  const r = dayRate(s, month, today);
  return { main: r === null ? '-' : `${r}%`, sub: `한 날 ${doneDays(s, month)}` };
}

/**
 * 살펴볼 사람 — 며칠째 기록이 없는 참여 중 멤버. 내보내지 않는다(자동 제명 없음). 캡틴이 연락할 때 쓴다.
 * 날 단위는 어제부터 `days` 일 동안 기록이 없음, 주 단위는 같은 기간 공부 시간이 0.
 */
export function quietMembers(room: ClubRoom, days = 3): ClubMember[] {
  const span = Array.from({ length: days }, (_, i) => addDays(room.today, -1 - i));
  return room.members.filter((m) => {
    const s = room.states[m.id];
    if (m.leftOn || !s || s.membership.kind === 'resting') return false;
    return room.club.rules.record === 'minutes' ? span.every((d) => !s.minutes[d]) : span.every((d) => !s.days[d]);
  });
}

/** 다음 달 쉬기를 고른 멤버 */
export function restingNext(room: ClubRoom): ClubMember[] {
  return room.members.filter((m) => !m.leftOn && room.states[m.id]?.restNextMonth);
}

/** 날 단위 기록 → 지금 출석부의 출석 값 (붙여넣기 · 이어서 참여 · 기수 숫자가 쓰는 모양) */
export function bookFromRoom(room: ClubRoom): ClubBook {
  const book: ClubBook = {};
  for (const m of room.members) book[m.id] = { ...(room.states[m.id]?.days ?? {}) } as Record<string, AttendanceStatus>;
  return book;
}

/* ── 검토용 「오늘」 · 내 상태 — 오늘 탭과 출석 탭이 같은 값을 본다 (프로토 도구) ── */

export type ClubDemo = { day: DemoDay; resting: boolean };
let demo: ClubDemo = { day: 'wed', resting: false };
const demoListeners = new Set<() => void>();

export function useClubDemo(): [ClubDemo, (d: ClubDemo) => void] {
  const [v, setV] = useState(demo);
  useEffect(() => {
    const on = () => setV(demo);
    demoListeners.add(on);
    return () => void demoListeners.delete(on);
  }, []);
  return [
    v,
    (d) => {
      demo = d;
      demoListeners.forEach((l) => l());
    },
  ];
}
