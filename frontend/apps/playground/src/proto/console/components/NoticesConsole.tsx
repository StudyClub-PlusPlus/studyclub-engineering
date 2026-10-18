'use client';

import { useMemo, useState } from 'react';

import { NoticeDialog } from '@console/components/NoticeDialog';
import type { NoticeFormValues } from '@console/components/NoticeForm';
import { PageHeader } from '@console/components/ui';
import { getUser } from '@console/lib/auth';
import { seedNotices, type Notice } from '@console/lib/notices';
import { todayISO } from '@studyclub/mock';
import { Button, Pagination } from '@studyclub/ui';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';

/**
 * 공지 관리 — **스터디 관리 목록과 같은 모양**이다. 두 화면을 오가는 운영자가 다른 규칙을 외우지 않게.
 *
 * - 헤더 오른쪽 「공지 등록」 → 팝업. **공개 단계가 없다** — 등록하면 곧 사이트에 올라간다
 * - 칼럼은 제목 · 작성자 · 게시일 · 마지막 수정. 작성자는 이 콘솔에만 보인다
 * - 제목을 누르면 편집 팝업. 삭제도 그 안에서 한다(소프트 삭제)
 * - 거르는 칸은 제목 검색. 20개씩 페이지
 */

type SortKey = 'title' | 'postedAt' | 'updatedAt';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 20;

function SortArrows({
  label,
  active,
  onChange,
}: {
  label: string;
  active: SortDir | null;
  onChange: (dir: SortDir | null) => void;
}) {
  const arrow = (dir: SortDir, Icon: typeof ChevronUp, name: string) => (
    <button
      type='button'
      aria-label={`${label} ${name} 정렬`}
      aria-pressed={active === dir}
      onClick={() => onChange(active === dir ? null : dir)}
      className={`rounded-sm p-0 leading-none ${active === dir ? 'text-brand' : 'text-fg-placeholder hover:text-fg-secondary'}`}
    >
      <Icon size={11} strokeWidth={2.5} />
    </button>
  );
  return (
    <span className='inline-flex flex-col'>
      {arrow('asc', ChevronUp, '오름차순')}
      {arrow('desc', ChevronDown, '내림차순')}
    </span>
  );
}

export function NoticesConsole() {
  const [rows, setRows] = useState<Notice[]>(seedNotices);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [page, setPage] = useState(1);
  /** null = 닫힘, 'new' = 등록, id = 그 공지 편집 */
  const [target, setTarget] = useState<'new' | string | null>(null);

  const editing = target && target !== 'new' ? rows.find((r) => r.id === target) : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((n) => {
        if (q && !n.title.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort) {
          const av = a[sort.key] ?? '';
          const bv = b[sort.key] ?? '';
          const c = av.localeCompare(bv, 'ko');
          if (c !== 0) return sort.dir === 'asc' ? c : -c;
        }
        // 기본: 최근에 올린 것부터 — 사이트 공지 목록과 같은 순서
        return b.postedAt.localeCompare(a.postedAt);
      });
  }, [rows, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function applySort(key: SortKey, dir: SortDir | null) {
    setSort(dir ? { key, dir } : null);
    setPage(1);
  }

  function save(values: NoticeFormValues) {
    const today = todayISO();
    const fields = { title: values.title.trim(), body: values.body };
    if (editing) {
      setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...fields, updatedAt: today } : r)));
    } else {
      // 작성자는 로그인한 캡틴 — TODO(api): 서버가 토큰에서 정한다
      const author = getUser()?.nickname ?? '나';
      setRows((prev) => [{ id: `notice-${Date.now()}`, ...fields, author, postedAt: today, updatedAt: today }, ...prev]);
    }
  }

  function remove(id: string) {
    // 소프트 삭제 — 화면에서는 빠지고, 서버에는 DELETED_AT 만 찍힌다
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      <PageHeader
        title='공지 관리'
        action={
          <Button data-anno='notice:2' size='sm' leadingIcon={<Plus size={15} />} onClick={() => setTarget('new')}>
            공지 등록
          </Button>
        }
      />

      <div data-anno='notice:1' className='mb-3 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder='제목 검색'
          className='h-9 w-44 shrink-0 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        <span className='ml-auto shrink-0 pl-2 text-xs text-fg-muted'>{filtered.length}개</span>
      </div>

      <div data-anno='notice:3' className='card overflow-x-auto'>
        <table className='bo-table'>
          <thead>
            <tr>
              <th>
                <span className='inline-flex items-center gap-1'>
                  제목
                  <SortArrows
                    label='제목'
                    active={sort?.key === 'title' ? sort.dir : null}
                    onChange={(d) => applySort('title', d)}
                  />
                </span>
              </th>
              <th className='whitespace-nowrap'>작성자</th>
              <th className='whitespace-nowrap'>
                <span className='inline-flex items-center gap-1'>
                  게시일
                  <SortArrows
                    label='게시일'
                    active={sort?.key === 'postedAt' ? sort.dir : null}
                    onChange={(d) => applySort('postedAt', d)}
                  />
                </span>
              </th>
              <th className='whitespace-nowrap'>
                <span className='inline-flex items-center gap-1'>
                  마지막 수정
                  <SortArrows
                    label='마지막 수정'
                    active={sort?.key === 'updatedAt' ? sort.dir : null}
                    onChange={(d) => applySort('updatedAt', d)}
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((n) => (
              <tr key={n.id}>
                <td className='min-w-[22rem] max-w-[34rem]'>
                  <button
                    type='button'
                    onClick={() => setTarget(n.id)}
                    className='flex max-w-full items-center gap-1.5 text-left font-semibold underline-offset-4 hover:text-brand hover:underline'
                  >
                    <span className='truncate'>{n.title}</span>
                  </button>
                </td>
                <td data-anno='notice:4' className='whitespace-nowrap text-fg-secondary'>{n.author}</td>
                <td className='tnum whitespace-nowrap text-fg-secondary'>{n.postedAt}</td>
                <td className='tnum whitespace-nowrap text-fg-secondary'>{n.updatedAt}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={4} className='text-center text-fg-muted'>
                  {rows.length === 0 ? '등록된 공지가 없습니다.' : '조건에 맞는 공지가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination className='mt-4' page={current} total={pageCount} onChange={setPage} />

      <NoticeDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        notice={editing}
        onSave={save}
        onDelete={remove}
      />

    </div>
  );
}
