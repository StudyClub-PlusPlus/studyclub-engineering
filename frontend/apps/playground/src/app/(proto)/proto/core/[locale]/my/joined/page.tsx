'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { AttendanceGrid } from '@core/components/AttendanceGrid';
import { categoryGradient, categoryMeta } from '@core/components/StudyThumb';
import {
  STATUS_LABEL,
  STATUS_STYLE,
  canCheckIn,
  getMyAttendance,
  resolveStatus,
} from '@core/lib/attendance';
import { bookScore, myAttendanceBook, rateTone, type MyAttendanceBook } from '@core/lib/attendance-book';
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
  discordUrl,
  driveUrl,
  durationOf,
  isCompleted,
  lifeStatus,
  mondayOf,
  upcomingMeeting,
  upcomingOf,
  userWallTz,
  weekDays,
  ymdInTz,
  type LifeStatus,
  type WallTz,
  type WeekDay,
} from '@core/lib/joined';
import { getApplications, getRegion } from '@core/lib/me';
import { studies as allStudies, type Study, type StudyMeeting } from '@studyclub/mock';
import { Badge, Button, Card, EmptyState, cx } from '@studyclub/ui';
import {
  Award,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  Heart,
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

function studiesIn(mine: Study[], filter: Filter): Study[] {
  const list = filter === 'all' ? mine : mine.filter((s) => lifeStatus(s) === filter);
  if (filter !== 'ended') return list;
  return [...list].sort((a, b) => Number(isCompleted(b)) - Number(isCompleted(a)));
}

function weekRangeLabel(days: WeekDay[]): string {
  if (days.length === 0) return '';
  const ymd = days[0].date;
  return `${ymd.slice(0, 4)}년 ${Number(ymd.slice(5, 7))}월`;
}

function AttendActions({
  study,
  meeting,
  attendAnno,
}: {
  study: Study;
  meeting: StudyMeeting;
  attendAnno: string;
}) {
  const stored = getMyAttendance(study.id);
  const status = resolveStatus(study, meeting, stored);
  const joinOn = canCheckIn(study, meeting) && canOpenDiscord(study);

  function join() {
    if (!joinOn) return;
    window.open(discordUrl(study), '_blank', 'noopener,noreferrer');
  }

  if (status) {
    return (
      <span
        className={cx(
          'mt-0.5 block min-h-[1.625rem] truncate rounded-sm px-0.5 py-1 text-[10px] font-bold',
          STATUS_STYLE[status],
        )}
      >
        {STATUS_LABEL[status]}
      </span>
    );
  }

  return (
    <button
      type='button'
      data-anno={attendAnno}
      disabled={!joinOn}
      onClick={join}
      className={cx(
        'mt-0.5 block min-h-[1.625rem] w-full truncate rounded-sm px-0.5 py-1 text-[10px] font-bold',
        joinOn
          ? 'bg-brand text-on-brand hover:bg-brand-hover'
          : 'bg-neutral-200 text-neutral-400',
      )}
    >
      참석
    </button>
  );
}

function DiscordGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
      <path d='M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.07.07 0 0 0-.079.035c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.08.08 0 0 0-.079-.035A19.7 19.7 0 0 0 3.677 4.37a.08.08 0 0 0-.037.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.028 14 14 0 0 0 1.226-1.994.07.07 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.08.08 0 0 1-.008-.132c.126-.094.252-.192.372-.291a.07.07 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.07.07 0 0 1 .079.01c.12.099.246.198.373.292a.08.08 0 0 1-.006.132 12.3 12.3 0 0 1-1.873.891.08.08 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z' />
    </svg>
  );
}

function ResourceIcon({
  label,
  anno,
  disabled,
  title,
  onClick,
  children,
}: {
  label: string;
  anno: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      data-anno={anno}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className='grid h-8 w-8 shrink-0 place-items-center rounded-control text-fg hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:text-fg-muted'
    >
      {children}
    </button>
  );
}

