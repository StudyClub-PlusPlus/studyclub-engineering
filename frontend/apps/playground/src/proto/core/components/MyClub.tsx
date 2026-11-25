'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ClubConfig } from '@console/lib/clubs';
import { type Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import {
  DEMO_DAYS,
  DEMO_LABEL,
  addDays,
  dayRate,
  daysOfMonth,
  fmtMin,
  goalOf,
  monthKey,
  mondayOf,
  retroWindow,
  seedHistory,
  sectionsFor,
  statsFor,
  unitOf,
  seedMyClub,
  shortDay,
  streakMonths,
  vacationsUsed,
  weekDays,
  weekTotal,
  weekVerdict,
  weekday,
  weeksOfMonth,
  type DayMark,
  type MonthResult,
  type SectionKey,
  type StatKey,
  type WeekEntry,
  type DemoDay,
  type MyClubState,
  type WeekVerdict,
} from '@core/lib/my-club';
import { type Study } from '@studyclub/types';
import { Badge, Button, ButtonLink, CapacityBar, Card, Input, Segmented, StatCard, Textarea, cx } from '@studyclub/ui';

/**
 * 내 클럽 — 클럽 멤버가 매일 쓰는 화면 (R2).
 *
 * 일정 · 회차 · 미팅이 없다. 날 단위 클럽은 「오늘 인증」과 이번 달 달력, 주 단위 클럽은 「이번 주 목표 · 공부 시간 · 주간 회고」.
 * 어느 쪽인지는 클럽 설정(`club.rules`)이 정한다 — 같은 틀에 칸만 다르다.
 *
 * TODO(api): GET /api/clubs/{programId}/me · PUT /api/clubs/{programId}/me/checkins · PUT …/me/weeks/{monday}
 */
export function MyClub({ club, study, locale }: { club: ClubConfig; study: Study; locale: string }) {
  const [demo, setDemo] = useState<DemoDay>('wed');
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-end gap-2'>
        <span className='type-label-sm text-fg-muted'>검토용 오늘</span>
        <Segmented
          size='sm'
          aria-label='검토용 오늘'
          options={(Object.keys(DEMO_DAYS) as DemoDay[]).map((d) => ({ value: d, label: DEMO_LABEL[d] }))}
          value={demo}
          onChange={setDemo}
        />
      </div>
      {/* 오늘을 바꾸면 그 날 기준으로 다시 시드한다 */}
      <Body key={`${club.key}-${demo}`} club={club} study={study} locale={locale} today={DEMO_DAYS[demo]} />
    </div>
  );
}

const MARK_LABEL: Record<DayMark, string> = { present: '인증', late: '늦게', absent: '못 함', excused: '휴가' };
const MARK_CELL: Record<DayMark, string> = {
  present: 'bg-success-100 text-success-700',
  late: 'bg-warning-100 text-warning-700',
  absent: 'bg-error-50 text-error-700',
  excused: 'bg-surface-2 text-fg-secondary',
};
const MARK_TONE: Record<DayMark, 'present' | 'late' | 'absent' | 'leave'> = {
  present: 'present',
  late: 'late',
  absent: 'absent',
  excused: 'leave',
};
const VERDICT: Record<WeekVerdict, { label: string; tone: 'present' | 'absent' | 'leave' | 'inprogress' | 'neutral' }> =
  {
    achieved: { label: '달성', tone: 'present' },
    missed: { label: '미달', tone: 'absent' },
    vacation: { label: '휴가', tone: 'leave' },
    ongoing: { label: '진행 중', tone: 'inprogress' },
    upcoming: { label: '예정', tone: 'neutral' },
  };

/** 칸마다 받는 것 — 칸은 이것만 보고 그린다 */
type Ctx = {
  club: ClubConfig;
  study: Study;
  locale: string;
  today: string;
  month: string;
  monday: string;
  state: MyClubState;
  setState: (f: (s: MyClubState) => MyClubState) => void;
  patchWeek: (w: string, f: (e: WeekEntry) => WeekEntry) => void;
  history: MonthResult[];
};

