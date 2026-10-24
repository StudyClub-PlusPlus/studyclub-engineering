'use client';

import { useState } from 'react';

import { Button, cx } from '@studyclub/ui';


import { discordResultLabel, mailResultLabel } from '../model';
import { useNotices } from '../queries';
import type { ApiNoticeItem } from '@/lib/study-notice-api';

const PAGE = 20;

/** 보는 사람의 시간대로 「월/일 시:분」. */
const when = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * 보낸 공지 기록. 보낸 네비게이터·캡틴만 본다. 읽기 실패를 「0건」으로 보여 주지 않는다 (POL-0008).
 * 「완료」는 메일을 보냈다는 뜻이지 받았다는 뜻이 아니다 (POL-0009).
 */
export function NoticeHistory({ studyId, groupId }: { studyId: number; groupId: number }) {
  const [limit, setLimit] = useState(PAGE);
  const query = useNotices(studyId, groupId, limit);
  const [open, setOpen] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className='card p-5 sm:p-6'>
      <h2 className='text-base font-bold text-fg'>보낸 공지</h2>

      {query.isPending && <p className='py-10 text-center text-sm text-fg-muted'>불러오는 중…</p>}

      {query.isError && (
        <div className='py-10 text-center'>
          <p className='text-sm text-fg-muted'>보낸 공지를 불러오지 못했습니다. 다시 시도해 주세요.</p>
          <Button className='mt-3' size='sm' variant='secondary' onClick={() => query.refetch()}>
            다시 시도
          </Button>
        </div>
      )}

      {query.data && query.data.items.length === 0 && (
        <p className='py-10 text-center text-sm text-fg-muted'>아직 보낸 공지가 없습니다.</p>
      )}

      {query.data && query.data.items.length > 0 && (
        <>
          <ul className='mt-3 divide-y divide-border'>
            {query.data.items.map((n) => (
              <NoticeRow key={n.noticeId} notice={n} expanded={open.has(n.noticeId)} onToggle={() => toggle(n.noticeId)} />
            ))}
          </ul>
          {query.data.total > query.data.items.length && (
            <div className='mt-3 text-center'>
              <Button variant='secondary' size='sm' onClick={() => setLimit((l) => l + PAGE)}>
                더 보기
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function NoticeRow({ notice: n, expanded, onToggle }: { notice: ApiNoticeItem; expanded: boolean; onToggle: () => void }) {
  const mail = mailResultLabel(n.email);
  const discord = discordResultLabel(n.discord);
  const long = n.body.split('\n').length > 3 || n.body.length > 120;
  return (
    <li className='py-4'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <p className='font-semibold text-fg'>{n.title}</p>
        <p className='text-xs text-fg-muted'>
          {n.senderName} · {when(n.sentAt)} · {n.recipientCount}명
        </p>
      </div>
      <p className={cx('mt-1 whitespace-pre-line text-sm text-fg-secondary', !expanded && 'line-clamp-3')}>{n.body}</p>
      {long && (
        <button type='button' className='mt-1 text-xs font-semibold text-brand hover:underline' onClick={onToggle}>
          {expanded ? '접기' : '모두 보기'}
        </button>
      )}
      <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted'>
        {mail && <span>{mail}</span>}
        {discord && <span>{discord}</span>}
      </div>
    </li>
  );
}