function weekChip(category: string | undefined): { accent: string; tint: number } {
  const [accent] = categoryMeta(category).color;
  return { accent, tint: 14 };
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
}: {
  days: WeekDay[];
  thisWeek: boolean;
  locale: Locale;
  wallTz: WallTz;
  studies: Study[];
  onWallTz: (tz: WallTz) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const router = useRouter();
  const range = weekRangeLabel(days);
  const byId = new Map(studies.map((s) => [s.id, s]));
  return (
    <section data-anno='1-1' className='mt-5'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <h2 className='text-lg font-extrabold tracking-tight'>
          {thisWeek ? '이번 주 일정 ' : '주간 일정 '}{' '}
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
              <ul className='mt-1 flex min-h-10 flex-col gap-1'>
                {d.hits.map((hit) => {
                  const { accent, tint } = weekChip(byId.get(hit.studyId)?.category);
                  return (
                    <li key={`${hit.studyId}-${hit.meetingId}`}>
                      <button
                        type='button'
                        title={`${hit.time} ${hit.title} ${hit.no}회차`}
                        onClick={() => router.push(`/proto/core/${locale}/studies/${hit.studyId}`)}
                        className='block w-full rounded-sm border-l-[3px] px-1.5 py-1 text-left text-[10px] font-bold leading-tight hover:brightness-[0.97]'
                        style={{
                          borderLeftColor: accent,
                          backgroundColor: `color-mix(in srgb, ${accent} ${tint}%, var(--color-bg))`,
                          color: accent,
                        }}
                      >
                        <span className='tnum block text-[10px] font-semibold opacity-75'>{hit.time}</span>
                        <span data-anno='1-1-2' className='line-clamp-2 break-keep'>
                          {hit.title}
                        </span>
                      </button>
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
 * 이번 주 회차는 주간 줄에서 보고, 참석은 카드 출석 기록의 다음 회차 칸에서 찍는다.
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
  const [openIds, setOpenIds] = useState<string[]>([]);
  const listTop = useRef<HTMLDivElement>(null);
  const appliedOpen = useRef(false);

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

  const shown = useMemo(() => studiesIn(mine, filter), [filter, mine]);

  useEffect(() => {
    if (!ready || appliedOpen.current) return;
    const open = new URLSearchParams(window.location.search).get('open');
    if (!open) {
      appliedOpen.current = true;
      return;
    }
    const study = mine.find((s) => s.id === open);
    if (!study) {
      appliedOpen.current = true;
      return;
    }
    const nextFilter = lifeStatus(study);
    const list = studiesIn(mine, nextFilter);
    const idx = list.findIndex((s) => s.id === open);
    appliedOpen.current = true;
    setFilter(nextFilter);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
    setOpenIds([open]);
  }, [ready, mine]);

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
        days={days}
        thisWeek={thisWeek}
        locale={locale}
        wallTz={wallTz}
        studies={mine}
        onWallTz={setWallTz}
        onPrev={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
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
                key={study.id}
                study={study}
                locale={locale}
                wallTz={wallTz}
                bookOpen={openIds.includes(study.id)}
                onToggleBook={() =>
                  setOpenIds((cur) => (cur.includes(study.id) ? cur.filter((id) => id !== study.id) : [...cur, study.id]))
                }
              />
            ))}
          </ul>
          <Pager page={pageSafe} pages={pages} onChange={changePage} />
        </div>
      )}
    </div>
  );
}

function MissionClear({ book }: { book: MyAttendanceBook }) {
  const { attended, total } = bookScore(book);
  const bars = book.meetings.filter((s) => {
    const st = book.cells[s.id];
    return st !== undefined && st !== 'excused';
  });
  return (
    <div data-anno='4-4' className='mt-3 rounded-card border border-warning-400 bg-bg px-3 py-2.5 shadow-xs'>
      <p className='flex items-center gap-1.5 text-[13px] font-extrabold tracking-tight text-warning-700'>
        <Award size={15} strokeWidth={2.5} aria-hidden='true' />
        완주를 축하합니다!
      </p>
      <p className='mt-1 flex items-baseline gap-1'>
        <span className='tnum text-[32px] font-extrabold leading-none tracking-tight text-warning-700'>
          {attended}
        </span>
        <span className='text-lg font-bold text-fg-muted'>/</span>
        <span className='tnum text-lg font-bold text-fg-muted'>{total}</span>
        <span className='ml-1 text-[13px] font-bold text-fg-muted'>회</span>
      </p>
      <ol className='mt-2.5 flex gap-1' aria-hidden='true'>
        {bars.map((s) => {
          const st = book.cells[s.id];
          const filled = st === 'present' || st === 'late';
          return (
            <li
              key={s.id}
              className={cx('h-2 min-w-0 flex-1 rounded-pill', filled ? 'bg-warning-400' : 'bg-surface-3')}
            />
          );
        })}
      </ol>
    </div>
  );
}