function Body({ club, study, locale, today }: { club: ClubConfig; study: Study; locale: string; today: string }) {
  const [state, setState] = useState<MyClubState>(() => seedMyClub(club, today));
  const month = monthKey(today);
  const [y, m] = month.split('-').map(Number);
  const ctx: Ctx = {
    club,
    study,
    locale,
    today,
    month,
    monday: mondayOf(today),
    state,
    setState,
    patchWeek: (w, f) => setState((s) => ({ ...s, weeks: { ...s.weeks, [w]: f(s.weeks[w] ?? {}) } })),
    history: seedHistory(club),
  };

  return (
    <>
      <header data-anno='myclub:1' className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <p className='type-label-sm text-fg-muted'>내 클럽 · 멤버</p>
          <h1 className='mt-1 type-title-xl text-fg'>{club.title}</h1>
          <p className='mt-1 type-body-sm text-fg-secondary'>
            {y}년 {m}월{study.schedule ? ` · ${t(study.schedule, locale as Locale)}` : ''}
          </p>
        </div>
        <span data-anno='myclub:1-1'>
          <ButtonLink
            href={`/proto/core/${locale}/studies/${study.study_id}`}
            linkAs={Link}
            variant='secondary'
            size='sm'
          >
            클럽 소개 · 규칙
          </ButtonLink>
        </span>
      </header>

      <section data-anno='myclub:2' className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {statsFor(club.rules).map((k) => {
          const v = STATS[k](ctx);
          return <StatCard key={k} anno={`myclub:${STAT_ANNO[k]}`} label={v.label} value={v.value} sub={v.sub} />;
        })}
      </section>

      {/* 칸 목록은 클럽 설정에서 고른다 — 클럽 이름으로 나누지 않는다 */}
      <div className='grid items-start gap-6 lg:grid-cols-2'>
        {sectionsFor(club.rules).map((k) => {
          const Section = SECTIONS[k];
          return (
            <div key={k} className={cx(!HALF.has(k) && 'lg:col-span-2')}>
              <Section {...ctx} />
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── 요약 숫자 — 무엇을 보일지는 statsFor(설정), 값은 여기 ───────────── */

const STAT_ANNO: Record<StatKey, string> = {
  monthRate: '2-1',
  weekTotal: '2-1',
  weeksAchieved: '2-2',
  vacation: '2-3',
  streak: '2-4',
};

const STATS: Record<StatKey, (c: Ctx) => { label: string; value: string; sub: string }> = {
  monthRate: ({ state, month, today }) => {
    const r = dayRate(state, month, today);
    return { label: '이번 달 달성률', value: r === null ? '-' : `${r}%`, sub: '인증 1 · 늦게 0.5 · 휴가는 빼고 센다' };
  },
  weekTotal: ({ state, monday }) => ({
    label: '이번 주',
    value: `${fmtMin(weekTotal(state, monday))} / ${fmtMin(goalOf(state, monday).min)}`,
    sub: '주 합계 / 목표',
  }),
  weeksAchieved: ({ state, month, today }) => {
    const weeks = weeksOfMonth(month);
    const n = weeks.filter((w) => weekVerdict(state, w, today) === 'achieved').length;
    return { label: '이번 달 달성 주', value: `${n} / ${weeks.length}주`, sub: '끝난 주 중 목표를 채운 주' };
  },
  vacation: ({ club, state, month }) => {
    const used = vacationsUsed(club, state, month);
    const unit = unitOf(club.rules);
    const limit = club.rules.vacationLimit;
    return limit === undefined
      ? { label: '휴가', value: `${used}${unit}`, sub: '이번 달에 쓴 휴가 · 제한 없음' }
      : { label: '휴가', value: `${used} / ${limit}${unit}`, sub: '한 달에 쓸 수 있는 휴가' };
  },
  streak: ({ history }) => ({
    label: '연속 완주',
    value: `${streakMonths(history)}개월`,
    sub: '한 달을 끝까지 하면 이어진다',
  }),
};

/* ── 칸 — 칸마다 한 가지 일. 새 진행 방식은 칸을 더하고 sectionsFor 에 한 줄 ─ */

/** 넓은 화면에서 반 폭으로 나란히 두는 칸 */
const HALF = new Set<SectionKey>(['goal', 'minutes']);

const SECTIONS: Record<SectionKey, (c: Ctx) => React.ReactNode> = {
  today: TodaySection,
  calendar: CalendarSection,
  goal: GoalCard,
  minutes: MinutesSection,
  retro: RetroSection,
  weeks: WeeksSection,
  history: HistorySection,
};

/** 휴가를 더 쓸 수 있나 · 버튼에 붙일 남은 수 */
function vacationLeft(c: Ctx): { can: boolean; label: string } {
  const limit = c.club.rules.vacationLimit;
  if (limit === undefined) return { can: true, label: '' };
  const left = limit - vacationsUsed(c.club, c.state, c.month);
  return { can: left > 0, label: ` (${left}${unitOf(c.club.rules)} 남음)` };
}

function TodaySection(c: Ctx) {
  const { club, state, setState, today } = c;
  const mark = state.days[today];
  const [note, setNote] = useState('');
  const vac = vacationLeft(c);

  function check(v: DayMark | undefined) {
    setState((s) => {
      const days = { ...s.days };
      const notes = { ...s.notes };
      if (v) {
        days[today] = v;
        if (note.trim()) notes[today] = note.trim();
      } else {
        delete days[today];
        delete notes[today];
      }
      return { ...s, days, notes };
    });
    if (!v) setNote('');
  }

  return (
    <Card data-anno='myclub:3' padding='lg'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='type-title-sm text-fg'>오늘 인증 · {shortDay(today)}</h2>
        {club.rules.source === 'auto' && (
          <p data-anno='myclub:3-4' className='type-label-sm text-fg-muted'>
            {club.rules.autoSourceName ?? '외부'} 기록을 자동으로 받아 오기 전까지는 직접 인증합니다
          </p>
        )}
      </div>
      {mark ? (
        <div className='mt-4 flex flex-wrap items-center gap-3'>
          <Badge tone={MARK_TONE[mark]}>{MARK_LABEL[mark]}</Badge>
          {state.notes[today] && <span className='type-body-sm text-fg-secondary'>{state.notes[today]}</span>}
          <span data-anno='myclub:3-1'>
            <Button variant='tertiary' size='sm' onClick={() => check(undefined)}>
              인증 취소
            </Button>
          </span>
        </div>
      ) : (
        <div className='mt-4 flex flex-col gap-3'>
          <div className='flex flex-wrap gap-2'>
            <span data-anno='myclub:3-1' className='flex flex-wrap gap-2'>
              <Button onClick={() => check('present')}>
                {club.rules.allowsLate ? '목표 시간에 했어요' : '오늘 했어요'}
              </Button>
              {club.rules.allowsLate && (
                <Button variant='secondary' onClick={() => check('late')}>
                  늦게 했어요
                </Button>
              )}
            </span>
            <span data-anno='myclub:3-2'>
              <Button variant='tertiary' disabled={!vac.can} onClick={() => check('excused')}>
                오늘 휴가{vac.label}
              </Button>
            </span>
          </div>
          <span data-anno='myclub:3-3' className='max-w-md'>
            <Input
              size='sm'
              placeholder='메모 한 줄 (선택)'
              maxLength={100}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </span>
        </div>
      )}
    </Card>
  );
}

function CalendarSection({ state, month, today }: Ctx) {
  return (
    <Card data-anno='myclub:4' padding='lg'>
      <h2 className='type-title-sm text-fg'>{Number(month.slice(5))}월 기록</h2>
      <MonthCalendar state={state} month={month} today={today} />
      <div className='mt-3 flex flex-wrap gap-3 type-label-sm text-fg-muted'>
        {(Object.keys(MARK_LABEL) as DayMark[]).map((k) => (
          <span key={k} className='flex items-center gap-1.5'>
            <span className={cx('inline-block h-3 w-3 rounded-xs', MARK_CELL[k])} />
            {MARK_LABEL[k]}
          </span>
        ))}
      </div>
    </Card>
  );
}

function MinutesSection({ state, setState, monday, today }: Ctx) {
  const locked = Boolean(state.weeks[monday]?.retro || state.weeks[monday]?.vacation);
  return (
    <MinutesCard
      state={state}
      setState={setState}
      monday={monday}
      today={today}
      goal={goalOf(state, monday).min}
      total={weekTotal(state, monday)}
      locked={locked}
    />
  );
}

function RetroSection({ state, today, monday, patchWeek }: Ctx) {
  // 월요일에는 지난주 회고를 낸다 (월요일 끝까지). 그 밖에는 이번 주 회고 — 일요일에 열린다
  const week = weekday(today) === 1 ? addDays(monday, -7) : monday;
  return <RetroCard key={week} state={state} week={week} today={today} patchWeek={patchWeek} />;
}

function WeeksSection({ state, month, today }: Ctx) {
  const weeks = weeksOfMonth(month);
  return (
    <Card data-anno='myclub:8' padding='lg'>
      <h2 className='type-title-sm text-fg'>{Number(month.slice(5))}월의 주</h2>
      <p className='mt-1 type-label-sm text-fg-muted'>
        주는 월요일 ~ 일요일, 월요일이 속한 달에 셉니다.
        {weeks[0] > `${month}-01` &&
          ` ${shortDay(`${month}-01`)} ~ ${shortDay(addDays(weeks[0], -1))}은 지난달 마지막 주입니다.`}
      </p>
      <table className='mt-3 w-full type-body-sm'>
        <thead>
          <tr className='text-left type-label-sm text-fg-muted'>
            <th className='py-2 font-medium'>주</th>
            <th className='py-2 font-medium'>목표</th>
            <th className='py-2 font-medium'>합계</th>
            <th className='py-2 font-medium'>판정</th>
            <th className='py-2 font-medium'>회고</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => {
            const v = VERDICT[weekVerdict(state, w, today)];
            const future = w > today;
            return (
              <tr key={w} className='border-t border-border'>
                <td className='py-2.5 tnum text-fg'>
                  {shortDay(w)} ~ {shortDay(addDays(w, 6))}
                </td>
                <td className='py-2.5 tnum text-fg-secondary'>{future ? '-' : fmtMin(goalOf(state, w).min)}</td>
                <td className='py-2.5 tnum text-fg-secondary'>{future ? '-' : fmtMin(weekTotal(state, w))}</td>
                <td className='py-2.5'>
                  <Badge tone={v.tone}>{v.label}</Badge>
                </td>
                <td className='py-2.5 text-fg-secondary'>{state.weeks[w]?.retro ? '냄' : future ? '-' : '아직'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function HistorySection({ club, history }: Ctx) {
  return (
    <Card data-anno='myclub:9' padding='lg'>
      <h2 className='type-title-sm text-fg'>지난 달</h2>
      <ul className='mt-3 flex flex-col divide-y divide-border'>
        {[...history].reverse().map((h) => (
          <li key={h.month} className='flex items-center justify-between py-2.5'>
            <span className='type-body-md text-fg'>{Number(h.month.slice(5))}월</span>
            <span className='flex items-center gap-3'>
              <span className='tnum type-body-sm text-fg-secondary'>
                {club.rules.judge === 'week' ? `달성 주 ${h.rate}%` : `달성률 ${h.rate}%`}
              </span>
              <Badge tone={h.result === 'completed' ? 'present' : 'ended'}>
                {h.result === 'completed' ? '완주' : '중단'}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MonthCalendar({ state, month, today }: { state: MyClubState; month: string; today: string }) {
  const days = daysOfMonth(month);
  const lead = (weekday(days[0]) + 6) % 7; // 월요일 시작
  return (
    <div className='mt-3 grid grid-cols-7 gap-1 text-center'>
      {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
        <span key={d} className='py-1 type-label-sm text-fg-muted'>
          {d}
        </span>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <span key={`b${i}`} />
      ))}
      {days.map((d) => {
        const mk = state.days[d];
        return (
          <div
            key={d}
            className={cx(
              'flex h-14 flex-col items-center justify-center rounded-sm type-label-sm',
              d > today ? 'text-fg-placeholder' : mk ? MARK_CELL[mk] : 'bg-surface-1 text-fg-muted',
              d === today && 'ring-2 ring-primary',
            )}
            title={state.notes[d]}
          >
            <span className='tnum'>{Number(d.slice(8))}</span>
            {mk && <span>{MARK_LABEL[mk]}</span>}
          </div>
        );
      })}
    </div>
  );
}

function GoalCard(c: Ctx) {
  const { state, monday, today, patchWeek } = c;
  const goal = goalOf(state, monday);
  const vac = vacationLeft(c);
  // 목표는 그 주 월요일 끝까지 쓴다 (캡틴 확인 전 제안)
  const editable = today === monday;
  const [hours, setHours] = useState(String(goal.min / 60));
  const [text, setText] = useState(goal.text ?? '');
  const entry = state.weeks[monday];
  return (
    <Card data-anno='myclub:5' padding='lg'>
      <h2 className='type-title-sm text-fg'>
        이번 주 목표 · {shortDay(monday)} ~ {shortDay(addDays(monday, 6))}
      </h2>
      {goal.carried && (
        <p className='mt-2 type-body-sm text-fg-secondary'>
          아직 이번 주 목표를 쓰지 않아 지난주 목표({fmtMin(goal.min)})를 이어 씁니다.
        </p>
      )}
      {editable ? (
        <div className='mt-4 flex flex-col gap-3'>
          <div className='grid gap-3 sm:grid-cols-[10rem_1fr]'>
            <span data-anno='myclub:5-1'>
              <Input
                label='목표 시간'
                type='number'
                min={1}
                max={80}
                step={0.5}
                suffix='시간'
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </span>
            <span data-anno='myclub:5-2'>
              <Input
                label='무엇을 할까요'
                placeholder='예: SQL 문제 30개'
                maxLength={100}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </span>
          </div>
          <span data-anno='myclub:5-3' className='flex items-center gap-3'>
            <Button
              size='sm'
              disabled={!(Number(hours) > 0)}
              onClick={() =>
                patchWeek(monday, (e) => ({
                  ...e,
                  goalMin: Math.round(Number(hours) * 60),
                  goalText: text.trim() || undefined,
                }))
              }
            >
              목표 저장
            </Button>
            <span className='type-label-sm text-fg-muted'>오늘({shortDay(today)}) 23:59까지 고칠 수 있어요</span>
          </span>
        </div>
      ) : (
        <div className='mt-3'>
          <p className='tnum type-title-md text-fg'>{fmtMin(goal.min)}</p>
          {goal.text && <p className='mt-1 type-body-sm text-fg-secondary'>{goal.text}</p>}
          <p className='mt-2 type-label-sm text-fg-muted'>
            목표는 월요일에 씁니다 — 다음 목표는 {shortDay(addDays(monday, 7))}
          </p>
        </div>
      )}
      <div data-anno='myclub:5-4' className='mt-4 border-t border-border pt-3'>
        {entry?.vacation ? (
          <p className='type-body-sm text-fg-secondary'>이번 주는 휴가입니다 — 판정에서 뺍니다.</p>
        ) : (
          <Button
            variant='tertiary'
            size='sm'
            disabled={!vac.can || Boolean(entry?.retro)}
            onClick={() => patchWeek(monday, (e) => ({ ...e, vacation: true }))}
          >
            이번 주 휴가로 쓰기{vac.label}
          </Button>
        )}
      </div>
    </Card>
  );
}

function MinutesCard({
  state,
  setState,
  monday,
  today,
  goal,
  total,
  locked,
}: {
  state: MyClubState;
  setState: (f: (s: MyClubState) => MyClubState) => void;
  monday: string;
  today: string;
  goal: number;
  total: number;
  locked: boolean;
}) {
  const left = goal - total;
  function setDay(d: string, part: 'h' | 'm', v: string) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    setState((s) => {
      const cur = s.minutes[d] ?? 0;
      const h = part === 'h' ? Math.min(n, 24) : Math.floor(cur / 60);
      const m = part === 'm' ? Math.min(n, 59) : cur % 60;
      return { ...s, minutes: { ...s.minutes, [d]: h * 60 + m } };
    });
  }
  return (
    <Card data-anno='myclub:6' padding='lg'>
      <h2 className='type-title-sm text-fg'>공부 시간</h2>
      <p data-anno='myclub:6-1' className='mt-2 type-body-md font-semibold text-fg'>
        {left > 0 ? `이번 주 목표까지 ${fmtMin(left)} 남았어요` : '이번 주 목표를 채웠어요'}
      </p>
      <CapacityBar
        className='mt-2'
        variant='goal'
        taken={total}
        total={goal}
        showLabel
        label={`${fmtMin(total)} / ${fmtMin(goal)}`}
      />
      <ul data-anno='myclub:6-2' className='mt-4 flex flex-col gap-1.5'>
        {weekDays(monday).map((d) => {
          const future = d > today;
          const v = state.minutes[d];
          return (
            <li
              key={d}
              className={cx('grid grid-cols-[5.5rem_1fr] items-center gap-2', d === today && 'font-semibold')}
            >
              <span className='type-body-sm text-fg'>{shortDay(d)}</span>
              {future ? (
                <span className='type-body-sm text-fg-placeholder'>-</span>
              ) : locked ? (
                <span className='tnum type-body-sm text-fg-secondary'>{fmtMin(v ?? 0)}</span>
              ) : (
                <span className='grid max-w-[14rem] grid-cols-2 gap-2'>
                  <Input
                    size='sm'
                    type='number'
                    min={0}
                    max={24}
                    suffix='시간'
                    aria-label={`${shortDay(d)} 시간`}
                    value={v === undefined ? '' : String(Math.floor(v / 60))}
                    onChange={(e) => setDay(d, 'h', e.target.value)}
                  />
                  <Input
                    size='sm'
                    type='number'
                    min={0}
                    max={59}
                    step={5}
                    suffix='분'
                    aria-label={`${shortDay(d)} 분`}
                    value={v === undefined ? '' : String(v % 60)}
                    onChange={(e) => setDay(d, 'm', e.target.value)}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className='mt-3 type-label-sm text-fg-muted'>
        {locked
          ? '회고를 냈거나 휴가인 주라 고칠 수 없어요.'
          : '이번 주 회고를 내기 전까지 지난 날도 적고 고칠 수 있어요.'}
      </p>
    </Card>
  );
}

function RetroCard({
  state,
  week,
  today,
  patchWeek,
}: {
  state: MyClubState;
  week: string;
  today: string;
  patchWeek: Ctx['patchWeek'];
}) {
  const win = retroWindow(week, today);
  const done = state.weeks[week]?.retro;
  const [good, setGood] = useState('');
  const [next, setNext] = useState('');
  const total = weekTotal(state, week);
  const goal = goalOf(state, week).min;
  return (
    <Card data-anno='myclub:7' padding='lg'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='type-title-sm text-fg'>
          주간 회고 · {shortDay(week)} ~ {shortDay(addDays(week, 6))}
        </h2>
        <span className='tnum type-label-sm text-fg-secondary'>
          {fmtMin(total)} / {fmtMin(goal)} · {total >= goal ? '목표 달성' : '목표 미달'}
        </span>
      </div>
      {done ? (
        <div className='mt-3 flex flex-col gap-2 type-body-sm'>
          <p className='text-fg'>{done.good}</p>
          {done.next && <p className='text-fg-secondary'>다음 주: {done.next}</p>}
          <p className='type-label-sm text-fg-muted'>{shortDay(done.at)}에 냈어요 — 이 주 기록은 잠겼어요</p>
        </div>
      ) : win === 'before' ? (
        <p className='mt-3 type-body-sm text-fg-secondary'>
          {shortDay(addDays(week, 6))}에 열립니다. 다음 날({shortDay(addDays(week, 7))}) 23:59까지 낼 수 있어요.
        </p>
      ) : win === 'closed' ? (
        <p className='mt-3 type-body-sm text-fg-secondary'>내지 않고 지나갔어요.</p>
      ) : (
        <div className='mt-3 flex flex-col gap-3'>
          <span data-anno='myclub:7-1'>
            <Textarea
              label='이번 주 잘된 것 · 아쉬운 것'
              required
              rows={3}
              maxLength={1000}
              value={good}
              onChange={(e) => setGood(e.target.value)}
            />
          </span>
          <span data-anno='myclub:7-2'>
            <Textarea
              label='다음 주에 바꿀 것'
              rows={2}
              maxLength={500}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </span>
          <span data-anno='myclub:7-3' className='flex items-center gap-3'>
            <Button
              size='sm'
              disabled={!good.trim()}
              onClick={() =>
                patchWeek(week, (e) => ({
                  ...e,
                  retro: { good: good.trim(), next: next.trim() || undefined, at: today },
                }))
              }
            >
              회고 내기
            </Button>
            <span className='type-label-sm text-fg-muted'>
              {shortDay(addDays(week, 7))} 23:59까지 · 내면 이 주 기록이 잠겨요
            </span>
          </span>
        </div>
      )}
    </Card>
  );
}
