'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, ButtonLink, FilterChip, Input, Pagination, Segmented, cx } from '@studyclub/ui';
import { Download, Search, ThumbsUp } from 'lucide-react';

import { PageHeader } from '@/components/ui';
import { FilterSelect } from '@/features/feedbacks/components/FilterSelect';
import {
  RETRO_SECTIONS,
  meetingDate,
  sectionCount,
  sectionOf,
  shortDateTime,
  writingRate,
} from '@/features/meeting-retro/model';
import { useAdminRetros, useRetroMeetingOptions, useRetroStudyOptions } from '@/features/meeting-retro/queries';
import { adminRetrosCsvUrl } from '@/features/meeting-retro/repository';
import type { AdminRetrosQuery, ApiAdminRetro, RetroSectionKey, RetroSort } from '@/features/meeting-retro/types';
import { TimezoneNote } from '@/features/notifications/components/TimezoneNote';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useDisplayTimeZone } from '@/lib/use-display-timezone';
import { pageOf, useUrlState } from '@/lib/use-url-state';

/**
 * 회고 모아보기 — 진행 중인 스터디의 끝난 회차에 크루가 남긴 회고를 본다. 열람 전용.
 * 명세: playground `console/retros/spec.ts`. 좁히기 · 정렬 · 페이지 · 건수는 서버가 한다(GET /api/admin/retros).
 *
 * 처음엔 「문항별」 — 캡틴이 먼저 찾는 건 「최근에 어떤 개선 의견이 나왔나」라서 개선할 점을 세로로 모아 최근 것부터 읽는다.
 * 「표」는 한 사람의 문항을 한 줄로 보는 용도다.
 */
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;
const ALL_COLS = RETRO_SECTIONS.map((s) => s.api);
/** 문항별 보기의 고르는 순서 — 다음 미팅에 반영할 내용을 찾는 화면이라 개선할 점이 먼저다. 표 · CSV 의 열 순서는 RETRO_SECTIONS. */
const PICK_ORDER: RetroSectionKey[] = ['IMPROVE', 'GOOD', 'FEELING'];
const LIKE_SORTS = ALL_COLS.flatMap((s) => [`${s}:DESC`, `${s}:ASC`]);

/** URL 쿼리 — 기본값은 싣지 않는다. `like` 는 표 열 머리 👍 정렬(`GOOD:DESC`). */
const URL_DEFAULTS = {
  study: 'ALL',
  meeting: 'ALL',
  q: '',
  view: 'question',
  section: 'IMPROVE',
  sort: 'RECENT',
  cols: ALL_COLS.join(','),
  like: '',
  page: '1',
};
const URL_ALLOWED = {
  view: ['question', 'table'],
  section: ALL_COLS,
  sort: ['RECENT', 'LIKES'],
  like: LIKE_SORTS,
};

type View = 'question' | 'table';

/** 보이는 문항 — 모르는 값은 버리고, 하나도 안 남으면 셋 다. 순서는 늘 RETRO_SECTIONS. */
function colsOf(raw: string): RetroSectionKey[] {
  const picked = raw.split(',');
  const cols = ALL_COLS.filter((s) => picked.includes(s));
  return cols.length ? cols : ALL_COLS;
}