function StudyItem({
  study,
  locale,
  wallTz,
  bookOpen,
  onToggleBook,
}: {
  study: Study;
  locale: Locale;
  wallTz: WallTz;
  bookOpen: boolean;
  onToggleBook: () => void;
}) {
  const { icon: Icon } = categoryMeta(study.category);
  const life = lifeStatus(study);
  const completed = isCompleted(study);
  const left = life === 'ended' && !completed;
  const attendanceOn = canOpenAttendance();
  const discordOn = canOpenDiscord(study);
  const driveOn = canOpenDrive(study);
  const nextMeeting = upcomingMeeting(study, wallTz);
  const book = myAttendanceBook(study);
  const panelId = `attendance-${study.id}`;
  const ended = life === 'ended' && !completed;
  const showRate = !completed && book.rate !== undefined;

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
            <div className='min-w-0'>
              <Link
                data-anno='4-2'
                href={`/proto/core/${locale}/studies/${study.id}`}
                className='block truncate text-[17px] font-bold text-fg underline-offset-4 hover:underline'
              >
                {t(study.title, locale)}
              </Link>
              <p data-anno='4-5' className='mt-0.5 text-[13px] text-fg-muted'>
                {durationOf(study, locale, wallTz)}
              </p>
            </div>
            <span className='flex shrink-0 items-center gap-0.5'>
              {discordOn && (
                <ResourceIcon
                  anno='4-6-2'
                  label='디스코드'
                  onClick={() => window.open(discordUrl(study), '_blank', 'noopener,noreferrer')}
                >
                  <DiscordGlyph size={16} />
                </ResourceIcon>
              )}
              {driveOn && (
                <ResourceIcon
                  anno='4-6-3'
                  label='자료실'
                  onClick={() => window.open(driveUrl(study), '_blank', 'noopener,noreferrer')}
                >
                  <FolderOpen size={16} strokeWidth={1.75} />
                </ResourceIcon>
              )}
              <span data-anno='4-3' className='ml-1'>
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
            </span>
          </div>

          {completed ? (
            <MissionClear book={book} />
          ) : (
            <p
              data-anno='4-4'
              className={cx(
                'mt-3 tracking-tight',
                ended ? 'text-sm font-semibold text-fg-muted' : 'text-lg font-extrabold text-fg',
              )}
            >
              {upcomingOf(study, locale, wallTz)}
            </p>
          )}

          <div
            data-anno='4-6'
            className={cx(
              'mt-3 overflow-hidden rounded-control border border-border-strong bg-bg',
              bookOpen && 'bg-surface-1',
            )}
          >
            <button
              type='button'
              data-anno='4-6-1'
              disabled={!attendanceOn}
              title={attendanceOn ? undefined : '참여가 끝나 내 출석을 열 수 없습니다'}
              aria-expanded={bookOpen}
              aria-controls={panelId}
              onClick={onToggleBook}
              className='flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-bold text-fg-secondary hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:text-fg-muted'
            >
              <ClipboardList size={14} aria-hidden='true' />
              출석 기록
              {showRate && (
                <span data-anno='4-8' className={cx('tnum', rateTone(book.rate!))}>
                  {book.rate}%
                </span>
              )}
              <ChevronDown
                size={14}
                className={cx('ml-auto shrink-0 transition-transform', bookOpen && 'rotate-180')}
                aria-hidden='true'
              />
            </button>
            {bookOpen && (
              <div id={panelId} data-anno='4-6-1-1' className='border-t border-border px-3 pb-3 pt-2'>
                <AttendanceGrid
                  book={book}
                  study={study}
                  wallTz={wallTz}
                  headAnno='4-6-1-1'
                  cellAnno='4-6-1-2'
                  actionMeetingId={nextMeeting?.id}
                  action={
                    nextMeeting ? (
                      <AttendActions
                        study={study}
                        meeting={nextMeeting}
                        attendAnno='4-6-1-3'
                      />
                    ) : undefined
                  }
                />
              </div>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}
