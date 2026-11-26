'use client';

import { useState, type ReactNode } from 'react';

import type { ClubMember } from '@console/lib/clubs';
import {
  addDays,
  currentStreak,
  fmtMin,
  goalOf,
  isoWeek,
  marksFor,
  shortDay,
  weekDays,
  weekPercent,
  weekTotal,
  weekday,
  type DayMark,
  type MyClubState,
} from '@core/lib/my-club';
import { Input, cx } from '@studyclub/ui';

import { metricOf, patchMember, sourceOf, type ClubRoom } from './room';

/**
 * 클럽 출석부 — 멤버 × 날짜. 지금 시트와 같은 모양을 한 부품으로 그린다.
 *
 * - 크루(사용자 사이트 › 출석 탭)는 **보기** — 클럽 멤버 전원의 기록을 본다. 자기 기록은 「오늘」 탭에서 남긴다
 * - 캡틴(같은 탭 · 운영 콘솔 출석부)은 **고치기** — 누구 칸이든 고친다. 고친 칸에는 표시가 남는다
 *
 * 칸 모양은 클럽 설정(`rules`)이 정한다 — 날 단위는 날짜 칸(값은 스터디와 같은 출석 · 지각 · 결석 · 휴가 — LeetCode 는 출석 · 지각 칸에 그날까지 연속일 숫자),
 * 주 단위는 한 주의 날마다 공부 시간 + 목표 · 합계 · 달성률 · 한 줄 (WEEKLY X 시트).
 */

const CELL: Record<DayMark, string> = {
  present: 'bg-success-100 text-success-700',
  late: 'bg-warning-100 text-warning-700',
  absent: 'bg-error-50 text-error-700',
  excused: 'bg-surface-2 text-fg-secondary',
};
const SHORT: Record<DayMark, string> = { present: '출', late: '지', absent: '결', excused: '휴' };
const LABEL: Record<DayMark, string> = { present: '출석', late: '지각', absent: '결석', excused: '휴가' };
const SOURCE_LABEL = { crew: '크루가 남김', auto: '자동 기록', captain: '캡틴이 고침' } as const;

type Anno = Partial<Record<'table' | 'name' | 'extra' | 'dayHead' | 'cell' | 'total' | 'counts' | 'legend', string>>;

export type ClubBoardProps = {
  room: ClubRoom;
  /** 날 단위의 열 — 그 기간의 날짜 */
  days: string[];
  /** 주 단위에서 보는 주의 월요일 */
  week?: string;
  /** 고치기 — 없으면 보기 */
  onRoom?: (f: (r: ClubRoom) => ClubRoom) => void;
  /** 저장 전 값 — 바뀐 칸에 테두리 */
  baseline?: ClubRoom;
  /** 맨 앞 칸 (캡틴의 고르기 상자) */
  lead?: { head: ReactNode; cell: (m: ClubMember) => ReactNode };
  /** 이름 아래 덧붙임 (참여 중단 취소 등) */
  nameExtra?: (m: ClubMember) => ReactNode;
  /** 날마다 한 사람 수 줄 (LeetCode 시트의 1행) */
  showCounts?: boolean;
  anno?: Anno;
};

export function ClubBoard(props: ClubBoardProps) {
  return props.room.club.rules.judge === 'week' ? <WeekBoard {...props} /> : <DayBoard {...props} />;
}

function rowsOf(room: ClubRoom): ClubMember[] {
  // 나를 맨 위에, 쉬는 사람 · 중단한 사람은 아래로
  const rank = (m: ClubMember) =>
    m.id === room.meId ? 0 : m.leftOn ? 3 : room.states[m.id]?.membership.kind === 'resting' ? 2 : 1;
  return [...room.members].sort((a, b) => rank(a) - rank(b));
}

