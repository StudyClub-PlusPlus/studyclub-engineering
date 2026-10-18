'use client';

import { useMemo, useState } from 'react';

import { NoticeDialog } from '@console/components/NoticeDialog';
import type { NoticeFormValues } from '@console/components/NoticeForm';
import { PageHeader } from '@console/components/ui';
import { NOTICE_TAGS, NOTICE_TAG_LABEL, seedNotices, type Notice, type NoticeTag } from '@console/lib/notices';
import { todayISO } from '@studyclub/mock';
import { Button, Modal, Pagination } from '@studyclub/ui';
import { ChevronDown, ChevronUp, Pin, Plus } from 'lucide-react';

/**
 * 공지 관리 — **스터디 관리 목록과 같은 모양**이다. 두 화면을 오가는 운영자가 다른 규칙을 외우지 않게.
 *
 * - 헤더 오른쪽 「공지 등록」 → 팝업. 등록은 늘 미공개로 끝난다
 * - 공개는 **목록의 공개 칸에서** 확인을 거쳐 켠다. 켜는 날이 발행일이다. 예약 공개는 두지 않는다
 * - 칼럼은 등록 폼에 있는 항목과 공개 상태로만 짠다. 제목을 누르면 편집 팝업
 * - 거르는 칸은 제목 검색 · 분류 · 공개. 20개씩 페이지
 */

type PublishFilter = 'all' | 'live' | 'draft';
type SortKey = 'title' | 'publishedAt' | 'updatedAt';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 20;

const PUBLISH_OPTIONS: { value: PublishFilter; label: string }[] = [
  { value: 'live', label: '공개' },
  { value: 'draft', label: '미공개' },
];

