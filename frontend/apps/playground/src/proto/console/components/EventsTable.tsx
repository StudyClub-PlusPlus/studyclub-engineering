'use client';

import { useMemo, useState } from 'react';


import { EventDialog } from '@console/components/EventDialog';
import { EVENT_TYPES } from '@console/components/EventForm';
import { TableCard } from '@console/components/ui';
import { tx, EVENT_TYPE_LABEL } from '@console/lib/l10n';
import type { StudyclubEvent } from '@studyclub/mock';
import { Badge } from '@studyclub/ui';

/**
 * 행사 관리 목록 — 스터디 목록과 같은 규칙.
 *
 * - 필터는 한 줄, 전부 같은 셀렉트. 기본값 라벨에 축 이름을 넣어 라벨 없이도 무엇을 거르는지 보인다
 * - 행에 편집·삭제 버튼을 두지 않는다. 행사명을 누르면 등록 때와 **같은 팝업**이 열리고 삭제도 그 안에 있다
 * - 예정된 행사가 위 — 운영자가 손대야 할 것부터 보인다
 */

const TODAY = new Date().toISOString().slice(0, 10);

const TYPE_OPTIONS = [
  { value: 'all', label: '타입 전체' },
  ...EVENT_TYPES.map((t) => ({ value: t as string, label: EVENT_TYPE_LABEL[t] })),
];

type WhenFilter = 'all' | 'upcoming' | 'past';

const WHEN_OPTIONS: { value: WhenFilter; label: string }[] = [
  { value: 'all', label: '시점 전체' },
  { value: 'upcoming', label: '예정' },
  { value: 'past', label: '종료' },
];

/** 필터 셀렉트 — 스터디 목록과 같은 생김새. */
function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`h-9 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg'
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function EventsTable({ events }: { events: StudyclubEvent[] }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [when, setWhen] = useState<WhenFilter>('all');
  const [editing, setEditing] = useState<StudyclubEvent | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      events
        .filter((e) => {
          if (type !== 'all' && e.type !== type) return false;
          if (when === 'upcoming' && e.date < TODAY) return false;
          if (when === 'past' && e.date >= TODAY) return false;
          if (q && !`${tx(e.title)} ${tx(e.summary)}`.toLowerCase().includes(q)) return false;
          return true;
        })
        // 예정된 행사가 먼저(가까운 순), 그 뒤에 종료된 행사(최근 순)
        .sort((a, b) => {
          const ua = a.date >= TODAY ? 0 : 1;
          const ub = b.date >= TODAY ? 0 : 1;
          if (ua !== ub) return ua - ub;
          return ua === 0 ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
        })
    );
  }, [events, query, type, when]);

  return (
    <div>
      <div className='mb-5 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='행사명 · 한 줄 소개 검색'
          className='h-9 w-56 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        <FilterSelect value={type} onChange={setType} options={TYPE_OPTIONS} />
        <FilterSelect value={when} onChange={setWhen} options={WHEN_OPTIONS} />
        <span className='ml-auto text-xs text-fg-muted'>{rows.length}개</span>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>행사</th>
            <th className='whitespace-nowrap'>타입</th>
            <th className='whitespace-nowrap'>날짜</th>
            <th className='whitespace-nowrap'>장소</th>
            <th className='whitespace-nowrap'>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const upcoming = e.date >= TODAY;
            return (
              <tr key={e.id}>
                <td className='w-[42%] max-w-0'>
                  <button
                    type='button'
                    onClick={() => setEditing(e)}
                    className='block w-full truncate text-left font-semibold underline-offset-4 hover:text-brand hover:underline'
                  >
                    {tx(e.title)}
                  </button>
                </td>
                <td className='whitespace-nowrap text-fg-secondary'>{EVENT_TYPE_LABEL[e.type] ?? e.type}</td>
                <td className='tnum whitespace-nowrap text-fg-secondary'>{e.date}</td>
                <td className='whitespace-nowrap text-fg-secondary'>{e.location ? tx(e.location) : '온라인'}</td>
                <td>
                  <Badge tone={upcoming ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
                    {upcoming ? '예정' : '종료'}
                  </Badge>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className='text-center text-fg-muted'>
                조건에 맞는 행사가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>

      <EventDialog open={editing !== null} event={editing ?? undefined} onClose={() => setEditing(null)} />
    </div>
  );
}