function NameCell({
  room,
  m,
  nameExtra,
  sticky,
  anno,
}: {
  room: ClubRoom;
  m: ClubMember;
  nameExtra?: (m: ClubMember) => ReactNode;
  sticky: string;
  anno?: string;
}) {
  const resting = room.states[m.id]?.membership.kind === 'resting';
  return (
    <td data-anno={anno} className={cx('sticky z-10 border-t border-border bg-surface-raised px-2 py-1', sticky)}>
      <span className='block truncate type-label-lg' title={m.name}>
        {m.name}
        {m.id === room.meId && <span className='ml-1 type-label-sm text-brand'>나</span>}
      </span>
      {m.leftOn && <span className='block type-label-sm text-fg-muted'>{shortDay(m.leftOn)} 참여 중단</span>}
      {resting && <span className='block type-label-sm text-fg-muted'>이번 달 쉬는 중</span>}
      {nameExtra?.(m)}
    </td>
  );
}

function Legend({ room, anno, extra }: { room: ClubRoom; anno?: string; extra?: ReactNode }) {
  const r = room.club.rules;
  return (
    <ul data-anno={anno} className='mb-3 flex flex-wrap items-center gap-3 type-label-sm text-fg-muted'>
      {r.judge === 'day' &&
        marksFor(r).map((k) => (
          <li key={k} className='flex items-center gap-1.5'>
            <span className={cx('grid h-5 w-5 place-items-center rounded-sm', CELL[k])}>{SHORT[k]}</span>
            {LABEL[k]}
            {k === 'late' && ' (0.5일)'}
          </li>
        ))}
      {r.judge === 'day' && (
        <li className='flex items-center gap-1.5'>
          <span className='h-5 w-5 rounded-sm border border-border bg-surface-1' />
          기록 없음
        </li>
      )}
      <li className='flex items-center gap-1.5'>
        <span className='relative h-5 w-5 rounded-sm border border-border bg-surface-1'>
          <span className='absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand' />
        </span>
        {SOURCE_LABEL.captain} · 나머지는 {SOURCE_LABEL[r.source]}
      </li>
      {extra}
    </ul>
  );
}

/* ── 날 단위 ─────────────────────────────────────────────────────── */

