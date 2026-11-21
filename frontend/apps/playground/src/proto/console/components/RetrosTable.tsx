'use client';

import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@console/components/ui';
import { useTopScroll } from '@console/lib/use-top-scroll';
import { t } from '@core/lib/i18n';
import { scheduleAccessOf } from '@core/lib/meetings';
import { RETRO_SECTIONS, retroRowsOf, shortDateTime, type RetroRow, type RetroSection } from '@core/lib/retros';
import type { Study } from '@studyclub/types';
import { Button, Input, Pagination, Segmented, Select, cx } from '@studyclub/ui';
import { Download, Search, ThumbsUp } from 'lucide-react';

import { useMswStudies } from '@/proto/lib/use-msw-studies';

/**
 * 회고 모아보기 — 진행 중인 스터디의 끝난 회차마다 참여자가 남긴 회고를 한 표로 본다. 열람 전용.
 *
 * 스터디 · 회차 · 이름으로 좁히고, 참여자별(한 사람의 회차를 이어서) · 회차별(한 회차의 사람을 이어서)로 줄을 세운다.
 * 문항 칸은 줄이지 않고 전문을 보이며, 표가 넓어 가로로 민다. 스터디 · 참여자 열은 밀어도 남는다.
 * TODO(api): GET /api/admin/retros?studyId&meetingId&q&sort&offset&limit — 캡틴 전용
 *            GET /api/admin/retros/export.csv — 같은 조건
 */
const PAGE_SIZE = 20;

type Sort = 'participant' | 'meeting';
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

function csvOf(rows: Row[]): string {
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
    r.retro ? shortDateTime(r.retro.writtenAt) : '',
  ]);
  return '﻿' + [head, ...body].map((line) => line.map(esc).join(',')).join('\n');
}

export function RetrosTable() {
  const studies = useMswStudies();
  const [all, setAll] = useState<Row[] | null>(null);
  const [studyId, setStudyId] = useState('all');
  const [meetingId, setMeetingId] = useState('all');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('participant');
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
      const byStudy = a.studyTitle.localeCompare(b.studyTitle, 'ko');
      if (byStudy) return byStudy;
      const byName = a.authorName.localeCompare(b.authorName, 'ko');
      const byMeeting = a.meetingNo - b.meetingNo;
      return sort === 'participant' ? byName || byMeeting : byMeeting || byName;
    });
  }, [all, studyId, meetingId, q, sort]);

  // 표 · CSV 에는 쓴 회고만 — 안 쓴 사람은 줄로 보이지 않고 작성률로만 센다.
  const written = filtered.filter((r) => r.retro);
  const count = (s: RetroSection) => written.filter((r) => r.retro![s]).length;
  // 작성률은 기한이 지난 줄만 센다 — 기한 전 미작성은 아직 쓸 수 있어 빠진 게 아니다.
  const closed = filtered.filter((r) => r.closed);
  const closedWritten = closed.filter((r) => r.retro).length;
  const rate = closed.length ? Math.round((closedWritten / closed.length) * 100) : null;
  const pageRows = written.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const download = () => {
    const url = URL.createObjectURL(new Blob([csvOf(written)], { type: 'text/csv;charset=utf-8' }));
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
        <div data-anno='retros:1-1' className='ml-auto'>
          <Segmented<Sort>
            size='sm'
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            options={[
              { value: 'participant', label: '참여자별' },
              { value: 'meeting', label: '회차별' },
            ]}
          />
        </div>
      </div>

      <div data-anno='retros:2' className='mb-3 grid grid-cols-2 gap-3 md:grid-cols-4'>
        <div className='card px-4 py-3'>
          <p className='type-label-sm text-fg-muted'>작성률</p>
          <p className='tnum mt-1 type-headline-md'>{rate === null ? '-' : `${rate}%`}</p>
          <p className='tnum type-label-sm text-fg-muted'>
            {rate === null
              ? '기한이 지난 회차가 아직 없어요'
              : `기한 지난 회고 ${closedWritten}/${closed.length} 작성`}
          </p>
        </div>
        {RETRO_SECTIONS.map((s) => (
          <div key={s.key} className='card px-4 py-3'>
            <p className='type-label-sm text-fg-muted'>{s.label}</p>
            <p className='tnum mt-1 type-headline-md'>{count(s.key)}건</p>
          </div>
        ))}
      </div>

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
              <col className='w-[110px]' />
            </colgroup>
            <thead>
              <tr>
                <th className={cx(sticky, 'left-0')}>스터디</th>
                <th className={cx(sticky, 'left-[200px] shadow-[4px_0_6px_-4px_var(--color-border-strong)]')}>
                  참여자
                </th>
                <th>반</th>
                <th>회차</th>
                {RETRO_SECTIONS.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
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
                    {r.retro ? shortDateTime(r.retro.writtenAt) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div data-anno='retros:4' className='mt-3 flex items-center justify-end gap-3'>
        <span className='tnum type-label-sm text-fg-muted'>총 {written.length}건</span>
      </div>
      {written.length > PAGE_SIZE && (
        <div className='mt-4 flex justify-center'>
          <Pagination page={page} total={Math.ceil(written.length / PAGE_SIZE)} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
