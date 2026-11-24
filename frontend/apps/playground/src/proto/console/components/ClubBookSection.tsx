'use client';

import { useMemo, useState } from 'react';

import { ClubAttendanceBoard } from '@console/components/ClubAttendanceBoard';
import { DEMO_TODAY, pastCohorts, seedBook, seedMembers, seedPast } from '@console/lib/club-seed';
import {
  cohortTitle,
  daysIn,
  isoDay,
  monthOf,
  type ClubBook,
  type ClubConfig,
  type ClubMember,
  type Month,
} from '@console/lib/clubs';
import { Select } from '@studyclub/ui';

/** 한 기수의 명단 · 출석 */
export type CohortBook = { members: ClubMember[]; book: ClubBook };

const keyOf = (m: Month) => `${m.year}-${m.month}`;

/**
 * 클럽 출석부 + 기수(월) 고르기.
 * 끝난 기수도 출석을 고칠 수 있다 — 시트에서 늦게 옮기는 경우가 있다. 참여 중단만 이번 기수에서 한다.
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
  onDirtyChange,
}: {
  club: ClubConfig;
  today: string;
  /** 이번 기수 */
  current: CohortBook;
  /** 끝난 기수의 달 — 최신 순 */
  pastMonths: Month[];
  loadPast: (m: Month) => CohortBook;
  savePast: (m: Month, book: ClubBook) => Promise<void>;
  /** 보고 있는 기수의 달. 없으면 이번 기수 */
  month?: Month;
  onMonth: (m: Month | undefined) => void;
  onSave: (next: ClubBook) => Promise<void>;
  onWithdraw: (ids: string[]) => void;
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
        today={isoDay(month, daysIn(month))}
        members={past.members}
        book={past.book}
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
      today={today}
      members={current.members}
      book={current.book}
      monthPicker={picker}
      onDirtyChange={onDirtyChange}
      onSave={onSave}
      onWithdraw={onWithdraw}
    />
  );
}

/**
 * 끝난 기수 출석부의 읽기 · 저장 — 프로토는 가짜 데이터 위에 저장한 것을 덮어 둔다.
 * TODO(api): 그 기수의 study_id 로 GET · POST /api/admin/studies/{studyId}/attendances
 */
export function usePastBooks(club: ClubConfig) {
  const [saved, setSaved] = useState<Record<string, ClubBook>>({});
  const loadPast = useMemo(
    () =>
      (m: Month): CohortBook => {
        const base = seedPast(club, m);
        return { ...base, book: saved[`${club.key}:${keyOf(m)}`] ?? base.book };
      },
    [club, saved],
  );
  const savePast = async (m: Month, book: ClubBook) => {
    await new Promise((r) => setTimeout(r, 400));
    setSaved((x) => ({ ...x, [`${club.key}:${keyOf(m)}`]: book }));
  };
  return { loadPast, savePast };
}

/** 지난 기수 달 목록 — 지난 기수 표와 같은 것 */
export function pastMonthsOf(club: ClubConfig, today: string): Month[] {
  return pastCohorts(club, monthOf(today)).map((c) => c.month);
}

/**
 * 스터디 상세(클럽 기수) › 출석 — 클럽 운영 › 출석부와 같은 출석부를 혼자 들고 그린다.
 * TODO(api): GET · POST /api/admin/studies/{studyId}/attendances
 */
export function ClubStudyAttendance({
  club,
  onDirtyChange,
}: {
  club: ClubConfig;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const today = DEMO_TODAY.after;
  const [members, setMembers] = useState(() => seedMembers(club));
  const [book, setBook] = useState(() => seedBook(club, members, today));
  const [month, setMonth] = useState<Month | undefined>();
  const { loadPast, savePast } = usePastBooks(club);
  return (
    <ClubBookSection
      club={club}
      today={today}
      current={{ members, book }}
      pastMonths={pastMonthsOf(club, today)}
      loadPast={loadPast}
      savePast={savePast}
      month={month}
      onMonth={setMonth}
      onDirtyChange={onDirtyChange}
      onSave={async (next) => {
        await new Promise((r) => setTimeout(r, 400));
        setBook(next);
      }}
      onWithdraw={(ids) => setMembers((ms) => ms.map((m) => (ids.includes(m.id) ? { ...m, leftOn: today } : m)))}
    />
  );
}
