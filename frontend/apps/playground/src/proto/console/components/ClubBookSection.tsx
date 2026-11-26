'use client';

import { useMemo, useState } from 'react';

import { ClubAttendanceBoard } from '@console/components/ClubAttendanceBoard';
import { DEMO_TODAY, pastCohorts, seedMembers, seedPast } from '@console/lib/club-seed';
import {
  cohortTitle,
  daysIn,
  isoDay,
  monthOf,
  CLUBS,
  type ClubBook,
  type ClubConfig,
  type ClubMember,
  type Month,
} from '@console/lib/clubs';
import { Select } from '@studyclub/ui';

import { bookFromRoom, seedRoom, useClubRoom, type ClubRoom } from '@/proto/club/room';

/** 한 기수의 명단 · 기록 */
export type CohortBook = { members: ClubMember[]; room: ClubRoom };

const keyOf = (m: Month) => `${m.year}-${m.month}`;

/**
 * 클럽 출석부 + 기수(월) 고르기.
 * 끝난 기수도 기록을 고칠 수 있다 — 시트에서 늦게 옮기는 경우가 있다. 참여 중단만 이번 기수에서 한다.
 * 데이터를 어디서 가져오는지는 모른다 — 지난 기수 목록과 읽기 · 저장은 부르는 쪽이 넘긴다.
 */
export function ClubBookSection({
  club,
  today,
  current,
  pastMonths,
  loadPast,
  savePast,
  month,
  onMonth,
  onSave,
  onWithdraw,
  onReinstate,
  onDirtyChange,
}: {
  club: ClubConfig;
  today: string;
  /** 이번 기수 */
  current: CohortBook;
  /** 끝난 기수의 달 — 최신 순 */
  pastMonths: Month[];
  loadPast: (m: Month) => CohortBook;
  savePast: (m: Month, room: ClubRoom) => Promise<void>;
  /** 보고 있는 기수의 달. 없으면 이번 기수 */
  month?: Month;
  onMonth: (m: Month | undefined) => void;
  onSave: (next: ClubRoom) => Promise<void>;
  onWithdraw: (ids: string[]) => void;
  /** 참여 중단 취소 — 이번 기수에서만 */
  onReinstate: (id: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const now = monthOf(today);
  const options = [now, ...pastMonths];
  const isPast = month !== undefined && keyOf(month) !== keyOf(now);
  const past = useMemo(() => (isPast && month ? loadPast(month) : undefined), [isPast, month, loadPast]);

  const picker = (
    <span data-anno='clubbook:1-4'>
      <Select
        size='sm'
        aria-label='기수'
        value={keyOf(month ?? now)}
        onChange={(e) => {
          const m = options.find((o) => keyOf(o) === e.target.value);
          onMonth(m && keyOf(m) !== keyOf(now) ? m : undefined);
        }}
      >
        {options.map((o, i) => (
          <option key={keyOf(o)} value={keyOf(o)}>
            {`${o.year}년 ${o.month}월${i === 0 ? ' (이번 기수)' : ''}`}
          </option>
        ))}
      </Select>
    </span>
  );

  if (past && month) {
    return (
      <ClubAttendanceBoard
        key={keyOf(month)}
        club={club}
        cohortTitle={cohortTitle(club, month)}
        room={past.room}
        members={past.members}
        ended
        monthPicker={picker}
        onDirtyChange={onDirtyChange}
        onSave={(next) => savePast(month, next)}
        onWithdraw={() => {}}
      />
    );
  }
  return (
    <ClubAttendanceBoard
      key='current'
      club={club}
      cohortTitle={cohortTitle(club, now)}
      room={current.room}
      members={current.members}
      monthPicker={picker}
      onDirtyChange={onDirtyChange}
      onSave={onSave}
      onWithdraw={onWithdraw}
      onReinstate={onReinstate}
    />
  );
}

/**
 * 끝난 기수 기록의 읽기 · 저장 — 프로토는 가짜 데이터 위에 저장한 것을 덮어 둔다.
 * TODO(api): GET · PUT /api/admin/clubs/{programId}/checkins?month=
 */
export function usePastBooks(club: ClubConfig) {
  const [saved, setSaved] = useState<Record<string, ClubRoom>>({});
  const loadPast = useMemo(
    () =>
      (m: Month): CohortBook => {
        const { members } = seedPast(club, m);
        const room = saved[`${club.key}:${keyOf(m)}`] ?? seedRoom(club, isoDay(m, daysIn(m)));
        return { members, room };
      },
    [club, saved],
  );
  const savePast = async (m: Month, room: ClubRoom) => {
    await new Promise((r) => setTimeout(r, 400));
    setSaved((x) => ({ ...x, [`${club.key}:${keyOf(m)}`]: room }));
  };
  return { loadPast, savePast };
}

/** 지난 기수 달 목록 — 지난 기수 표와 같은 것 */
export function pastMonthsOf(club: ClubConfig, today: string): Month[] {
  return pastCohorts(club, monthOf(today)).map((c) => c.month);
}

/** 스터디 상세(클럽 기수)의 이번 기수 명단 · 기록 — 위 요약 칸(출석률)과 출석 탭이 같은 값을 본다 */
export type ClubCohortState = {
  today: string;
  members: ClubMember[];
  room: ClubRoom;
  /** 날 단위 기록을 출석 값으로 — 요약 칸이 쓴다 */
  book: ClubBook;
  setMembers: (fn: (ms: ClubMember[]) => ClubMember[]) => void;
  setRoom: (next: ClubRoom) => void;
};

/**
 * 이번 기수 명단 · 기록을 들고 있는다 — 사용자 사이트 출석 탭 · 클럽 운영 출석부와 같은 기록. 클럽이 아니면 빈 값.
 * TODO(api): GET /api/admin/clubs/{programId}/checkins
 */
export function useClubCohort(club: ClubConfig | undefined): ClubCohortState {
  const today = DEMO_TODAY.after;
  const [members, setMembers] = useState<ClubMember[]>(() => (club ? seedMembers(club) : []));
  // 클럽이 아니면 쓰지 않는다 — 훅은 늘 부르므로 아무 클럽 자리를 연다
  const [room, setRoom] = useClubRoom(club ?? CLUBS[0], today);
  return {
    today,
    members,
    room,
    book: club ? bookFromRoom(room) : {},
    setMembers,
    setRoom: (next) => setRoom(() => next),
  };
}

/**
 * 스터디 상세(클럽 기수) › 출석 — 클럽 운영 › 출석부와 같은 출석부.
 * TODO(api): GET · PUT /api/admin/clubs/{programId}/checkins
 */
export function ClubStudyAttendance({
  club,
  cohort,
  onDirtyChange,
}: {
  club: ClubConfig;
  cohort: ClubCohortState;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { today, members, room, setMembers, setRoom } = cohort;
  const [month, setMonth] = useState<Month | undefined>();
  const { loadPast, savePast } = usePastBooks(club);
  return (
    <ClubBookSection
      club={club}
      today={today}
      current={{ members, room }}
      pastMonths={pastMonthsOf(club, today)}
      loadPast={loadPast}
      savePast={savePast}
      month={month}
      onMonth={setMonth}
      onDirtyChange={onDirtyChange}
      onSave={async (next) => {
        await new Promise((r) => setTimeout(r, 400));
        setRoom(next);
      }}
      onWithdraw={(ids) => setMembers((ms) => ms.map((m) => (ids.includes(m.id) ? { ...m, leftOn: today } : m)))}
      onReinstate={(id) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, leftOn: undefined } : m)))}
    />
  );
}
