'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { categoryGradient, categoryMeta } from '@core/components/StudyThumb';
import {
  STATUS_LABEL,
  STATUS_STYLE,
  canCancelLeave,
  canCheckIn,
  cancelLeave,
  getMyAttendance,
  resolveStatus,
  sessionsOf,
  takeLeave,
} from '@core/lib/attendance';
import { getUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import {
  LEFT_BADGE,
  LIFE_LABEL,
  addDays,
  canOpenAttendance,
  canOpenDiscord,
  canOpenDrive,
  completedAttend,
  discordUrl,
  driveUrl,
  durationOf,
  isCompleted,
  lifeStatus,
  mondayOf,
  tagsOf,
  upcomingOf,
  upcomingSession,
  userWallTz,
  weekDays,
  ymdInTz,
  type LifeStatus,
  type WallTz,
  type WeekDay,
} from '@core/lib/joined';
import { getApplications, getRegion } from '@core/lib/me';
import { studies as allStudies, type Study, type StudySession } from '@studyclub/mock';
import { Badge, Button, Card, EmptyState, cx } from '@studyclub/ui';
import {
  Award,
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FolderOpen,
  Heart,
  MessageCircle,
} from 'lucide-react';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

type Filter = 'all' | LifeStatus;

const PAGE_SIZE = 10;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'upcoming', label: '시작전' },
  { key: 'active', label: '참여중' },
  { key: 'ended', label: '참여 종료' },
];

const LIFE_TONE: Record<LifeStatus, 'recruiting' | 'inprogress' | 'ended'> = {
  upcoming: 'recruiting',
  active: 'inprogress',
  ended: 'ended',
};

const EMPTY: Record<Filter, { title: string; description: string }> = {
  all: { title: '참여한 스터디가 없습니다', description: '신청이 승인되면 여기에 모입니다.' },
  upcoming: { title: '시작 전 스터디가 없습니다', description: '승인된 뒤 아직 시작하지 않은 스터디가 여기에 모입니다.' },
  active: { title: '참여 중인 스터디가 없습니다', description: '지금 들어가는 스터디가 여기에 모입니다.' },
  ended: {
    title: '참여가 끝난 스터디가 없습니다',
    description: '완주했거나 참여가 끝난 스터디가 여기에 모입니다.',
  },
};

function weekRangeLabel(days: WeekDay[]): string {
  if (days.length === 0) return '';
  const ymd = days[0].date;
  return `${ymd.slice(0, 4)}년 ${Number(ymd.slice(5, 7))}월`;
}