/** 거르는 칸 — 고르기 전에는 축 이름만, 고르면 첫 줄이 「전체」 (POL-0008, 스터디 목록과 같다). */
function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | 'all';
  onChange: (v: T | 'all') => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T | 'all')}
      className={`h-9 shrink-0 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg'
      }`}
    >
      <option value='all'>{value === 'all' ? label : '전체'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

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
  const [tag, setTag] = useState<NoticeTag | 'all'>('all');
  const [publish, setPublish] = useState<PublishFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [page, setPage] = useState(1);
  /** null = 닫힘, 'new' = 등록, id = 그 공지 편집 */
  const [target, setTarget] = useState<'new' | string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; title: string; next: boolean } | null>(null);

  const editing = target && target !== 'new' ? rows.find((r) => r.id === target) : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((n) => {
        if (tag !== 'all' && n.tag !== tag) return false;
        if (publish === 'live' && !n.publishedAt) return false;
        if (publish === 'draft' && n.publishedAt) return false;
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
        // 기본: 손댈 것부터 — 미공개(작성 중) 먼저, 그 안에서 최근 수정 순
        const da = a.publishedAt ? 1 : 0;
        const db = b.publishedAt ? 1 : 0;
        if (da !== db) return da - db;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [rows, query, tag, publish, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function applySort(key: SortKey, dir: SortDir | null) {
    setSort(dir ? { key, dir } : null);
    setPage(1);
  }

  function save(values: NoticeFormValues) {
    const today = todayISO();
    const fields = { tag: values.tag as NoticeTag, title: values.title.trim(), body: values.body, pinned: values.pinned };
    if (editing) {
      setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...fields, updatedAt: today } : r)));
    } else {
      setRows((prev) => [{ id: `notice-${Date.now()}`, ...fields, updatedAt: today }, ...prev]);
    }
  }

  function applyPublish() {
    if (!confirm) return;
    // 켜는 날이 발행일이다. 내리면 발행일이 사라진다(= 미공개).
    // TODO(api): 공개 전환 API
    setRows((prev) =>
      prev.map((r) => (r.id === confirm.id ? { ...r, publishedAt: confirm.next ? todayISO() : undefined } : r)),
    );
    setConfirm(null);
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
        <FilterSelect
          label='분류'
          value={tag}
          onChange={(v) => {
            setTag(v);
            setPage(1);
          }}
          options={NOTICE_TAGS}
        />
        <FilterSelect
          label='공개'
          value={publish}
          onChange={(v) => {
            setPublish(v as PublishFilter);
            setPage(1);
          }}
          options={PUBLISH_OPTIONS}
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
              <th className='whitespace-nowrap'>분류</th>
              <th className='whitespace-nowrap'>공개</th>
              <th className='whitespace-nowrap'>
                <span className='inline-flex items-center gap-1'>
                  발행일
                  <SortArrows
                    label='발행일'
                    active={sort?.key === 'publishedAt' ? sort.dir : null}
                    onChange={(d) => applySort('publishedAt', d)}
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
                    {/* 고정은 칼럼을 따로 두지 않고 제목 앞 핀 — 사이트 목록과 같은 표시 */}
                    {n.pinned && <Pin size={13} className='shrink-0 text-brand' aria-label='고정' />}
                    <span className='truncate'>{n.title}</span>
                  </button>
                </td>
                <td className='whitespace-nowrap text-fg-secondary'>{NOTICE_TAG_LABEL[n.tag] ?? n.tag}</td>
                <td data-anno='notice:4'>
                  <PublishCell
                    live={Boolean(n.publishedAt)}
                    onToggle={(next) => setConfirm({ id: n.id, title: n.title, next })}
                  />
                </td>
                <td className='tnum whitespace-nowrap text-fg-secondary'>
                  {n.publishedAt ?? <span className='text-fg-muted'>—</span>}
                </td>
                <td className='tnum whitespace-nowrap text-fg-secondary'>{n.updatedAt}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className='text-center text-fg-muted'>
                  {rows.length === 0 ? '등록된 공지가 없습니다.' : '조건에 맞는 공지가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination className='mt-4' page={current} total={pageCount} onChange={setPage} />

      <NoticeDialog open={target !== null} onClose={() => setTarget(null)} notice={editing} onSave={save} />

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.next ? '공지 공개' : '공지 비공개'}
        footer={
          <>
            {/* 결정을 묻는 모달 — 안전한 쪽이 기본 포커스 (POL-0008) */}
            <Button variant='secondary' data-autofocus onClick={() => setConfirm(null)}>
              취소
            </Button>
            <Button onClick={applyPublish}>{confirm?.next ? '공개' : '비공개로 전환'}</Button>
          </>
        }
      >
        <div data-anno='notice:4-1' className='py-6 text-center'>
          <p className='text-sm font-semibold text-fg'>
            ‘{confirm?.title}’ {confirm?.next ? '공지를 공개하시겠습니까?' : '공지를 비공개로 전환하시겠습니까?'}
          </p>
          <p className='mt-1.5 text-sm text-fg-muted'>
            {confirm?.next
              ? '공개하면 오늘이 발행일이 되고, 사용자 사이트 공지에 바로 노출됩니다.'
              : '사용자 사이트에서 내려갑니다. 다시 공개하면 그날이 새 발행일이 됩니다.'}
          </p>
        </div>
      </Modal>
    </div>
  );
}

/** 공개 칸 — 누르면 바로 바뀌지 않고 확인이 먼저 뜬다. 스터디 목록의 공개 칸과 같은 모양. */
function PublishCell({ live, onToggle }: { live: boolean; onToggle: (next: boolean) => void }) {
  return (
    <button
      type='button'
      onClick={() => onToggle(!live)}
      title={live ? '눌러서 내린다' : '눌러서 공개한다'}
      className={`rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors ${
        live
          ? 'bg-success-50 text-success-700 hover:bg-success-100'
          : 'bg-surface-2 text-fg-secondary hover:bg-neutral-200'
      }`}
    >
      {live ? '공개' : '미공개'}
    </button>
  );
}
