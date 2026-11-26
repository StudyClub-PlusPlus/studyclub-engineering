'use client';

import { useState, type ReactNode } from 'react';

import type { ClubConfig } from '@console/lib/clubs';
import {
  DEMO_DAYS,
  DEMO_LABEL,
  addDays,
  averagePercent,
  currentStreak,
  dayOffUsed,
  dayRate,
  daysOfMonth,
  doneDays,
  fmtMin,
  goalOf,
  isoWeek,
  marksFor,
  monthKey,
  monthLabel,
  mondayOf,
  nextMonthKey,
  recentWeeks,
  sectionsFor,
  seedHistory,
  shortDay,
  statsFor,
  streakMonths,
  weekDays,
  weekPercent,
  weekTotal,
  weekday,
  type DayMark,
  type DemoDay,
  type MonthResult,
  type MyClubState,
  type SectionKey,
  type StatKey,
  type WeekEntry,
} from '@core/lib/my-club';
import { type Study } from '@studyclub/types';
import { Badge, Button, CapacityBar, Card, Input, Segmented, StatCard, cx } from '@studyclub/ui';

import { patchMember, useClubDemo, useClubRoom } from '@/proto/club/room';

/**
 * 내 클럽 — 클럽 멤버가 매일 쓰는 화면 (R2).
 *
 * 일정 · 회차 · 미팅이 없다. 칸과 숫자는 클럽 설정(`club.rules`)과 멤버 상태가 고른다 — 클럽 이름으로 나누지 않는다.
 * 합격선은 없다 — 출석률 · 스트릭 · 주 달성률을 숫자로만 보여 준다. 자동 제명도 없다.
 *
 * TODO(api): GET /api/clubs/{programId}/me · PUT /api/clubs/{programId}/me/checkins · PUT …/me/weeks/{monday} · PUT …/me/rest
 */
export function MyClub({ club, study, locale }: { club: ClubConfig; study: Study; locale: string }) {
  const [demo] = useClubDemo();
  return (
    <div data-anno='myclub:1' className='flex flex-col gap-6'>
      <ClubDemoBar />
      {/* 오늘 · 상태를 바꾸면 그 기준의 기록으로 다시 그린다 */}
      <Body
        key={`${club.key}-${demo.day}-${demo.resting}`}
        club={club}
        study={study}
        locale={locale}
        today={DEMO_DAYS[demo.day]}
        resting={demo.resting}
      />
    </div>
  );
}

/** 검토용 「오늘」 · 「상태」 — 오늘 탭과 출석 탭이 같은 값을 쓴다 (프로토 도구) */
export function ClubDemoBar() {
  const [demo, setDemo] = useClubDemo();
  return (
    <div className='flex flex-wrap items-center justify-end gap-x-4 gap-y-2'>
      <span className='flex items-center gap-2'>
        <span className='type-label-sm text-fg-muted'>검토용 오늘</span>
        <Segmented
          size='sm'
          aria-label='검토용 오늘'
          options={(Object.keys(DEMO_DAYS) as DemoDay[]).map((d) => ({ value: d, label: DEMO_LABEL[d] }))}
          value={demo.day}
          onChange={(day) => setDemo({ ...demo, day })}
        />
      </span>
      <span className='flex items-center gap-2'>
        <span className='type-label-sm text-fg-muted'>검토용 내 상태</span>
        <Segmented
          size='sm'
          aria-label='검토용 내 상태'
          options={[
            { value: 'active', label: '참여 중' },
            { value: 'resting', label: '쉬는 중' },
          ]}
          value={demo.resting ? 'resting' : 'active'}
          onChange={(v) => setDemo({ ...demo, resting: v === 'resting' })}
        />
      </span>
    </div>
  );
}

const MARK_LABEL: Record<DayMark, string> = { present: '출석', late: '지각', absent: '결석', excused: '휴가' };
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
const RESULT: Record<MonthResult['result'], { label: string; tone: 'present' | 'leave' | 'ended' }> = {
  completed: { label: '완주', tone: 'present' },
  rested: { label: '쉼', tone: 'leave' },
  withdrawn: { label: '중단', tone: 'ended' },
};

const pct = (x: number | null) => (x === null ? '-' : `${x}%`);

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

