'use client';

import { useEffect, useMemo, useState } from 'react';

import { PageHeader, SortLabel, type SortDir } from '@console/components/ui';
import { useTopScroll } from '@console/lib/use-top-scroll';
import { t } from '@core/lib/i18n';
import { dateWithDow, scheduleAccessOf, wallParts } from '@core/lib/meetings';
import { RETRO_SECTIONS, retroRowsOf, shortDateTime, type RetroRow, type RetroSection } from '@core/lib/retros';
import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import type { Study } from '@studyclub/types';
import { Button, Input, Pagination, Segmented, Select, cx } from '@studyclub/ui';
import { Download, Search, ThumbsUp } from 'lucide-react';

import { useMswStudies } from '@/proto/lib/use-msw-studies';

/**
 * 회고 모아보기 — 진행 중인 스터디의 끝난 회차마다 참여자가 남긴 회고를 본다. 열람 전용.
 *
 * 처음엔 「문항별」 — 문항 하나(기본 개선할 점)의 답을 세로로 모아 최근 것부터 읽는다.
 * 캡틴이 먼저 찾는 건 「최근에 어떤 개선 의견이 나왔나」라서, 사람마다 세 문항을 옆으로 늘어놓은 표보다 앞에 둔다.
 * 「표」는 한 사람의 세 문항을 한 줄로 보는 용도 — 참여자별 · 회차별로 줄을 세우고, 가로로 민다.
 * TODO(api): GET /api/admin/retros?studyId&meetingId&q&section&sort&offset&limit — 캡틴 전용
 *            section=improve|good|feeling 이면 그 문항을 쓴 회고만, sort=recent|likes
 *            GET /api/admin/retros/export.csv — 같은 조건
 */
const PAGE_SIZE = 20;

