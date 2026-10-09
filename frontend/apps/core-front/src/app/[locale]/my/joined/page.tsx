'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge, Button, Card, EmptyState, cx, Select } from '@studyclub/ui';
import { Award, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

import { SegmentTabs } from '@/components/SegmentTabs';
import { categoryGradient, categoryMeta } from '@/components/StudyThumb';
import { useStudies } from '@/features/studies/queries';
import { meetingWindow, meetingsOf, mergeAttendanceSeed, type MyStatus } from '@/lib/attendance';
import { bookScore, myAttendanceBook, type MyAttendanceBook } from '@/lib/attendance-book';
import { getUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import type { Study } from '@/lib/content';
import { t } from '@/lib/i18n';
import {
  LEFT_BADGE,
  LIFE_LABEL,
  addDays,
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
} from '@/lib/joined';
import { getApplications, getRegion, seedDemoData } from '@/lib/me';
import { SCHEDULE_ROLE_LABEL, manageAccessOf, type ScheduleRole } from '@/lib/meetings';
import { IS_DEV, syncPreview } from '@/lib/preview';

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
  upcoming: {
    title: '시작 전 스터디가 없습니다',
    description: '승인된 뒤 아직 시작하지 않은 스터디가 여기에 모입니다.',
  },
  active: { title: '참여 중인 스터디가 없습니다', description: '지금 들어가는 스터디가 여기에 모입니다.' },
  ended: {
    title: '참여가 끝난 스터디가 없습니다',
    description: '완주했거나 참여가 끝난 스터디가 여기에 모입니다.',
  },
};

type SortKey = 'next' | 'start' | 'end' | 'name';

/** 역할로 거르기 — 운영 = 캡틴·네비게이터, 참여 = 크루. */
type RoleFilter = 'all' | 'manage' | 'join';

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: '모든 역할' },
  { key: 'manage', label: '운영 (캡틴·네비게이터)' },
  { key: 'join', label: '참여 (크루)' },
];

const isMine = (study: Study) => manageAccessOf(study.id) !== undefined;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'next', label: '다음 회차 순' },
  { key: 'start', label: '시작일 최근 순' },
  { key: 'end', label: '종료일 최근 순' },
  { key: 'name', label: '이름 순' },
];

const defaultSortOf = (filter: Filter): SortKey => (filter === 'ended' ? 'end' : 'next');

/** 첫·마지막 회차 일자 — 킥오프(no=0)를 제외한 정규 회차 기준. */
function spanOf(study: Study): { start: string; end: string } {
  const regular = meetingsOf(study).filter((m) => m.no !== 0);
  return { start: regular[0]?.date ?? '', end: regular[regular.length - 1]?.date ?? '' };
}

function studiesIn(
  mine: Study[],
  filter: Filter,
  sort: SortKey,
  role: RoleFilter,
  wallTz: WallTz,
  locale: Locale,
): Study[] {
  const list = mine
    .filter((s) => filter === 'all' || lifeStatus(s) === filter)
    .filter((s) => role === 'all' || (role === 'manage') === isMine(s));
  const nextAt = (s: Study) => {
    const m = upcomingMeeting(s, wallTz);
    return m ? meetingWindow(s, m).start.getTime() : Number.POSITIVE_INFINITY;
  };
  const byKey = (a: Study, b: Study) => {
    if (sort === 'next') return nextAt(a) - nextAt(b);
    if (sort === 'start') return spanOf(b).start.localeCompare(spanOf(a).start);
    if (sort === 'end') return spanOf(b).end.localeCompare(spanOf(a).end);
    return t(a.title, locale).localeCompare(t(b.title, locale), locale);
  };
  return [...list].sort(
    (a, b) => (filter === 'ended' ? Number(isCompleted(b)) - Number(isCompleted(a)) : 0) || byKey(a, b),
  );
}

function weekRangeLabel(days: WeekDay[]): string {
  if (days.length === 0) return '';
  const ymd = days[0].date;
  return `${ymd.slice(0, 4)}년 ${Number(ymd.slice(5, 7))}월`;
}