function Body({
  club,
  study,
  locale,
  today,
  resting,
}: {
  club: ClubConfig;
  study: Study;
  locale: string;
  today: string;
  resting: boolean;
}) {
  const month = monthKey(today);
  // 출석 탭 · 캡틴 출석부와 같은 기록 — 내 줄만 여기서 고친다
  const [room, setRoom] = useClubRoom(club, today, resting);
  const state = room.states[room.meId];
  const setState = (f: (s: MyClubState) => MyClubState) => setRoom((r) => patchMember(r, r.meId, f));
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
      {state.membership.kind === 'active' && (
        <section data-anno='myclub:2' className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {statsFor(club.rules).map((k) => {
            const v = STATS[k](ctx);
            return <StatCard key={k} anno={`myclub:${STAT_ANNO[k]}`} label={v.label} value={v.value} sub={v.sub} />;
          })}
        </section>
      )}

      {/* 칸 목록은 클럽 설정 · 멤버 상태에서 고른다 — 클럽 이름으로 나누지 않는다 */}
      <div className='grid items-start gap-6 lg:grid-cols-2'>
        {sectionsFor(club.rules, state.membership).map((k) => {
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
  streak: '2-1',
  weekNow: '2-1',
  monthDone: '2-2',
  lastWeek: '2-2',
  average: '2-3',
  dayOff: '2-4',
  months: '2-5',
};

const STATS: Record<StatKey, (c: Ctx) => { label: string; value: string; sub: string }> = {
  monthRate: ({ state, month, today }) => ({
    label: '이번 달 출석률',
    value: pct(dayRate(state, month, today)),
    sub: '출석 1 · 지각 0.5 · 결석 · 기록 없는 날 0 · 휴가는 빼고',
  }),
  streak: ({ state, today }) => ({
    label: '연속일',
    value: `${currentStreak(state, today)}일`,
    sub: '하루 빠지면 다시 1부터 · 달이 바뀌어도 이어진다',
  }),
  monthDone: ({ state, month, today }) => {
    const elapsed = daysOfMonth(month).filter((d) => d < today || (d === today && state.days[d])).length;
    return { label: '이번 달 한 날', value: `${doneDays(state, month)} / ${elapsed}일`, sub: '오늘까지' };
  },
  weekNow: ({ state, monday }) => {
    const goal = goalOf(state, monday).min;
    return goal === 0
      ? { label: '이번 주', value: '쉬는 주', sub: '목표 0 — 달성률에 세지 않는다' }
      : {
          label: `이번 주 · ${isoWeek(monday)}주차`,
          value: pct(weekPercent(state, monday)),
          sub: `${fmtMin(weekTotal(state, monday))} / ${fmtMin(goal)}`,
        };
  },
  lastWeek: ({ state, monday }) => {
    const w = addDays(monday, -7);
    const p = weekPercent(state, w);
    return {
      label: `지난 주 · ${isoWeek(w)}주차`,
      value: p === null ? '쉬는 주' : pct(p),
      sub: `${fmtMin(weekTotal(state, w))} / ${fmtMin(goalOf(state, w).min)}`,
    };
  },
  average: ({ state, today }) => ({
    label: '최근 4주 평균',
    value: pct(averagePercent(state, recentWeeks(today, 5).slice(1))),
    sub: '끝난 주만 · 쉬는 주는 빼고',
  }),
  dayOff: ({ club, state, month }) => {
    const used = dayOffUsed(state, month);
    const limit = club.rules.vacationLimit;
    return limit === undefined
      ? { label: '휴가', value: `${used}일`, sub: '이번 달에 쓴 휴가 · 제한 없음' }
      : { label: '휴가', value: `${used} / ${limit}일`, sub: '한 달에 쓸 수 있는 휴가' };
  },
  months: ({ history }) => ({
    label: '연속 완주',
    value: `${streakMonths(history)}개월`,
    sub: '쉰 달은 세지도 끊지도 않는다',
  }),
};

/* ── 칸 — 칸마다 한 가지 일. 새 진행 방식은 칸을 더하고 sectionsFor 에 한 줄 ─ */

/** 넓은 화면에서 반 폭으로 나란히 두는 칸 */
const HALF = new Set<SectionKey>(['goal', 'note']);

const SECTIONS: Record<SectionKey, (c: Ctx) => ReactNode> = {
  resting: RestingSection,
  today: TodaySection,
  auto: AutoSection,
  calendar: CalendarSection,
  goal: GoalSection,
  minutes: MinutesSection,
  note: NoteSection,
  weeks: WeeksSection,
  membership: MembershipSection,
  history: HistorySection,
};

/**
 * 오늘 기록 — 보기만 한다. 출석은 캡틴만 입력한다 (2026-11-26) — 크루는 인증 · 휴가를 직접 남기지 않는다.
 */
function TodaySection({ state, today }: Ctx) {
  const mark = state.days[today];
  return (
    <Card data-anno='myclub:3' padding='lg'>
      <h2 className='type-title-sm text-fg'>오늘 출석 · {shortDay(today)}</h2>
      <div data-anno='myclub:3-1' className='mt-4 flex flex-wrap items-center gap-3'>
        <Badge tone={mark ? MARK_TONE[mark] : 'neutral'}>{mark ? MARK_LABEL[mark] : '아직 기록 없음'}</Badge>
        <span className='type-body-sm text-fg-secondary'>
          {mark
            ? '캡틴이 남긴 기록이에요.'
            : '출석은 캡틴이 디스코드 인증을 보고 입력해요. 휴가는 캡틴에게 말해 주세요.'}
        </span>
      </div>
    </Card>
  );
}

/** TODO(api): 오늘의 문제 — 외부 서비스의 그날 문제. 프로토는 고정 제목 */
const DEMO_PROBLEM = '오늘의 문제 (예시)';

function AutoSection({ club, state, today }: Ctx) {
  const name = club.rules.autoSourceName ?? '외부 서비스';
  const mark = state.days[today];
  const done = mark === 'present' || mark === 'late';
  return (
    <Card data-anno='myclub:4' padding='lg'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='type-title-sm text-fg'>오늘 · {shortDay(today)}</h2>
        <span className='type-label-sm text-fg-muted'>{name} 기록을 자동으로 받아 옵니다</span>
      </div>
      {club.rules.dailyProblem && (
        <p data-anno='myclub:4-1' className='mt-3 type-body-md text-fg'>
          {DEMO_PROBLEM}
        </p>
      )}
      <div data-anno='myclub:4-2' className='mt-3 flex flex-wrap items-center gap-3'>
        <Badge tone={mark ? MARK_TONE[mark] : 'neutral'}>{mark ? MARK_LABEL[mark] : '아직 기록 없음'}</Badge>
        <span className='type-body-sm text-fg-secondary'>
          {done
            ? `연속 ${currentStreak(state, today)}일째`
            : mark
              ? '캡틴이 남긴 기록이에요.'
              : `${name}에서 풀면 출석으로 반영돼요. 기록이 틀리거나 휴가가 필요하면 캡틴에게 알려 주세요.`}
        </span>
      </div>
    </Card>
  );
}

function CalendarSection({ club, state, month, today }: Ctx) {
  const days = daysOfMonth(month);
  const lead = (weekday(days[0]) + 6) % 7; // 월요일 시작
  return (
    <Card data-anno='myclub:5' padding='lg'>
      <h2 className='type-title-sm text-fg'>{monthLabel(month)} 기록</h2>
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
      <div className='mt-3 flex flex-wrap gap-3 type-label-sm text-fg-muted'>
        {marksFor(club.rules).map((k) => (
          <span key={k} className='flex items-center gap-1.5'>
            <span className={cx('inline-block h-3 w-3 rounded-xs', MARK_CELL[k])} />
            {MARK_LABEL[k]}
          </span>
        ))}
        <span className='flex items-center gap-1.5'>
          <span className='inline-block h-3 w-3 rounded-xs bg-surface-1' />
          기록 없음
        </span>
      </div>
    </Card>
  );
}

function GoalSection({ state, monday, today, patchWeek }: Ctx) {
  const goal = goalOf(state, monday);
  // 목표는 그 주 월요일 끝까지 쓴다 (캡틴 확인 전 제안)
  const editable = today === monday;
  const [hours, setHours] = useState(String(goal.min / 60));
  return (
    <Card data-anno='myclub:6' padding='lg'>
      <h2 className='type-title-sm text-fg'>
        {isoWeek(monday)}주차 목표 · {shortDay(monday)} ~ {shortDay(addDays(monday, 6))}
      </h2>
      {goal.carried && (
        <p className='mt-2 type-body-sm text-fg-secondary'>
          아직 이번 주 목표를 쓰지 않아 지난 목표({fmtMin(goal.min)})를 이어 씁니다.
        </p>
      )}
      {editable ? (
        <div className='mt-4 flex flex-col gap-3'>
          <span data-anno='myclub:6-1' className='max-w-[12rem]'>
            <Input
              label='목표 시간'
              type='number'
              min={0}
              max={80}
              step={0.5}
              suffix='시간'
              helper='0 이면 쉬는 주'
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </span>
          <span data-anno='myclub:6-2' className='flex items-center gap-3'>
            <Button
              size='sm'
              disabled={hours === '' || !(Number(hours) >= 0)}
              onClick={() => patchWeek(monday, (e) => ({ ...e, goalMin: Math.round(Number(hours) * 60) }))}
            >
              목표 저장
            </Button>
            <span className='type-label-sm text-fg-muted'>오늘({shortDay(today)}) 23:59까지 고칠 수 있어요</span>
          </span>
        </div>
      ) : (
        <div className='mt-3'>
          <p className='tnum type-title-md text-fg'>{goal.min === 0 ? '쉬는 주' : fmtMin(goal.min)}</p>
          <p className='mt-2 type-label-sm text-fg-muted'>
            목표는 월요일에 씁니다 — 다음 목표는 {shortDay(addDays(monday, 7))}
          </p>
        </div>
      )}
    </Card>
  );
}

function MinutesSection({ state, setState, monday, today }: Ctx) {
  const goal = goalOf(state, monday).min;
  const total = weekTotal(state, monday);
  const p = weekPercent(state, monday);
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
    <Card data-anno='myclub:7' padding='lg'>
      <h2 className='type-title-sm text-fg'>공부 시간</h2>
      <p data-anno='myclub:7-1' className='mt-2 type-body-md font-semibold text-fg'>
        {goal === 0
          ? `쉬는 주예요 — 적어도 달성률에 세지 않아요 (합계 ${fmtMin(total)})`
          : `${fmtMin(total)} / ${fmtMin(goal)} · ${pct(p)}`}
      </p>
      {goal > 0 && <CapacityBar className='mt-2' variant='goal' taken={total} total={goal} showLabel label={pct(p)} />}
      <ul data-anno='myclub:7-2' className='mt-4 grid gap-1.5 sm:grid-cols-2'>
        {weekDays(monday).map((d) => {
          const v = state.minutes[d];
          return (
            <li
              key={d}
              className={cx('grid grid-cols-[5.5rem_1fr] items-center gap-2', d === today && 'font-semibold')}
            >
              <span className='type-body-sm text-fg'>{shortDay(d)}</span>
              {d > today ? (
                <span className='type-body-sm text-fg-placeholder'>-</span>
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
        이번 주 지난 날도 적고 고칠 수 있어요. 지난 주 기록은 캡틴이 고칩니다.
      </p>
    </Card>
  );
}

function NoteSection({ state, monday, patchWeek }: Ctx) {
  const saved = state.weeks[monday]?.note;
  const [text, setText] = useState(saved ?? '');
  return (
    <Card data-anno='myclub:8' padding='lg'>
      <h2 className='type-title-sm text-fg'>이번 주 한 줄</h2>
      <p className='mt-1 type-label-sm text-fg-muted'>다짐 · 회고 · 사정 무엇이든 (선택)</p>
      <div className='mt-3 flex flex-col gap-3'>
        <span data-anno='myclub:8-1'>
          <Input
            placeholder='예: 공부 방식을 바꾸는 주간'
            maxLength={200}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </span>
        <span data-anno='myclub:8-2' className='flex items-center gap-3'>
          <Button
            size='sm'
            variant='secondary'
            disabled={(text.trim() || undefined) === saved}
            onClick={() => patchWeek(monday, (e) => ({ ...e, note: text.trim() || undefined }))}
          >
            저장
          </Button>
          {saved && <span className='type-label-sm text-fg-muted'>저장됨</span>}
        </span>
      </div>
    </Card>
  );
}

function WeeksSection({ state, today }: Ctx) {
  const weeks = recentWeeks(today, 6);
  return (
    <Card data-anno='myclub:9' padding='lg'>
      <h2 className='type-title-sm text-fg'>최근 주</h2>
      <table className='mt-3 w-full type-body-sm'>
        <thead>
          <tr className='text-left type-label-sm text-fg-muted'>
            <th className='py-2 font-medium'>주차</th>
            <th className='py-2 font-medium'>목표</th>
            <th className='py-2 font-medium'>합계</th>
            <th className='py-2 font-medium'>달성률</th>
            <th className='py-2 font-medium'>한 줄</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => {
            const goal = goalOf(state, w).min;
            return (
              <tr key={w} className='border-t border-border'>
                <td className='py-2.5 text-fg'>
                  <span className='tnum'>{isoWeek(w)}주차</span>
                  <span className='ml-2 tnum type-label-sm text-fg-muted'>
                    {shortDay(w)} ~ {shortDay(addDays(w, 6))}
                  </span>
                </td>
                <td className='py-2.5 tnum text-fg-secondary'>{goal === 0 ? '쉬는 주' : fmtMin(goal)}</td>
                <td className='py-2.5 tnum text-fg-secondary'>{fmtMin(weekTotal(state, w))}</td>
                <td className='py-2.5 tnum text-fg'>
                  {pct(weekPercent(state, w))}
                  {w === mondayOf(today) && <span className='ml-1 type-label-sm text-fg-muted'>진행 중</span>}
                </td>
                <td className='py-2.5 text-fg-secondary'>{state.weeks[w]?.note ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function MembershipSection({ state, setState, month }: Ctx) {
  const next = nextMonthKey(month);
  return (
    <Card data-anno='myclub:10' padding='lg'>
      <h2 className='type-title-sm text-fg'>쉬어 가기</h2>
      <p className='mt-1 type-body-sm text-fg-secondary'>
        휴가 · 방학으로 한 달을 쉬어도 멤버로 남습니다. 쉬는 달이 끝나면 다시 이어 갑니다 — 다시 신청하지 않아요. 쉰
        달은 완주에도 중단에도 세지 않습니다.
      </p>
      <div data-anno='myclub:10-1' className='mt-3 flex flex-wrap items-center gap-3'>
        {state.restNextMonth ? (
          <>
            <Badge tone='leave'>{monthLabel(next)}은 쉽니다</Badge>
            <Button variant='tertiary' size='sm' onClick={() => setState((s) => ({ ...s, restNextMonth: false }))}>
              쉬기 취소
            </Button>
          </>
        ) : (
          <Button variant='secondary' size='sm' onClick={() => setState((s) => ({ ...s, restNextMonth: true }))}>
            {monthLabel(next)} 쉬기
          </Button>
        )}
        <span className='type-label-sm text-fg-muted'>{monthLabel(month)} 말일까지 정할 수 있어요</span>
      </div>
    </Card>
  );
}

function RestingSection({ state, setState }: Ctx) {
  if (state.membership.kind !== 'resting') return null;
  const until = state.membership.until;
  return (
    <Card data-anno='myclub:11' padding='lg'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge tone='leave'>쉬는 중</Badge>
        <h2 className='type-title-sm text-fg'>{monthLabel(until)}은 쉬어 갑니다</h2>
      </div>
      <p className='mt-2 type-body-sm text-fg-secondary'>
        {monthLabel(nextMonthKey(until))} 1일부터 다시 이어 갑니다. 멤버 자리는 그대로예요.
      </p>
      <span data-anno='myclub:11-1' className='mt-3 inline-block'>
        <Button
          variant='secondary'
          size='sm'
          onClick={() => setState((s) => ({ ...s, membership: { kind: 'active' } }))}
        >
          지금 돌아오기
        </Button>
      </span>
    </Card>
  );
}

function HistorySection({ club, history }: Ctx) {
  const rateLabel = club.rules.metric === 'weekPercent' ? '평균 달성률' : '출석률';
  return (
    <Card data-anno='myclub:12' padding='lg'>
      <h2 className='type-title-sm text-fg'>지난 달</h2>
      <ul className='mt-3 flex flex-col divide-y divide-border'>
        {[...history].reverse().map((h) => (
          <li key={h.month} className='flex items-center justify-between py-2.5'>
            <span className='type-body-md text-fg'>{monthLabel(h.month)}</span>
            <span className='flex items-center gap-3'>
              {h.rate !== undefined && club.rules.metric !== 'streak' && (
                <span className='tnum type-body-sm text-fg-secondary'>
                  {rateLabel} {h.rate}%
                </span>
              )}
              <Badge tone={RESULT[h.result].tone}>{RESULT[h.result].label}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