function AttendActions({
  study,
  session,
  compact,
  attendAnno,
  leaveAnno,
  cancelAnno,
  onChange,
}: {
  study: Study;
  session: StudySession;
  compact?: boolean;
  attendAnno: string;
  leaveAnno: string;
  cancelAnno: string;
  onChange: () => void;
}) {
  const stored = getMyAttendance(study.id);
  const raw = resolveStatus(study, session, stored);
  const upcoming = lifeStatus(study) === 'upcoming';
  /** 시작전 스터디는 아직 모이지 않았으므로 결석으로 읽지 않는다. */
  const status = raw === 'absent' && upcoming ? undefined : raw;
  const onLeave = status === 'excused';
  const joinOn = canCheckIn(study, session) && canOpenDiscord(study);
  const cancelOn = onLeave && canCancelLeave(study, session);

  function join() {
    if (!joinOn) return;
    window.open(discordUrl(study), '_blank', 'noopener,noreferrer');
  }

  function leave() {
    takeLeave(study, session);
    onChange();
  }

  function undoLeave() {
    if (!cancelLeave(study, session)) return;
    onChange();
  }

  /** 출석·지각·결석만 배지. 휴가는 참석 버튼을 남겨 두고 오른쪽만 바꾼다. */
  if (status && !onLeave) {
    return (
      <span
        className={cx(
          'inline-flex shrink-0 items-center justify-center rounded-pill font-bold',
          compact ? 'px-1 py-0.5 text-[9px] leading-tight' : 'px-3 py-1.5 text-xs',
          STATUS_STYLE[status],
        )}
      >
        {STATUS_LABEL[status]}
      </span>
    );
  }

  if (compact) {
    return (
      <span className='mt-0.5 grid w-full grid-cols-2 gap-0.5'>
        <button
          type='button'
          data-anno={attendAnno}
          disabled={!joinOn}
          onClick={join}
          className='truncate rounded-pill bg-brand px-0.5 py-0.5 text-[9px] font-bold leading-tight text-on-brand hover:bg-brand-hover disabled:bg-neutral-200 disabled:text-neutral-400'
        >
          참석
        </button>
        {onLeave ? (
          <button
            type='button'
            data-anno={cancelAnno}
            disabled={!cancelOn}
            onClick={undoLeave}
            className='truncate rounded-pill bg-surface-2 px-0.5 py-0.5 text-[9px] font-bold leading-tight text-fg-secondary hover:bg-surface-3 disabled:text-fg-muted'
          >
            {cancelOn ? '휴가 취소' : '휴가'}
          </button>
        ) : (
          <button
            type='button'
            data-anno={leaveAnno}
            onClick={leave}
            className='truncate rounded-pill border border-border-strong bg-bg px-0.5 py-0.5 text-[9px] font-bold leading-tight text-fg-secondary hover:bg-surface-2'
          >
            휴가
          </button>
        )}
      </span>
    );
  }

  return (
    <span className='flex shrink-0 items-center gap-1.5'>
      <Button data-anno={attendAnno} variant='primary' size='sm' disabled={!joinOn} onClick={join}>
        지금 참석
      </Button>
      {onLeave ? (
        <Button data-anno={cancelAnno} variant='tonal' size='sm' disabled={!cancelOn} onClick={undoLeave}>
          {cancelOn ? '휴가 취소' : upcoming ? '휴가 신청' : '휴가'}
        </Button>
      ) : (
        <Button data-anno={leaveAnno} variant='secondary' size='sm' onClick={leave}>
          휴가 신청
        </Button>
      )}
    </span>
  );
}