/** 내 스터디에서 스터디 일정으로 가는 경로. */
function schedulePath(locale: Locale, study: Study): string {
  return `/${locale}/my/joined/${study.study_id}/schedule`;
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
    <section className='mt-5'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <h2 className='text-lg font-extrabold tracking-tight'>
          {thisWeek ? '이번 주 일정 ' : '주간 일정 '}
          <span className='tnum font-bold text-fg-muted'>{range}</span>
        </h2>
        <div className='flex items-center gap-2'>
          <SegmentTabs
            label='타임존'
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
              className={cx('min-w-0 rounded-card px-1 py-1.5', d.today ? 'bg-brand-subtle' : 'bg-surface-1')}
            >
              <p className={cx('text-center text-[11px] font-bold', d.today ? 'text-primary-700' : 'text-fg-muted')}>
                {d.label}
              </p>
              <p className={cx('tnum text-center text-sm font-extrabold', d.today ? 'text-primary-700' : 'text-fg')}>
                {d.day}
              </p>
              <ul className='mt-1 flex min-h-10 flex-col gap-1'>
                {d.hits.map((hit) => {
                  const study = byId.get(hit.studyId);
                  const { color } = categoryMeta(study?.category);
                  const [accent] = color;
                  return (
                    <li key={`${hit.studyId}-${hit.meetingId}`}>
                      <button
                        type='button'
                        title={`${hit.time} ${hit.title} ${hit.no === 0 ? '킥오프' : `${hit.no}회차`}`}
                        onClick={() => study && router.push(schedulePath(locale, study))}
                        className='block w-full rounded-sm border-l-[3px] px-1.5 py-1 text-left text-[10px] font-bold leading-tight hover:brightness-[0.97]'
                        style={{
                          borderLeftColor: accent,
                          backgroundColor: `color-mix(in srgb, ${accent} 14%, var(--color-bg))`,
                          color: accent,
                        }}
                      >
                        <span className='tnum block text-[10px] font-semibold opacity-75'>{hit.time}</span>
                        <span className='line-clamp-2 break-keep'>{hit.title}</span>
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

function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className='mt-8 flex items-center justify-center gap-1' aria-label='목록 페이지'>
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

function MissionClear({ book }: { book: MyAttendanceBook }) {
  const { attended, total } = bookScore(book);
  const bars = book.meetings.filter((m) => {
    const st = book.cells[m.id];
    return st !== undefined && st !== 'excused';
  });
  return (
    <div className='mt-3 rounded-card border border-warning-400 bg-bg px-3 py-2.5 shadow-xs'>
      <p className='flex items-center gap-1.5 text-[13px] font-extrabold tracking-tight text-warning-700'>
        <Award size={15} strokeWidth={2.5} aria-hidden='true' />
        완주를 축하합니다!
      </p>
      <p className='mt-1 flex items-baseline gap-1'>
        <span className='tnum text-[32px] font-extrabold leading-none tracking-tight text-warning-700'>{attended}</span>
        <span className='text-lg font-bold text-fg-muted'>/</span>
        <span className='tnum text-lg font-bold text-fg-muted'>{total}</span>
        <span className='ml-1 text-[13px] font-bold text-fg-muted'>회</span>
      </p>
      <ol className='mt-2.5 flex gap-1' aria-hidden='true'>
        {bars.map((m) => {
          const st = book.cells[m.id];
          const filled = st === 'present' || st === 'late';
          return (
            <li
              key={m.id}
              className={cx('h-2 min-w-0 flex-1 rounded-pill', filled ? 'bg-warning-400' : 'bg-surface-3')}
            />
          );
        })}
      </ol>
    </div>
  );
}

function StudyItem({ study, locale, wallTz }: { study: Study; locale: Locale; wallTz: WallTz }) {
  const { icon: Icon } = categoryMeta(study.category);
  const life = lifeStatus(study);
  const completed = isCompleted(study);
  const left = life === 'ended' && !completed;
  const book = myAttendanceBook(study);
  // 이 스터디에서 내 역할 — 맡은 스터디가 아니면 크루.
  // TODO(api): GET /api/me/participations 응답의 participantRole·captain 플래그로 교체
  const role: ScheduleRole = manageAccessOf(study.id)?.role ?? 'crew';
  // 카드는 스터디 일정으로 간다. 참여를 중단한 스터디는 더 이상 참가자가 아니라 링크가 없다.
  const linked = !(life === 'ended' && !completed);

  return (
    <li>
      <Card
        padding='lg'
        className={cx(
          'relative flex gap-4 overflow-hidden',
          linked && 'cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-1',
          completed && 'border-warning-400 bg-warning-50 shadow-sm',
        )}
      >
        {completed && <span className='absolute inset-y-0 left-0 w-1 bg-warning-400' aria-hidden='true' />}
        <span
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
              <div className='flex min-w-0 items-center gap-2'>
                {linked ? (
                  <Link
                    href={schedulePath(locale, study)}
                    className="min-w-0 truncate text-[17px] font-bold text-fg after:absolute after:inset-0 after:content-['']"
                  >
                    {t(study.title, locale)}
                  </Link>
                ) : (
                  <span className='min-w-0 truncate text-[17px] font-bold text-fg'>{t(study.title, locale)}</span>
                )}
                <span className='shrink-0'>
                  <Badge tone={role === 'crew' ? 'member' : role}>{SCHEDULE_ROLE_LABEL[role]}</Badge>
                </span>
              </div>
              <p className='mt-0.5 text-[13px] text-fg-muted'>{durationOf(study, locale, wallTz)}</p>
            </div>
            <span className='flex shrink-0 items-center gap-0.5'>
              <span className='ml-1'>
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
            <div className='mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
              <p
                className={cx(
                  'min-w-0 tracking-tight',
                  left ? 'text-sm font-semibold text-fg-muted' : 'text-lg font-extrabold text-fg',
                )}
              >
                {upcomingOf(study, locale, wallTz)}
              </p>
            </div>
          )}
        </div>
      </Card>
    </li>
  );
}

/**
 * 내 스터디 — 참여 목록.
 *
 * 기본 탭은 참여중. 이번 주 회차는 주간 줄에서 보고, 카드나 주간 칸을 누르면 그 스터디의
 * 스터디 일정으로 간다. 출석 기록·디스코드·자료실은 스터디 일정에 있다.
 */
export default function MyJoinedPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const [ready, setReady] = useState(false);
  const [mineIds, setMineIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [sort, setSort] = useState<SortKey>(defaultSortOf('active'));
  const [role, setRole] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);
  const [wallTz, setWallTz] = useState<WallTz>('KST');
  const [weekStart, setWeekStart] = useState(() => mondayOf(ymdInTz(new Date(), 'KST')));
  const listTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (IS_DEV) seedDemoData();
    const u = IS_DEV ? syncPreview() : getUser();
    if (!u) {
      router.replace(`/${locale}/login?next=/${locale}/my/joined`);
      return;
    }
    if (!u.onboardingCompletedAt) {
      router.replace(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/my/joined`)}`);
      return;
    }
    setMineIds(
      getApplications()
        .filter((a) => a.status === 'accepted')
        .map((a) => a.studyId),
    );
    const tz = userWallTz(getRegion());
    setWallTz(tz);
    setWeekStart(mondayOf(ymdInTz(new Date(), tz)));
    setReady(true);
  }, [locale, router]);

  const { data: allStudies = [], isError, refetch } = useStudies({});

  const mine = useMemo<Study[]>(() => {
    const byId = new Map(allStudies.map((s) => [s.id, s]));
    return mineIds.map((id) => byId.get(id)).filter((s): s is Study => Boolean(s));
  }, [mineIds, allStudies]);

  const [, setAttendanceTick] = useState(0);

  // 완주 스터디 출석 데모 데이터 — 스터디 목록이 로드된 후 한 번만 채운다.
  useEffect(() => {
    if (!IS_DEV || mine.length === 0) return;
    const seed: Record<string, Record<string, MyStatus>> = {};
    for (const study of mine) {
      if (!isCompleted(study)) continue;
      const meetings = meetingsOf(study);
      // 마지막 회차만 결석 처리 — 완주 점수판 색상 변화가 보이도록.
      seed[study.id] = Object.fromEntries(
        meetings.map((m, i) => [m.id, i === meetings.length - 1 ? ('absent' as const) : ('present' as const)]),
      );
    }
    const changed = mergeAttendanceSeed(seed);
    if (changed) setAttendanceTick((t) => t + 1);
  }, [mine]);

  const days = useMemo(() => weekDays(mine, locale, wallTz, weekStart), [mine, locale, wallTz, weekStart]);
  const thisWeek = weekStart === mondayOf(ymdInTz(new Date(), wallTz));

  const hasMine = mine.some(isMine);

  const shown = useMemo(
    () => studiesIn(mine, filter, sort, role, wallTz, locale),
    [mine, filter, sort, role, wallTz, locale],
  );

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const paged = shown.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function changeFilter(next: Filter) {
    setFilter(next);
    setSort(defaultSortOf(next));
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
    listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!ready) {
    return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
  }

  if (isError) {
    return (
      <div className='px-6 py-16 text-center'>
        <p className='text-sm text-fg-secondary'>스터디 목록을 불러오지 못했습니다. 다시 시도해 주세요.</p>
        <Button variant='secondary' size='sm' className='mt-4' onClick={() => refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-3xl px-6 pb-16 pt-10'>
      <h1 className='text-2xl font-extrabold tracking-tight'>내 스터디</h1>

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
        <SegmentTabs label='참여 상태' value={filter} options={FILTERS} onChange={changeFilter} />
        <div className='ml-auto flex flex-wrap items-center gap-2'>
          {hasMine && (
            <Select
              aria-label='역할'
              value={role}
              onChange={(ev) => {
                setRole(ev.target.value as RoleFilter);
                setPage(1);
              }}
              size='sm'
              className='text-fg-secondary'
            >
              {ROLE_FILTERS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
          <Select
            aria-label='정렬'
            value={sort}
            onChange={(ev) => {
              setSort(ev.target.value as SortKey);
              setPage(1);
            }}
            size='sm'
            className='text-fg-secondary'
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className='mt-8'>
          <EmptyState
            icon={<BookOpen size={28} />}
            title={
              role === 'manage'
                ? '운영하는 스터디가 없습니다'
                : role === 'join'
                  ? '크루로 참여한 스터디가 없습니다'
                  : EMPTY[filter].title
            }
            description={
              role === 'manage'
                ? '이 탭에는 캡틴이나 네비게이터로 맡은 스터디가 없습니다.'
                : role === 'join'
                  ? '이 탭에는 크루로 참여한 스터디가 없습니다.'
                  : EMPTY[filter].description
            }
          />
        </div>
      ) : (
        <div ref={listTop}>
          <ul className='mt-6 flex flex-col gap-3'>
            {paged.map((study) => (
              <StudyItem key={study.id} study={study} locale={locale} wallTz={wallTz} />
            ))}
          </ul>
          <Pager page={pageSafe} pages={pages} onChange={changePage} />
        </div>
      )}
    </div>
  );
}
