'use client';

import { TableCard } from '@/components/ui';
import { formatStamp } from '@/features/notifications/labels';
import type { ApiSiteNotice, SiteNoticeOrder, SiteNoticeSort } from '@/features/site-notices/types';

/**
 * 정렬하는 컬럼 머리 — 이름을 누른다. 처음 누르면 오름차순, 다시 누르면 내림차순.
 * 화살표를 그리지 않는다 — 열마다 작은 화살표 두 개가 서면 머리 줄이 어수선하다. 지금 정렬 중인 열은 이름이 강조색이다.
 */
function SortLabel({
  label,
  active,
  onChange,
}: {
  label: string;
  active: SiteNoticeOrder | null;
  onChange: (dir: SiteNoticeOrder) => void;
}) {
  let next: SiteNoticeOrder = 'asc';
  let nextLabel = '오름차순으로';
  if (active === 'asc') {
    next = 'desc';
    nextLabel = '내림차순으로';
  }
  let tone = '';
  if (active) tone = 'text-brand';
  return (
    <button
      type='button'
      onClick={() => onChange(next)}
      aria-label={`${label} ${nextLabel} 정렬`}
      className={`whitespace-nowrap rounded-sm text-left underline-offset-4 hover:underline ${tone}`}
    >
      {label}
    </button>
  );
}

export function SiteNoticesTable({
  rows,
  sort,
  order,
  searching,
  onSort,
  onOpen,
}: {
  rows: ApiSiteNotice[];
  sort: SiteNoticeSort;
  order: SiteNoticeOrder;
  /** 검색어가 걸려 있으면 빈 표의 문구가 다르다. */
  searching: boolean;
  onSort: (sort: SiteNoticeSort, order: SiteNoticeOrder) => void;
  onOpen: (noticeId: number) => void;
}) {
  function activeOf(key: SiteNoticeSort): SiteNoticeOrder | null {
    if (sort === key) return order;
    return null;
  }
  let emptyText = '등록된 공지가 없습니다.';
  if (searching) emptyText = '조건에 맞는 공지가 없습니다.';

  return (
    <TableCard>
      <thead>
        <tr>
          <th>
            <SortLabel label='제목' active={activeOf('title')} onChange={(d) => onSort('title', d)} />
          </th>
          <th className='whitespace-nowrap'>작성자</th>
          <th className='whitespace-nowrap'>
            <SortLabel label='게시일' active={activeOf('publishedAt')} onChange={(d) => onSort('publishedAt', d)} />
          </th>
          <th className='whitespace-nowrap'>
            <SortLabel label='마지막 수정' active={activeOf('updatedAt')} onChange={(d) => onSort('updatedAt', d)} />
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => (
          <tr key={n.noticeId}>
            <td className='min-w-[22rem] max-w-[34rem]'>
              {/* 제목을 누르면 편집 팝업 — 행에 삭제 버튼을 두지 않는다 */}
              <button
                type='button'
                onClick={() => onOpen(n.noticeId)}
                className='flex max-w-full items-center gap-1.5 text-left font-semibold underline-offset-4 hover:text-brand hover:underline'
              >
                <span className='truncate'>{n.title}</span>
              </button>
            </td>
            <td className='whitespace-nowrap text-fg-secondary'>{n.author}</td>
            <td className='tnum whitespace-nowrap text-fg-secondary'>{formatStamp(n.publishedAt)}</td>
            <td className='tnum whitespace-nowrap text-fg-secondary'>{formatStamp(n.updatedAt)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className='text-center text-fg-muted'>
              {emptyText}
            </td>
          </tr>
        )}
      </tbody>
    </TableCard>
  );
}
