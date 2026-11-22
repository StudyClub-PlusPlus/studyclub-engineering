'use client';

import { useEffect, useState } from 'react';

import { Modal, Pagination } from '@studyclub/ui';

import { formatInstant } from '@/features/events/format';
import { useEventMail, useEventMails } from '@/features/events/queries';
import { MAIL_AUDIENCE_LABEL } from '@/features/events/types';
import { toPreviewDocument } from '@/features/notification-templates/preview-document';
import { useDisplayTimeZone } from '@/lib/use-display-timezone';

/** 메일 이력 탭: 운영자가 안내 메일 보내기로 만든 발송만. 받는 주소는 서버가 가린 값이고 펼쳐 보는 기능이 없다. */
export function MailHistoryTab({
  eventId,
  timeZone,
  page,
  onPage,
}: {
  eventId: number;
  /** 생략하면 운영자 프로필 시간대 */
  timeZone?: string;
  page: number;
  onPage: (page: number) => void;
}) {
  const profileZone = useDisplayTimeZone();
  const zone = timeZone ?? profileZone;
  const list = useEventMails(eventId, page);
  const [openId, setOpenId] = useState<number | null>(null);
  const detail = useEventMail(eventId, openId);
  const data = list.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  useEffect(() => {
    if (data && !list.isPlaceholderData && data.items.length === 0 && data.offset >= data.total && page > 1) onPage(pageCount);
  }, [data, list.isPlaceholderData, page, pageCount, onPage]);

  return (
    <section className='flex flex-col gap-3'>
      <p className='type-body-sm text-fg-muted'>운영자가 안내 메일 보내기로 작성한 메일만 표시됩니다.</p>
      {list.error && (
        <p role='alert' className='type-body-sm text-danger-fg'>
          {list.error.message}
        </p>
      )}
      {list.isPending && !list.error && <p className='py-6 text-center type-body-sm text-fg-muted'>불러오는 중…</p>}
      {data && data.items.length === 0 && (
        <div className='card p-8 text-center type-body-sm text-fg-muted'>아직 보낸 안내 메일이 없습니다.</div>
      )}
      {data?.items.map((mail) => (
        <button
          // ui-native: 발송 메일 카드, 카드 전체가 누르는 곳
          type='button'
          key={mail.mailId}
          onClick={() => setOpenId(mail.mailId)}
          className='card flex w-full items-center justify-between gap-4 p-4 text-left hover:border-brand'
        >
          <span className='min-w-0'>
            <span className='block type-label-lg'>{mail.subject}</span>
            <span className='mt-1 flex flex-wrap gap-x-3 gap-y-1 type-label-sm text-fg-muted'>
              <span>
                {MAIL_AUDIENCE_LABEL[mail.audience]} · {mail.recipientCount}명
              </span>
              <span>{formatInstant(mail.createdAt, zone)}</span>
            </span>
          </span>
          <span className='shrink-0 type-label-sm text-brand'>내용 보기</span>
        </button>
      ))}
      {data && data.total > data.limit && <Pagination page={page} total={pageCount} onChange={onPage} />}

      <Modal open={openId !== null} onClose={() => setOpenId(null)} title='메일 미리보기' size='lg'>
        {detail.error && (
          <p role='alert' className='type-body-sm text-danger-fg'>
            {detail.error.message}
          </p>
        )}
        {detail.isPending && !detail.error && <p className='type-body-sm text-fg-muted'>불러오는 중…</p>}
        {detail.data && (
          <div className='flex flex-col gap-4'>
            <p className='type-label-lg'>{detail.data.subject}</p>
            <p className='type-body-sm'>{MAIL_AUDIENCE_LABEL[detail.data.audience]}</p>
            <details className='rounded-card border border-border p-3 type-body-sm'>
              <summary tabIndex={0} className='cursor-pointer type-label-sm text-fg-muted'>
                받는 사람 {detail.data.recipientCount}명 보기
              </summary>
              <ul className='mt-3 flex flex-col gap-1 break-all text-fg-muted'>
                {detail.data.maskedRecipients.map((email, index) => (
                  <li key={`${email}-${index}`}>{email}</li>
                ))}
              </ul>
            </details>
            <iframe
              title='발송 메일 본문'
              sandbox=''
              srcDoc={toPreviewDocument(detail.data.body)}
              className='h-96 w-full rounded-card border border-border bg-bg sm:h-128'
            />
          </div>
        )}
      </Modal>
    </section>
  );
}