function DayBoard({ room, days, onRoom, baseline, lead, nameExtra, showCounts, anno = {} }: ClubBoardProps) {
  const r = room.club.rules;
  const cycle = marksFor(r);
  const rows = rowsOf(room);
  const nameLeft = lead ? 'left-10' : 'left-0';

  const editable = (m: ClubMember, d: string) =>
    Boolean(onRoom) &&
    d <= room.today &&
    !(m.leftOn && d > m.leftOn) &&
    room.states[m.id]?.membership.kind !== 'resting';

  function next(cur: DayMark | undefined): DayMark | undefined {
    if (!cur) return cycle[0];
    const i = cycle.indexOf(cur);
    return i < 0 || i === cycle.length - 1 ? undefined : cycle[i + 1];
  }

  function setCell(id: string, d: string, v: DayMark | undefined) {
    onRoom?.((rm) =>
      patchMember(rm, id, (s: MyClubState) => {
        const days2 = { ...s.days };
        if (v) days2[d] = v;
        else delete days2[d];
        return { ...s, days: days2, byCaptain: { ...(s.byCaptain ?? {}), [d]: true } };
      }),
    );
  }

  // 출석 · 지각만 센다 — 결석 · 휴가는 한 날이 아니다
  const counts = days.map(
    (d) => rows.filter((m) => ['present', 'late'].includes(room.states[m.id]?.days[d] ?? '')).length,
  );

  return (
    <div>
      <Legend room={room} anno={anno.legend} />
      <div className='card overflow-x-auto'>
        <table data-anno={anno.table} className='min-w-full border-separate border-spacing-0 type-body-sm'>
          <thead>
            <tr className='bg-surface-1'>
              {lead && <th className='sticky left-0 z-10 w-10 bg-surface-1 px-3 py-2'>{lead.head}</th>}
              <th
                data-anno={anno.name}
                className={cx(
                  'sticky z-10 w-32 bg-surface-1 px-2 py-2 text-left type-label-sm text-fg-muted',
                  nameLeft,
                )}
              >
                디스코드 별명
              </th>
              {room.club.rosterQuestion && (
                <th
                  data-anno={anno.extra}
                  className='whitespace-nowrap px-2 py-2 text-left type-label-sm text-fg-muted'
                >
                  {room.club.rosterQuestion.label}
                </th>
              )}
              {days.map((d, i) => (
                <th
                  key={d}
                  data-anno={i === 0 ? anno.dayHead : undefined}
                  className={cx(
                    'min-w-9 px-0.5 py-1 text-center type-label-sm',
                    d === room.today ? 'text-brand' : d > room.today ? 'text-fg-muted' : 'text-fg',
                  )}
                >
                  <span className='tnum block'>{Number(d.slice(8))}</span>
                  <span className='block text-fg-muted'>{d === room.today ? '오늘' : shortDay(d).slice(-2, -1)}</span>
                </th>
              ))}
              <th
                data-anno={anno.total}
                className='sticky right-0 z-10 min-w-16 whitespace-nowrap bg-surface-1 px-2 py-2 text-right type-label-sm text-fg-muted'
              >
                {r.metric === 'streak' ? '연속일' : '출석률'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, ri) => {
              const s = room.states[m.id];
              const dim = Boolean(m.leftOn) || s?.membership.kind === 'resting';
              const metric = metricOf(room, m.id);
              return (
                <tr key={m.id} className={cx(dim && 'text-fg-muted', m.id === room.meId && 'font-semibold')}>
                  {lead && (
                    <td className='sticky left-0 z-10 border-t border-border bg-surface-raised px-3 py-1'>
                      {lead.cell(m)}
                    </td>
                  )}
                  <NameCell room={room} m={m} nameExtra={nameExtra} sticky={nameLeft} />
                  {room.club.rosterQuestion && (
                    <td className='tnum whitespace-nowrap border-t border-border px-2 py-1 type-label-sm'>{m.extra}</td>
                  )}
                  {days.map((d, di) => {
                    const v = s?.days[d];
                    const was = baseline?.states[m.id]?.days[d];
                    const changed = baseline !== undefined && was !== v;
                    const captain = sourceOf(room, m.id, d) === 'captain' && v !== undefined;
                    const text = v
                      ? r.metric === 'streak' && (v === 'present' || v === 'late')
                        ? String(currentStreak(s!, d))
                        : SHORT[v]
                      : '';
                    const label = `${m.name} ${shortDay(d)} ${v ? LABEL[v] : '기록 없음'}${captain ? ' · 캡틴이 고침' : ''}`;
                    const body = (
                      <>
                        {text}
                        {captain && <span className='absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand' />}
                      </>
                    );
                    const cls = cx(
                      'relative grid h-8 w-full place-items-center rounded-sm type-label-sm tnum',
                      v ? CELL[v] : d > room.today || dim ? 'text-fg-muted' : 'bg-surface-1',
                      changed && 'ring-2 ring-border-strong',
                    );
                    return (
                      <td key={d} className='border-t border-border px-0.5 py-1'>
                        {editable(m, d) ? (
                          <button
                            // ui-native: 출석부 칸 — 칸 전체가 누르는 곳이고 누를 때마다 값이 돈다
                            type='button'
                            data-anno={ri === 0 && di === 0 ? anno.cell : undefined}
                            aria-label={changed ? `${label} · 저장되지 않음` : label}
                            onClick={() => setCell(m.id, d, next(v))}
                            className={cx(cls, !v && 'hover:bg-surface-2')}
                          >
                            {body}
                          </button>
                        ) : (
                          <span
                            role='img'
                            data-anno={ri === 0 && di === 0 ? anno.cell : undefined}
                            aria-label={label}
                            className={cls}
                          >
                            {body}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className='tnum sticky right-0 z-10 min-w-16 whitespace-nowrap border-t border-border bg-surface-raised px-2 py-1 text-right type-label-sm'>
                    <span className='block text-fg'>{metric.main}</span>
                    <span className='block text-fg-muted'>{metric.sub}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {showCounts && (
            <tfoot>
              <tr data-anno={anno.counts} className='bg-surface-1'>
                {lead && <td className='sticky left-0 z-10 bg-surface-1' />}
                <td className={cx('sticky z-10 bg-surface-1 px-2 py-1.5 type-label-sm text-fg-muted', nameLeft)}>
                  출석 · 지각
                </td>
                {room.club.rosterQuestion && <td />}
                {days.map((d, i) => (
                  <td key={d} className='tnum px-0.5 py-1.5 text-center type-label-sm text-fg-secondary'>
                    {d <= room.today ? counts[i] : ''}
                  </td>
                ))}
                <td className='sticky right-0 z-10 bg-surface-1' />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ── 주 단위 ─────────────────────────────────────────────────────── */

/** 「1:30」 → 90. 빈 칸은 undefined, 읽을 수 없으면 null */
function parseHm(v: string): number | undefined | null {
  const t = v.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] ?? 0);
}
const hm = (min: number | undefined) =>
  min === undefined ? '' : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

function WeekBoard({ room, week, onRoom, baseline, lead, nameExtra, anno = {} }: ClubBoardProps) {
  const monday = week ?? room.today;
  const days = weekDays(monday);
  const rows = rowsOf(room);
  const nameLeft = lead ? 'left-10' : 'left-0';
  const editable = (m: ClubMember, d: string) =>
    Boolean(onRoom) &&
    d <= room.today &&
    !(m.leftOn && d > m.leftOn) &&
    room.states[m.id]?.membership.kind !== 'resting';

  return (
    <div>
      <Legend
        room={room}
        anno={anno.legend}
        extra={<li>시간은 「시:분」 · 목표 0 은 쉬는 주 · 달성률 = 합계 ÷ 목표</li>}
      />
      <div className='card overflow-x-auto'>
        <table data-anno={anno.table} className='min-w-full border-separate border-spacing-0 type-body-sm'>
          <thead>
            <tr className='bg-surface-1 text-left type-label-sm text-fg-muted'>
              {lead && <th className='sticky left-0 z-10 w-10 bg-surface-1 px-3 py-2'>{lead.head}</th>}
              <th data-anno={anno.name} className={cx('sticky z-10 w-32 bg-surface-1 px-2 py-2', nameLeft)}>
                디스코드 별명
              </th>
              <th data-anno={anno.extra} className='whitespace-nowrap px-2 py-2'>
                {isoWeek(monday)}주차 목표
              </th>
              {days.map((d, i) => (
                <th
                  key={d}
                  data-anno={i === 0 ? anno.dayHead : undefined}
                  className={cx('min-w-16 px-1 py-2 text-center', d === room.today && 'text-brand')}
                >
                  {shortDay(d)}
                </th>
              ))}
              <th className='whitespace-nowrap px-2 py-2 text-right'>합계</th>
              <th data-anno={anno.total} className='whitespace-nowrap px-2 py-2 text-right'>
                달성률
              </th>
              <th className='min-w-40 px-2 py-2'>한 줄</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, ri) => {
              const s = room.states[m.id];
              const resting = s?.membership.kind === 'resting';
              const dim = Boolean(m.leftOn) || resting;
              const goal = s ? goalOf(s, monday) : undefined;
              const p = s && !resting ? weekPercent(s, monday) : null;
              return (
                <tr key={m.id} className={cx(dim && 'text-fg-muted', m.id === room.meId && 'font-semibold')}>
                  {lead && (
                    <td className='sticky left-0 z-10 border-t border-border bg-surface-raised px-3 py-1'>
                      {lead.cell(m)}
                    </td>
                  )}
                  <NameCell room={room} m={m} nameExtra={nameExtra} sticky={nameLeft} />
                  <td className='tnum whitespace-nowrap border-t border-border px-2 py-1'>
                    {resting || !goal ? (
                      '-'
                    ) : onRoom && !m.leftOn ? (
                      <GoalInput
                        key={`${m.id}-${monday}-${goal.min}`}
                        min={goal.min}
                        label={`${m.name} ${isoWeek(monday)}주차 목표`}
                        onCommit={(min) =>
                          onRoom((rm) =>
                            patchMember(rm, m.id, (st) => ({
                              ...st,
                              weeks: { ...st.weeks, [monday]: { ...(st.weeks[monday] ?? {}), goalMin: min } },
                            })),
                          )
                        }
                      />
                    ) : goal.min === 0 ? (
                      '쉬는 주'
                    ) : (
                      fmtMin(goal.min)
                    )}
                  </td>
                  {days.map((d, di) => {
                    const v = s?.minutes[d];
                    const changed = baseline !== undefined && baseline.states[m.id]?.minutes[d] !== v;
                    const captain = sourceOf(room, m.id, d) === 'captain' && v !== undefined;
                    return (
                      <td
                        key={d}
                        data-anno={ri === 0 && di === 0 ? anno.cell : undefined}
                        className='relative border-t border-border px-1 py-1 text-center'
                      >
                        {editable(m, d) ? (
                          <MinutesInput
                            key={`${m.id}-${d}-${v}`}
                            value={v}
                            changed={changed}
                            label={`${m.name} ${shortDay(d)} 공부 시간`}
                            onCommit={(min) =>
                              onRoom!((rm) =>
                                patchMember(rm, m.id, (st) => {
                                  const minutes = { ...st.minutes };
                                  if (min === undefined) delete minutes[d];
                                  else minutes[d] = min;
                                  return { ...st, minutes, byCaptain: { ...(st.byCaptain ?? {}), [d]: true } };
                                }),
                              )
                            }
                          />
                        ) : (
                          <span className='tnum type-label-sm'>{d > room.today ? '' : hm(v)}</span>
                        )}
                        {captain && <span className='absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand' />}
                      </td>
                    );
                  })}
                  <td className='tnum whitespace-nowrap border-t border-border px-2 py-1 text-right'>
                    {s && !resting ? fmtMin(weekTotal(s, monday)) : ''}
                  </td>
                  <td className='tnum whitespace-nowrap border-t border-border px-2 py-1 text-right text-fg'>
                    {resting ? '쉼' : goal?.min === 0 ? '쉬는 주' : p === null ? '-' : `${p}%`}
                  </td>
                  <td className='border-t border-border px-2 py-1 type-label-sm text-fg-secondary'>
                    {s?.weeks[monday]?.note ?? ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MinutesInput({
  value,
  changed,
  label,
  onCommit,
}: {
  value: number | undefined;
  changed: boolean;
  label: string;
  onCommit: (min: number | undefined) => void;
}) {
  const [text, setText] = useState(hm(value));
  const parsed = parseHm(text);
  return (
    <span className={cx('block rounded-sm', changed && 'ring-2 ring-border-strong')}>
      <Input
        size='sm'
        aria-label={label}
        placeholder='0:00'
        value={text}
        error={parsed === null ? '시:분' : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (parsed !== null && parsed !== value) onCommit(parsed);
        }}
      />
    </span>
  );
}

function GoalInput({ min, label, onCommit }: { min: number; label: string; onCommit: (min: number) => void }) {
  const [text, setText] = useState(String(min / 60));
  return (
    <span className='block w-20'>
      <Input
        size='sm'
        type='number'
        min={0}
        step={0.5}
        suffix='시간'
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (text !== '' && n >= 0 && Math.round(n * 60) !== min) onCommit(Math.round(n * 60));
        }}
      />
    </span>
  );
}

/** 주 단위 출석부에서 고를 수 있는 주 — 최근 n 주, 최근 것이 앞 */
export function boardWeeks(today: string, n = 6): string[] {
  const out: string[] = [];
  let m = addDays(today, -((weekday(today) + 6) % 7));
  for (let i = 0; i < n; i++, m = addDays(m, -7)) out.push(m);
  return out;
}
