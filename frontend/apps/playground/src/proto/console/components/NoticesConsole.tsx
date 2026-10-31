'use client';

import { useMemo, useState } from 'react';

import { NoticeDialog } from '@console/components/NoticeDialog';
import type { NoticeFormValues } from '@console/components/NoticeForm';
import { PageHeader } from '@console/components/ui';
import { getUser } from '@console/lib/auth';
import { seedNotices, type Notice } from '@console/lib/notices';
import { Button, Pagination } from '@studyclub/ui';
import { todayISO } from '@studyclub/utils';
import { Plus } from 'lucide-react';

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

/**
 * 정렬하는 컬럼 머리 — **이름을 누른다.** 처음 누르면 오름차순, 다시 누르면 내림차순, 또 누르면 오름차순.
 * 화살표를 그리지 않는다 — 열마다 작은 화살표 두 개가 서면 머리 줄이 어수선하다.
 * 지금 정렬 중인 열은 이름이 강조색이다.
 */
function SortLabel({
  label,
  active,
  onChange,
  anno,
}: {
  label: string;
  active: SortDir | null;
  onChange: (dir: SortDir) => void;
  anno?: string;
}) {
  return (
    <button
      type='button'
      data-anno={anno}
      onClick={() => onChange(active === 'asc' ? 'desc' : 'asc')}
      aria-label={`${label} ${active === 'asc' ? '내림차순으로' : '오름차순으로'} 정렬`}
      className={`whitespace-nowrap rounded-sm text-left underline-offset-4 hover:underline ${active ? 'text-brand' : ''}`}
    >
      {label}
    </button>
  );
}

export function NoticesConsole() {
  const [rows, setRows] = useState<Notice[]>(seedNotices);
  const [query, setQuery] = useState('');
  // 기본 순서도 한 열의 정렬이다 — 게시일 내림차순(최근 게시 먼저). 처음부터 그 열이 강조된다.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'postedAt', dir: 'desc' });
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

  function applySort(key: SortKey, dir: SortDir) {
    setSort({ key, dir });
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
          className='h-9 w-44 shrink-0 rounded-control border border-border-strong bg-surface px-3 type-body-sm outline-none focus:border-brand'
        />
        <span className='ml-auto shrink-0 pl-2 type-label-sm text-fg-muted'>{filtered.length}개</span>
      </div>

      <div data-anno='notice:3' className='card overflow-x-auto'>
        <table className='bo-table'>
          <thead>
            <tr>
              <th>
                <SortLabel label='제목' active={sort?.key === 'title' ? sort.dir : null} onChange={(d) => applySort('title', d)} />
              </th>
              <th className='whitespace-nowrap'>작성자</th>
              <th className='whitespace-nowrap'>
                <SortLabel label='게시일' active={sort?.key === 'postedAt' ? sort.dir : null} onChange={(d) => applySort('postedAt', d)} />
              </th>
              <th className='whitespace-nowrap'>
                <SortLabel label='마지막 수정' active={sort?.key === 'updatedAt' ? sort.dir : null} onChange={(d) => applySort('updatedAt', d)} />
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