export function RetrosBrowser() {
  const zone = useDisplayTimeZone();
  const [filters, setFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const page = pageOf(filters.page);
  const view = filters.view as View;
  const section = filters.section as RetroSectionKey;
  const sort = filters.sort as RetroSort;
  const cols = useMemo(() => colsOf(filters.cols), [filters.cols]);
  // 끈 열의 👍 정렬은 풀린 것으로 본다
  const likeSort = useMemo<LikeSort | null>(() => {
    const [s, dir] = filters.like.split(':') as [RetroSectionKey, LikeSort['dir']];
    return filters.like && cols.includes(s) ? { section: s, dir } : null;
  }, [filters.like, cols]);

  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const lastDebounced = useRef(debounced);
  useEffect(() => {
    if (debounced === lastDebounced.current) return;
    lastDebounced.current = debounced;
    if (debounced !== filters.q) setFilters({ q: debounced, page: '1' });
  }, [debounced, filters.q, setFilters]);

  const studyOptions = useRetroStudyOptions();
  const studyId = filters.study === 'ALL' ? undefined : Number(filters.study);
  const meetingOptions = useRetroMeetingOptions(studyId);
  // CSV 는 같은 조건을 페이지 없이 — 문항별 보기는 세 문항을 모두 담은 표 모양으로 내려받는다
  const csvQuery = useMemo<Omit<AdminRetrosQuery, 'offset' | 'limit'>>(() => {
    const base = {
      studyId,
      meetingId: studyId !== undefined && filters.meeting !== 'ALL' ? Number(filters.meeting) : undefined,
      q: filters.q || undefined,
      sort,
    };
    if (view === 'question') return base;
    return {
      ...base,
      sections: cols.length === ALL_COLS.length ? undefined : cols,
      likeSort: likeSort?.section,
      likeDir: likeSort?.dir,
    };
  }, [studyId, filters.meeting, filters.q, sort, view, cols, likeSort]);
  const query = useMemo<AdminRetrosQuery>(
    () => ({
      ...csvQuery,
      ...(view === 'question' && { section }),
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [csvQuery, view, section, page],
  );
  const { data, error, isPending, refetch } = useAdminRetros(query);

  // 보던 페이지가 사라졌으면 첫 페이지로
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && page > 1) setFilters({ page: '1' });
  }, [data, page, setFilters]);

  const rate = data ? writingRate(data.summary) : null;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const count = (s: RetroSectionKey) => (data ? sectionCount(data.summary, s) : 0);

  function toggleCol(s: RetroSectionKey) {
    const next = cols.includes(s) ? cols.filter((c) => c !== s) : [...cols, s];
    if (next.length === 0) return;
    setFilters({
      cols: ALL_COLS.filter((c) => next.includes(c)).join(','),
      ...(likeSort?.section === s && !next.includes(s) && { like: '' }),
      page: '1',
    });
  }

  return (
    <div>
      <PageHeader
        title='회고 모아보기'
        action={
          // 줄이 없으면 누를 수 없다 — 링크에는 비활성이 없어 그때만 단추로 그린다
          data && data.total > 0 ? (
            <ButtonLink
              size='sm'
              variant='secondary'
              leadingIcon={<Download size={15} />}
              href={adminRetrosCsvUrl(csvQuery)}
              download
            >
              CSV 내려받기
            </ButtonLink>
          ) : (
            <Button size='sm' variant='secondary' leadingIcon={<Download size={15} />} disabled>
              CSV 내려받기
            </Button>
          )
        }
      />

      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <FilterSelect
          label='전체 스터디'
          className='min-w-48'
          value={filters.study}
          options={studyOptions.data ?? []}
          // 회차는 스터디마다 다르다 — 스터디를 바꾸면 회차는 전체로
          onChange={(next) => setFilters({ study: next, meeting: 'ALL', page: '1' })}
        />
        {/* 회차는 스터디를 고른 뒤에만 고른다 */}
        {studyId !== undefined && (
          <FilterSelect
            label='전체 회차'
            value={filters.meeting}
            options={meetingOptions}
            onChange={(next) => setFilters({ meeting: next, page: '1' })}
          />
        )}
        <Input
          type='search'
          size='sm'
          aria-label='참여자 이름 검색'
          leadingIcon={<Search size={15} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='참여자 이름 검색'
          className='w-48'
        />
        <div className='ml-auto'>
          <Segmented<View>
            size='sm'
            aria-label='보기'
            value={view}
            onChange={(v) => setFilters({ view: v, page: '1' })}
            options={[
              { value: 'question', label: '문항별' },
              { value: 'table', label: '표' },
            ]}
          />
        </div>
      </div>

      {/* 요약 한 줄 — 의견 목록이 첫 화면에 보이도록 카드 대신 줄로 */}
      <p className='tnum mb-1 min-h-5 type-body-sm text-fg-secondary' data-testid='retro-rate'>
        {data && (
          <>
            작성률 <span className='font-semibold text-fg'>{rate === null ? '-' : `${rate}%`}</span>
            <span className='text-fg-muted'>
              {' '}
              (
              {rate === null
                ? '기한이 지난 회차가 아직 없어요'
                : `기한 지난 회고 ${data.summary.closedWritten}/${data.summary.closedRows} 작성`}
              )
            </span>
          </>
        )}
      </p>
      <TimezoneNote subject='날짜·시각은' />

      <div className='mb-2 flex flex-wrap items-end justify-between gap-3'>
        {view === 'question' ? (
          <div className='flex flex-wrap items-center gap-2'>
            <Segmented<RetroSectionKey>
              size='sm'
              shape='pill'
              aria-label='문항'
              value={section}
              onChange={(v) => setFilters({ section: v, page: '1' })}
              options={PICK_ORDER.map((s) => ({ value: s, label: `${sectionOf(s).label} ${count(s)}` }))}
            />
            <Segmented<RetroSort>
              size='sm'
              aria-label='순서'
              value={sort}
              onChange={(v) => setFilters({ sort: v, page: '1' })}
              options={[
                { value: 'RECENT', label: '최신순' },
                { value: 'LIKES', label: '공감순' },
              ]}
            />
          </div>
        ) : (
          <div className='flex flex-wrap items-center gap-2'>
            <div role='group' aria-label='보일 문항' className='flex flex-wrap items-center gap-1.5'>
              {RETRO_SECTIONS.map((s) => {
                const on = cols.includes(s.api);
                return (
                  <FilterChip
                    key={s.api}
                    selected={on}
                    // 마지막 남은 열은 끌 수 없다 — 문항 없는 표가 되지 않게
                    disabled={on && cols.length === 1}
                    onClick={() => toggleCol(s.api)}
                  >
                    {s.label} {count(s.api)}
                  </FilterChip>
                );
              })}
            </div>
            <Segmented<RetroSort>
              size='sm'
              aria-label='순서'
              value={sort}
              onChange={(v) => setFilters({ sort: v, like: '', page: '1' })}
              options={[
                { value: 'RECENT', label: '최신순' },
                { value: 'LIKES', label: '공감순' },
              ]}
            />
          </div>
        )}
        {/* 못 읽었을 때는 숨긴다 — 0건으로 보이지 않게 */}
        <span className='tnum ml-auto type-body-sm text-fg-muted' data-testid='retro-total'>
          {data && !error && `총 ${data.total.toLocaleString()}건`}
        </span>
      </div>

      {isPending && !error ? (
        <div className='card px-5 py-4'>
          <span className='block h-4 animate-pulse rounded bg-surface-2' />
        </div>
      ) : error || !data ? (
        <div role='alert' className='card px-6 py-10 text-center'>
          {/* 서버 문구는 쓰지 않는다 — 문구가 없는 오류는 「요청에 실패했습니다 (500)」 같은 기술 문구가 된다 */}
          <p className='type-body-sm text-fg-muted'>회고를 불러오지 못했습니다.</p>
          <Button size='sm' variant='secondary' className='mt-3' onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      ) : view === 'question' ? (
        data.items.length === 0 ? (
          <p className='card py-12 text-center type-body-sm text-fg-muted'>조건에 맞는 의견이 없어요.</p>
        ) : (
          <OpinionList rows={data.items} section={section} zone={zone} />
        )
      ) : (
        <RetroTable
          rows={data.items}
          cols={cols}
          zone={zone}
          likeSort={likeSort}
          onLikeSort={(s, dir) => setFilters({ like: `${s}:${dir}`, page: '1' })}
        />
      )}

      {data && !error && (
        <Pagination
          page={page}
          total={pageCount}
          onChange={(next) => setFilters({ page: String(next) })}
          className='mt-4'
        />
      )}
    </div>
  );
}

function OpinionList({ rows, section, zone }: { rows: ApiAdminRetro[]; section: RetroSectionKey; zone: string }) {
  const field = sectionOf(section).key;
  return (
    <ul className='card divide-y divide-border'>
      {rows.map((r) => (
        <li key={`${r.meetingId}-${r.participantName}-${r.retro.writtenAt}`} className='flex items-start gap-4 px-5 py-4'>
          <div className='min-w-0 flex-1'>
            <p className='whitespace-pre-wrap break-words type-body-md text-fg'>{r.retro[field]}</p>
            <p className='tnum mt-1.5 type-label-sm text-fg-muted'>
              {r.studyTitle} · {r.groupName} · {r.meetingNo}회차 {meetingDate(r.meetingStartAt, zone)} ·{' '}
              <span className='font-semibold text-fg-secondary'>{r.participantName}</span> ·{' '}
              {shortDateTime(r.retro.writtenAt, zone)} 작성
            </p>
          </div>
          <span
            className='tnum flex shrink-0 items-center gap-1 type-label-md text-fg-secondary'
            aria-label={`공감 ${r.retro.likes[section] ?? 0}개`}
          >
            <ThumbsUp size={14} aria-hidden /> {r.retro.likes[section] ?? 0}
          </span>
        </li>
      ))}
    </ul>
  );
}

type LikeSort = { section: RetroSectionKey; dir: 'DESC' | 'ASC' };

function RetroTable({
  rows,
  cols,
  zone,
  likeSort,
  onLikeSort,
}: {
  rows: ApiAdminRetro[];
  cols: RetroSectionKey[];
  zone: string;
  likeSort: LikeSort | null;
  onLikeSort: (section: RetroSectionKey, dir: 'DESC' | 'ASC') => void;
}) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const visible = RETRO_SECTIONS.filter((s) => cols.includes(s.api));
  // 한 사람의 세 문항이 한 줄에 다 보이게 — 고정 열(스터디 · 회차 160 · 참여자 80 · 작성일 92)을 줄이고
  // 문항 열이 남는 폭을 나눠 쓴다. 콘솔 본문 폭이면 세 문항이 다 들어가고, 더 좁은 화면에서만 가로로 민다
  const minWidth = 332 + 200 * visible.length;
  const sticky = 'sticky z-[1] bg-surface-raised';

  return (
    <div className='card'>
      {/* 20줄이면 아래 스크롤바가 화면 밖이다 — 위에서도 넘긴다(스터디 표와 같다) */}
      <div
        ref={topScrollRef}
        className='overflow-x-auto border-b border-border'
        onScroll={() => {
          if (topScrollRef.current && tableScrollRef.current)
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }}
        aria-label='표 가로 스크롤'
      >
        <div className='h-3' style={{ minWidth }} />
      </div>
      <div
        ref={tableScrollRef}
        className='overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        onScroll={() => {
          if (topScrollRef.current && tableScrollRef.current)
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
        }}
      >
        <table className='bo-table w-full table-fixed border-separate border-spacing-0' style={{ minWidth }}>
          <colgroup>
            <col className='w-[160px]' />
            <col className='w-[80px]' />
            {visible.map((s) => (
              <col key={s.api} />
            ))}
            <col className='w-[92px]' />
          </colgroup>
          <thead>
            <tr>
              <th className={cx(sticky, 'left-0')}>스터디 · 회차</th>
              <th className={cx(sticky, 'left-[160px] shadow-[4px_0_6px_-4px_var(--color-border-strong)]')}>참여자</th>
              {visible.map((s) => {
                const active = likeSort?.section === s.api ? likeSort.dir : null;
                return (
                  <th
                    key={s.api}
                    aria-sort={active ? (active === 'ASC' ? 'ascending' : 'descending') : undefined}
                  >
                    <button
                      // ui-native: 표 머리 정렬 — 머리 글자 자체가 정렬 단추
                      type='button'
                      onClick={() => onLikeSort(s.api, active === 'DESC' ? 'ASC' : 'DESC')}
                      aria-label={`${s.label} 공감 ${active === 'DESC' ? '적은' : '많은'} 순으로 정렬`}
                      className={cx(
                        'whitespace-nowrap rounded-sm text-left underline-offset-4 hover:underline',
                        active && 'text-brand',
                      )}
                    >
                      {s.label}
                    </button>
                  </th>
                );
              })}
              <th>작성일</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3 + visible.length} className='py-12 text-center text-fg-muted'>
                  조건에 맞는 회고가 없어요.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const [date, ...time] = shortDateTime(r.retro.writtenAt, zone).split(' ');
              return (
                <tr key={`${r.meetingId}-${r.participantName}-${r.retro.writtenAt}`} className='align-top'>
                  {/* 스터디 · 반 · 회차를 한 칸에 — 따로 열을 두면 문항 칸이 좁아진다 */}
                  <td className={cx(sticky, 'left-0')}>
                    <span className='line-clamp-2 break-words' title={r.studyTitle}>
                      {r.studyTitle}
                    </span>
                    <span className='tnum mt-0.5 block type-label-sm text-fg-muted'>
                      {r.groupName} · {r.meetingNo}회차
                    </span>
                  </td>
                  <td
                    className={cx(
                      sticky,
                      'left-[160px] break-words font-semibold shadow-[4px_0_6px_-4px_var(--color-border-strong)]',
                    )}
                  >
                    {r.participantName}
                  </td>
                  {visible.map((s) => {
                    const answer = r.retro[s.key];
                    return (
                      <td key={s.api}>
                        {answer ? (
                          // 👍 는 칸 오른쪽 첫 줄 높이 — 세로로 훑을 때 수가 한 줄로 맞는다
                          <span className='flex items-start gap-3'>
                            <span className='min-w-0 flex-1 whitespace-pre-wrap break-words'>{answer}</span>
                            <span
                              className='tnum flex shrink-0 items-center gap-1 type-label-sm text-fg-muted'
                              aria-label={`공감 ${r.retro.likes[s.api] ?? 0}개`}
                            >
                              <ThumbsUp size={12} aria-hidden /> {r.retro.likes[s.api] ?? 0}
                            </span>
                          </span>
                        ) : (
                          <span className='text-fg-muted'>-</span>
                        )}
                      </td>
                    );
                  })}
                  {/* 날짜와 시각을 두 줄로 — 칸 폭을 줄인다 */}
                  <td className='tnum text-fg-secondary'>
                    <span className='block whitespace-nowrap'>{date}</span>
                    <span className='block whitespace-nowrap type-label-sm text-fg-muted'>{time.join(' ')}</span>
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