function WeekStrip({
  days,
  thisWeek,
  locale,
  wallTz,
  studies,
  onWallTz,
  onPrev,
  onNext,
  onAttendChange,
}: {
  days: WeekDay[];
  thisWeek: boolean;
  locale: Locale;
  wallTz: WallTz;
  studies: Study[];
  onWallTz: (tz: WallTz) => void;
  onPrev: () => void;
  onNext: () => void;
  onAttendChange: () => void;
}) {
  const router = useRouter();
  const range = weekRangeLabel(days);
  const byId = new Map(studies.map((s) => [s.id, s]));
  return (
    <section data-anno='1-1' className='mt-5'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <h2 className='text-lg font-extrabold tracking-tight'>
          {thisWeek ? '이번 주 일정' : '주간 일정'}{' '}
          <span className='tnum font-bold text-fg-muted'>{range}</span>
        </h2>
        <div className='flex items-center gap-2'>
          <SegmentTabs
            anno='1-1-1'
            value={wallTz}
            options={[
              { key: 'KST', label: 'KST' },
              { key: 'PDT', label: 'PDT' },
            ]}
            onChange={onWallTz}
          />
          <div className='flex items-center'>
            <Button variant='ghost' size='sm' aria-label='이전 주' onClick={onPrev}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant='ghost' size='sm' aria-label='다음 주' onClick={onNext}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      <div className='mt-3 rounded-card border border-border bg-bg p-3 shadow-xs'>
        <ol className='grid grid-cols-7 gap-1'>
          {days.map((d) => (
            <li
              key={d.date}
              className={cx(
                'min-w-0 rounded-card px-1 py-1.5',
                d.today ? 'bg-brand-subtle' : 'bg-surface-1',
              )}
            >
              <p className={cx('text-center text-[11px] font-bold', d.today ? 'text-primary-700' : 'text-fg-muted')}>
                {d.label}
              </p>
              <p
                className={cx(
                  'tnum text-center text-sm font-extrabold',
                  d.today ? 'text-primary-700' : 'text-fg',
                )}
              >
                {d.day}
              </p>
              <ul className='mt-1 flex min-h-10 flex-col gap-0.5'>
                {d.hits.map((hit) => {
                  const study = byId.get(hit.studyId);
                  const session = study
                    ? sessionsOf(study).find((s) => s.id === hit.sessionId)
                    : undefined;
                  return (
                    <li key={`${hit.studyId}-${hit.sessionId}`}>
                      <button
                        type='button'
                        title={`${hit.time} ${hit.title} ${hit.no}회차`}
                        onClick={() => router.push(`/proto/core/${locale}/studies/${hit.studyId}`)}
                        className='block w-full truncate rounded-pill bg-bg px-1 py-0.5 text-left text-[10px] font-bold leading-tight text-primary-700 hover:bg-brand-subtle-hover'
                      >
                        <span className='tnum block text-[10px] font-semibold text-fg-muted'>{hit.time}</span>
                        <span className='block truncate'>{hit.title}</span>
                      </button>
                      {study && session && (
                        <AttendActions
                          study={study}
                          session={session}
                          compact
                          attendAnno='1-1-2'
                          leaveAnno='1-1-3'
                          cancelAnno='1-1-4'
                          onChange={onAttendChange}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SegmentTabs<T extends string>({
  value,
  options,
  onChange,
  anno,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
  anno?: string;
}) {
  return (
    <div role='tablist' data-anno={anno} className='inline-flex shrink-0 rounded-pill bg-surface-2 p-1'>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            type='button'
            role='tab'
            aria-selected={on}
            onClick={() => onChange(o.key)}
            className={`whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-bold transition-colors ${
              on ? 'bg-bg text-fg shadow-sm' : 'text-fg-secondary hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Pager({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav data-anno='5' className='mt-8 flex items-center justify-center gap-1' aria-label='목록 페이지'>
      <Button
        variant='ghost'
        size='sm'
        disabled={page <= 1}
        leadingIcon={<ChevronLeft size={16} />}
        onClick={() => onChange(page - 1)}
      >
        이전
      </Button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
        const on = n === page;
        return (
          <button
            key={n}
            type='button'
            aria-current={on ? 'page' : undefined}
            onClick={() => onChange(n)}
            className={cx(
              'grid h-8 min-w-8 place-items-center rounded-control px-2.5 text-sm font-bold transition-colors',
              on ? 'bg-brand text-on-brand' : 'text-fg-secondary hover:bg-surface-2 hover:text-fg',
            )}
          >
            {n}
          </button>
        );
      })}
      <Button
        variant='ghost'
        size='sm'
        disabled={page >= pages}
        trailingIcon={<ChevronRight size={16} />}
        onClick={() => onChange(page + 1)}
      >
        다음
      </Button>
    </nav>
  );
}

/**
 * 내 스터디 — 참여 목록.
 *
 * 기본 탭은 참여중. 크루가 여기 오는 이유는 지금 어디 들어가는지 확인하는 것이다.
 * 오늘 참석·휴가는 주간 줄과 카드에서 바로 찍고, 이력은 출석부(`/my/studies`)로 본다.
 */
export default function MyJoinedPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const [ready, setReady] = useState(false);
  const [mineIds, setMineIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [page, setPage] = useState(1);
  const [wallTz, setWallTz] = useState<WallTz>('KST');
  const [weekStart, setWeekStart] = useState(() => mondayOf(ymdInTz(new Date(), 'KST')));
  const [attendTick, setAttendTick] = useState(0);
  const listTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getUser()) {
      router.replace(`/proto/core/${locale}/login?next=/proto/core/${locale}/my/joined`);
      return;
    }
    setMineIds(
      getApplications()
        .filter((a) => a.status === 'accepted')
        .map((a) => a.studyId),
    );
    setWallTz(userWallTz(getRegion()));
    setWeekStart(mondayOf(ymdInTz(new Date(), userWallTz(getRegion()))));
    setReady(true);
  }, [locale, router]);

  const mine = useMemo<Study[]>(() => {
    const byId = new Map(allStudies.map((s) => [s.id, s]));
    return mineIds.map((id) => byId.get(id)).filter((s): s is Study => Boolean(s));
  }, [mineIds]);

  const days = useMemo(() => weekDays(mine, locale, wallTz, weekStart), [mine, locale, wallTz, weekStart]);
  const thisWeek = weekStart === mondayOf(ymdInTz(new Date(), wallTz));

  const shown = useMemo(() => {
    const list = filter === 'all' ? mine : mine.filter((s) => lifeStatus(s) === filter);
    if (filter !== 'ended') return list;
    return [...list].sort((a, b) => Number(isCompleted(b)) - Number(isCompleted(a)));
  }, [filter, mine]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const paged = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
    listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!ready) {
    return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
  }

  const empty = EMPTY[filter];

  return (
    <div className='mx-auto max-w-3xl px-6 pb-16 pt-10'>
      <ScreenSpecRegistrar spec={SPEC} />
      <h1 data-anno='1' className='text-2xl font-extrabold tracking-tight'>
        내 스터디
      </h1>

      <WeekStrip
        key={attendTick}
        days={days}
        thisWeek={thisWeek}
        locale={locale}
        wallTz={wallTz}
        studies={mine}
        onWallTz={setWallTz}
        onPrev={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
        onAttendChange={() => setAttendTick((n) => n + 1)}
      />

      <div className='mt-5 flex flex-wrap items-center gap-2'>
        <SegmentTabs anno='2' value={filter} options={FILTERS} onChange={changeFilter} />
        <span data-anno='2-1' className='ml-auto'>
          <Button
            variant='secondary'
            size='sm'
            leadingIcon={<Heart size={14} />}
            onClick={() => router.push(`/proto/core/${locale}/my/saved`)}
          >
            찜한 스터디
          </Button>
        </span>
      </div>

      {shown.length === 0 ? (
        <div data-anno='3' className='mt-8'>
          <EmptyState icon={<BookOpen size={28} />} title={empty.title} description={empty.description} />
        </div>
      ) : (
        <div ref={listTop}>
          <ul className='mt-6 flex flex-col gap-3'>
            {paged.map((study) => (
              <StudyItem
                key={`${study.id}-${attendTick}`}
                study={study}
                locale={locale}
                wallTz={wallTz}
                onAttendChange={() => setAttendTick((n) => n + 1)}
              />
            ))}
          </ul>
          <Pager page={pageSafe} pages={pages} onChange={changePage} />
        </div>
      )}
    </div>
  );
}

function MissionClear({ study }: { study: Study }) {
  const { attended, total } = completedAttend(study);
  const perfect = total > 0 && attended >= total;
  return (
    <div
      data-anno='4-4'
      className='mt-3 rounded-card border border-warning-400 bg-bg px-3 py-2.5 shadow-xs'
    >
      <div className='flex items-center justify-between gap-2'>
        <p className='flex items-center gap-1.5 text-[13px] font-extrabold tracking-tight text-warning-700'>
          <Award size={15} strokeWidth={2.5} aria-hidden='true' />
          완주를 축하합니다!
        </p>
        {perfect && (
          <span className='rounded-pill bg-warning-400 px-2 py-0.5 text-[11px] font-extrabold text-fg'>
            전회 출석
          </span>
        )}
      </div>
      <p className='mt-1 flex items-baseline gap-1'>
        <span className='tnum text-[32px] font-extrabold leading-none tracking-tight text-warning-700'>
          {attended}
        </span>
        <span className='text-lg font-bold text-fg-muted'>/</span>
        <span className='tnum text-lg font-bold text-fg-muted'>{total}</span>
        <span className='ml-1 text-[13px] font-bold text-fg-muted'>회</span>
      </p>
      <ol className='mt-2.5 flex gap-1' aria-hidden='true'>
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={cx(
              'h-2 min-w-0 flex-1 rounded-pill',
              i < attended ? 'bg-warning-400' : 'bg-surface-3',
            )}
          />
        ))}
      </ol>
    </div>
  );
}

function StudyItem({
  study,
  locale,
  wallTz,
  onAttendChange,
}: {
  study: Study;
  locale: Locale;
  wallTz: WallTz;
  onAttendChange: () => void;
}) {
  const router = useRouter();
  const { icon: Icon, label } = categoryMeta(study.category);
  const life = lifeStatus(study);
  const completed = isCompleted(study);
  const left = life === 'ended' && !completed;
  const tags = tagsOf(study, locale, label);
  const attendanceOn = canOpenAttendance();
  const discordOn = canOpenDiscord(study);
  const driveOn = canOpenDrive(study);
  const nextSession = upcomingSession(study, wallTz);

  return (
    <li>
      <Card
        data-anno='4'
        padding='lg'
        className={cx(
          'relative flex gap-4 overflow-hidden',
          completed && 'border-warning-400 bg-warning-50 shadow-sm',
        )}
      >
        {completed && (
          <span className='absolute inset-y-0 left-0 w-1 bg-warning-400' aria-hidden='true' />
        )}
        <span
          data-anno='4-1'
          className='relative grid h-12 w-12 shrink-0 place-items-center rounded-card text-white'
          style={{ background: categoryGradient(study.category) }}
          aria-hidden='true'
        >
          <Icon size={20} strokeWidth={1.75} />
          {completed && (
            <span className='absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-warning-400 text-fg shadow-sm'>
              <Award size={12} strokeWidth={2.5} />
            </span>
          )}
        </span>

        <div className='min-w-0 flex-1'>
          <div className='flex items-start justify-between gap-3'>
            <Link
              data-anno='4-2'
              href={`/proto/core/${locale}/studies/${study.id}`}
              className='min-w-0 truncate text-[17px] font-bold text-fg underline-offset-4 hover:underline'
            >
              {t(study.title, locale)}
            </Link>
            <span data-anno='4-3'>
              {completed ? (
                <span className='inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill bg-warning-100 px-2 py-0.5 text-xs font-bold text-warning-700'>
                  <Award size={12} strokeWidth={2.5} aria-hidden='true' />
                  완주
                </span>
              ) : (
                <Badge tone={left ? LEFT_BADGE.tone : LIFE_TONE[life]} dot>
                  {left ? LEFT_BADGE.label : LIFE_LABEL[life]}
                </Badge>
              )}
            </span>
          </div>

          {completed ? (
            <MissionClear study={study} />
          ) : (
            <div data-anno='4-4' className='mt-3'>
              <p className='text-[13px] font-semibold text-fg-muted'>다가오는 일정</p>
              <div className='mt-1.5 flex flex-wrap items-center gap-2'>
                <CalendarClock size={16} strokeWidth={2} className='shrink-0 text-brand' />
                <span className='min-w-0 text-lg font-extrabold tracking-tight text-fg'>
                  {upcomingOf(study, locale, wallTz)}
                </span>
                {nextSession && (
                  <AttendActions
                    study={study}
                    session={nextSession}
                    attendAnno='4-4-1'
                    leaveAnno='4-4-2'
                    cancelAnno='4-4-3'
                    onChange={onAttendChange}
                  />
                )}
              </div>
            </div>
          )}
          <p data-anno='4-5' className='mt-1.5 flex items-center gap-2 text-[13px] text-fg-muted'>
            <Clock3 size={16} strokeWidth={1.75} className='shrink-0' />
            {durationOf(study, locale)}
          </p>

          <div data-anno='4-6' className='mt-4 flex flex-wrap gap-2'>
            <Button
              data-anno='4-6-1'
              variant='secondary'
              size='sm'
              leadingIcon={<ClipboardList size={14} />}
              disabled={!attendanceOn}
              title={attendanceOn ? undefined : '참여가 끝나 출석부를 열 수 없습니다'}
              onClick={() => router.push(`/proto/core/${locale}/my/studies`)}
            >
              출석부
            </Button>
            <Button
              data-anno='4-6-2'
              variant='secondary'
              size='sm'
              leadingIcon={<MessageCircle size={14} />}
              disabled={!discordOn}
              title={discordOn ? undefined : '참여가 끝나 채널에 들어갈 수 없습니다'}
              onClick={() => window.open(discordUrl(study), '_blank', 'noopener,noreferrer')}
            >
              디스코드
            </Button>
            <Button
              data-anno='4-6-3'
              variant='secondary'
              size='sm'
              leadingIcon={<FolderOpen size={14} />}
              disabled={!driveOn}
              title={driveOn ? undefined : '참여가 끝나 자료실을 열 수 없습니다'}
              onClick={() => window.open(driveUrl(study), '_blank', 'noopener,noreferrer')}
            >
              자료실
            </Button>
          </div>

          <ul data-anno='4-7' className='mt-4 flex flex-wrap gap-1.5'>
            {tags.map((tag) => (
              <li key={tag}>
                <Badge>{tag}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </li>
  );
}