type View = 'question' | 'table';
type Sort = 'participant' | 'meeting';
type Order = 'recent' | 'likes';
/** 문항별 보기의 고르는 순서 — 개선할 점이 먼저다. 표 · CSV 의 열 순서(RETRO_SECTIONS)는 그대로. */
const PICK_ORDER: RetroSection[] = ['improve', 'good', 'feeling'];
type Row = RetroRow & { study: Study; studyTitle: string; group: string };

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      size='sm'
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'w-auto shrink-0',
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg',
      )}
    >
      <option value='all'>{value === 'all' ? label : '전체'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

function AnswerCell({ row, section }: { row: Row; section: RetroSection }) {
  const r = row.retro;
  if (!r) return null;
  if (!r[section]) return <span className='text-fg-muted'>-</span>;
  return (
    // 👍 는 답 아래가 아니라 칸 오른쪽 첫 줄 높이 — 줄 높이를 덜 쓰고, 세로로 훑을 때 수가 한 줄로 맞는다
    <span className='flex items-start gap-3'>
      <span className='min-w-0 flex-1 whitespace-pre-wrap break-words'>{r[section]}</span>
      <span className='tnum flex shrink-0 items-center gap-1 type-label-sm text-fg-muted'>
        <ThumbsUp size={12} aria-hidden /> {r.likes[section]}
      </span>
    </span>
  );
}

function OpinionList({ rows, section, zone }: { rows: Row[]; section: RetroSection; zone: string }) {
  return (
    <ul className='card divide-y divide-border'>
      {rows.map((r) => (
        <li key={`${r.studyId}-${r.meetingId}-${r.authorId}`} className='flex items-start gap-4 px-5 py-4'>
          <div className='min-w-0 flex-1'>
            <p className='whitespace-pre-wrap break-words type-body-md text-fg'>{r.retro![section]}</p>
            <p className='tnum mt-1.5 type-label-sm text-fg-muted'>
              {r.studyTitle} · {r.group} · {r.meetingLabel}{' '}
              {dateWithDow(wallParts(new Date(r.meetingStartAt), zone).date)} ·{' '}
              <span className='font-semibold text-fg-secondary'>{r.authorName}</span> ·{' '}
              {shortDateTime(r.retro!.writtenAt, zone, true)} 작성
            </p>
          </div>
          <span className='tnum flex shrink-0 items-center gap-1 type-label-md text-fg-secondary'>
            <ThumbsUp size={14} aria-hidden /> {r.retro!.likes[section]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function csvOf(rows: Row[], zone: string): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = [
    '스터디',
    '반',
    '회차',
    '참여자',
    ...RETRO_SECTIONS.flatMap((s) => [s.label, `${s.label} 👍`]),
    '작성일',
  ];
  const body = rows.map((r) => [
    r.studyTitle,
    r.group,
    r.meetingLabel,
    r.authorName,
    ...RETRO_SECTIONS.flatMap((s) => [r.retro?.[s.key] ?? '', r.retro?.[s.key] ? r.retro.likes[s.key] : '']),
    r.retro ? shortDateTime(r.retro.writtenAt, zone, true) : '',
  ]);
  return '﻿' + [head, ...body].map((line) => line.map(esc).join(',')).join('\n');
}

export function RetrosTable() {
  const studies = useMswStudies();
  const zone = useDisplayTimeZone();
  const [view, setView] = useState<View>('question');
  const [section, setSection] = useState<RetroSection>('improve');
  const [order, setOrder] = useState<Order>('recent');
  const [all, setAll] = useState<Row[] | null>(null);
  const [studyId, setStudyId] = useState('all');
  const [meetingId, setMeetingId] = useState('all');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('participant');
  // 문항 열 머리를 누르면 그 문항의 👍 수로 줄을 세운다. 참여자별 · 회차별을 다시 고르면 풀린다.
  const [likeSort, setLikeSort] = useState<{ section: RetroSection; dir: SortDir } | null>(null);
  const [page, setPage] = useState(1);
  // 가로 스크롤바를 표 위에도 둔다 — 스터디 표와 같다. 20줄이면 아래 스크롤바가 화면 밖이다.
  const scroll = useTopScroll();

  useEffect(() => {
    const ongoing = studies.filter((s) => s.status === 'ongoing');
    setAll(
      ongoing.flatMap((study) => {
        const studyTitle = t(study.title, 'ko');
        const group = scheduleAccessOf(study).group.name;
        return retroRowsOf(study).map((r) => ({ ...r, study, studyTitle, group }));
      }),
    );
  }, [studies]);

  // 이름 검색은 400ms 기다렸다가 — 다른 콘솔 목록과 같다
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [input]);

  const studyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of all ?? []) seen.set(r.studyId, r.studyTitle);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [all]);
  const meetingOptions = useMemo(() => {
    if (studyId === 'all') return [];
    const seen = new Map<string, string>();
    for (const r of all ?? []) if (r.studyId === studyId) seen.set(r.meetingId, r.meetingLabel);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [all, studyId]);

  const filtered = useMemo(() => {
    const rows = (all ?? []).filter(
      (r) =>
        (studyId === 'all' || r.studyId === studyId) &&
        (meetingId === 'all' || r.meetingId === meetingId) &&
        (!q || r.authorName.includes(q)),
    );
    return rows.sort((a, b) => {
      if (likeSort) {
        // 그 문항을 비운 회고(소감)는 방향과 상관없이 맨 뒤
        const la = a.retro?.[likeSort.section] ? a.retro.likes[likeSort.section] : -1;
        const lb = b.retro?.[likeSort.section] ? b.retro.likes[likeSort.section] : -1;
        if (la !== lb) {
          if (la < 0 || lb < 0) return lb - la;
          return likeSort.dir === 'desc' ? lb - la : la - lb;
        }
      }
      const byStudy = a.studyTitle.localeCompare(b.studyTitle, 'ko');
      if (byStudy) return byStudy;
      const byName = a.authorName.localeCompare(b.authorName, 'ko');
      const byMeeting = a.meetingNo - b.meetingNo;
      return sort === 'participant' ? byName || byMeeting : byMeeting || byName;
    });
  }, [all, studyId, meetingId, q, sort, likeSort]);

  // 표 · CSV 에는 쓴 회고만 — 안 쓴 사람은 줄로 보이지 않고 작성률로만 센다.
  const written = filtered.filter((r) => r.retro);
  const count = (s: RetroSection) => written.filter((r) => r.retro![s]).length;
  // 작성률은 기한이 지난 줄만 센다 — 기한 전 미작성은 아직 쓸 수 있어 빠진 게 아니다.
  const closed = filtered.filter((r) => r.closed);
  const closedWritten = closed.filter((r) => r.retro).length;
  const rate = closed.length ? Math.round((closedWritten / closed.length) * 100) : null;
  // 문항별 — 그 문항을 쓴 회고만. 최신순은 작성 시각, 공감순은 👍 (같으면 최신순)
  const recent = (a: Row, b: Row) => b.retro!.writtenAt.localeCompare(a.retro!.writtenAt);
  const opinions = written
    .filter((r) => r.retro![section])
    .sort((a, b) =>
      order === 'likes' ? b.retro!.likes[section] - a.retro!.likes[section] || recent(a, b) : recent(a, b),
    );
  const shown = view === 'question' ? opinions : written;
  const pageRows = written.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageOpinions = opinions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const download = () => {
    const url = URL.createObjectURL(new Blob([csvOf(written, zone)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = '회고.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sticky = 'sticky z-[1] bg-surface-raised';
  return (
    <div>
      <PageHeader
        title='회고 모아보기'
        action={
          <Button
            data-anno='retros:5'
            size='sm'
            variant='secondary'
            leadingIcon={<Download size={15} />}
            onClick={download}
            disabled={written.length === 0}
          >
            CSV 내려받기
          </Button>
        }
      />

      <div data-anno='retros:1' className='mb-3 flex flex-wrap items-center gap-2'>
        <FilterSelect
          label='전체 스터디'
          value={studyId}
          onChange={(v) => {
            setStudyId(v);
            setMeetingId('all');
            setPage(1);
          }}
          options={studyOptions}
        />
        {studyId !== 'all' && (
          <FilterSelect
            label='전체 회차'
            value={meetingId}
            onChange={(v) => {
              setMeetingId(v);
              setPage(1);
            }}
            options={meetingOptions}
          />
        )}
        <Input
          type='search'
          size='sm'
          aria-label='참여자 이름 검색'
          leadingIcon={<Search size={15} />}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='참여자 이름 검색'
          className='w-48'
        />
        <div data-anno='retros:6' className='ml-auto'>
          <Segmented<View>
            size='sm'
            value={view}
            onChange={(v) => {
              setView(v);
              setPage(1);
            }}
            options={[
              { value: 'question', label: '문항별' },
              { value: 'table', label: '표' },
            ]}
          />
        </div>
      </div>

      {/* 요약 한 줄 — 의견 목록이 첫 화면에 보이도록 카드 대신 줄로 */}
      <p data-anno='retros:2' className='tnum mb-4 type-body-sm text-fg-secondary'>
        작성률 <span className='font-semibold text-fg'>{rate === null ? '-' : `${rate}%`}</span>
        <span className='text-fg-muted'>
          {' '}
          ({rate === null ? '기한이 지난 회차가 아직 없어요' : `기한 지난 회고 ${closedWritten}/${closed.length} 작성`})
        </span>
      </p>

      <div className='mb-2 flex flex-wrap items-end justify-between gap-3'>
        {view === 'question' ? (
          <div className='flex flex-wrap items-center gap-2'>
            <div data-anno='retros:7'>
              <Segmented<RetroSection>
                size='sm'
                shape='pill'
                value={section}
                onChange={(v) => {
                  setSection(v);
                  setPage(1);
                }}
                options={PICK_ORDER.map((key) => ({
                  value: key,
                  label: `${RETRO_SECTIONS.find((x) => x.key === key)!.label} ${count(key)}`,
                }))}
              />
            </div>
            <div data-anno='retros:8'>
              <Segmented<Order>
                size='sm'
                value={order}
                onChange={(v) => {
                  setOrder(v);
                  setPage(1);
                }}
                options={[
                  { value: 'recent', label: '최신순' },
                  { value: 'likes', label: '공감순' },
                ]}
              />
            </div>
          </div>
        ) : (
          <div data-anno='retros:1-1'>
            <Segmented<Sort>
              size='sm'
              value={sort}
              onChange={(v) => {
                setSort(v);
                setLikeSort(null);
                setPage(1);
              }}
              options={[
                { value: 'participant', label: '참여자별' },
                { value: 'meeting', label: '회차별' },
              ]}
            />
          </div>
        )}
        {/* 좁힌 뒤의 건수 — 스터디 · 유저 표처럼 오른쪽 위. 무엇을 세는지 목록과 붙어 있어야 분명하다 */}
        <span data-anno='retros:4' className='tnum ml-auto type-body-sm text-fg-muted'>
          총 {shown.length}건
        </span>
      </div>

      {view === 'question' &&
        (all === null ? (
          <div className='card px-5 py-4'>
            <span className='block h-4 animate-pulse rounded bg-surface-2' />
          </div>
        ) : opinions.length === 0 ? (
          <p className='card py-12 text-center type-body-sm text-fg-muted'>조건에 맞는 의견이 없어요.</p>
        ) : (
          <div data-anno='retros:9'>
            <OpinionList rows={pageOpinions} section={section} zone={zone} />
          </div>
        ))}

      {view === 'table' && (
        <div className='card'>
          <div
            ref={scroll.topRef}
            onScroll={scroll.onTopScroll}
            aria-hidden='true'
            data-anno='retros:3-1'
            className='overflow-x-auto overflow-y-hidden border-b border-border'
          >
            <div style={{ width: scroll.width, height: 1 }} />
          </div>
          <div ref={scroll.bodyRef} onScroll={scroll.onBodyScroll} data-anno='retros:3' className='overflow-x-auto'>
            <table className='bo-table min-w-[105rem] table-fixed border-separate border-spacing-0'>
              <colgroup>
                <col className='w-[200px]' />
                <col className='w-[110px]' />
                <col className='w-[90px]' />
                <col className='w-[80px]' />
                <col className='w-[380px]' />
                <col className='w-[380px]' />
                <col className='w-[380px]' />
                <col className='w-[140px]' />
              </colgroup>
              <thead>
                <tr>
                  <th className={cx(sticky, 'left-0')}>스터디</th>
                  <th className={cx(sticky, 'left-[200px] shadow-[4px_0_6px_-4px_var(--color-border-strong)]')}>
                    참여자
                  </th>
                  <th>반</th>
                  <th>회차</th>
                  {RETRO_SECTIONS.map((s) => {
                    const active = likeSort?.section === s.key ? likeSort.dir : null;
                    return (
                      <th key={s.key} aria-sort={active ? (active === 'asc' ? 'ascending' : 'descending') : undefined}>
                        <SortLabel
                          label={s.label}
                          anno={s.key === 'good' ? 'retros:3-2' : undefined}
                          first='desc'
                          active={active}
                          onChange={(dir) => {
                            setLikeSort({ section: s.key, dir });
                            setPage(1);
                          }}
                        />
                      </th>
                    );
                  })}
                  <th>작성일</th>
                </tr>
              </thead>
              <tbody>
                {all === null &&
                  Array.from({ length: 6 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={8}>
                        <span className='block h-4 animate-pulse rounded bg-surface-2' />
                      </td>
                    </tr>
                  ))}
                {all !== null && written.length === 0 && (
                  <tr>
                    <td colSpan={8} className='py-12 text-center text-fg-muted'>
                      조건에 맞는 회고가 없어요.
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => (
                  <tr key={`${r.studyId}-${r.meetingId}-${r.authorId}`} className='align-top'>
                    <td className={cx(sticky, 'left-0')}>{r.studyTitle}</td>
                    <td
                      className={cx(
                        sticky,
                        'left-[200px] font-semibold shadow-[4px_0_6px_-4px_var(--color-border-strong)]',
                      )}
                    >
                      {r.authorName}
                    </td>
                    <td className='whitespace-nowrap'>{r.group}</td>
                    <td className='tnum whitespace-nowrap'>{r.meetingLabel}</td>
                    {RETRO_SECTIONS.map((s) => (
                      <td key={s.key}>
                        <AnswerCell row={r} section={s.key} />
                      </td>
                    ))}
                    <td className='tnum whitespace-nowrap text-fg-secondary'>
                      {r.retro ? shortDateTime(r.retro.writtenAt, zone, true) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {shown.length > PAGE_SIZE && (
        <div className='mt-4 flex justify-center'>
          <Pagination page={page} total={Math.ceil(shown.length / PAGE_SIZE)} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
