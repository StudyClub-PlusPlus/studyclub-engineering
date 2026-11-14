'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Modal } from '@studyclub/ui';

import { useEventWorkspace } from './EventWorkspace';

export function EventPreviewBar({ eventId }: { eventId?: string }) {
  const { reset, warning } = useEventWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className='mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 type-label-sm text-fg-muted'>
        <span className='mr-auto'>행사 시안 · 예시 데이터 · 실제 메일 발송 없음</span>
        <Link
          className='font-semibold text-brand hover:underline'
          href={`/proto/core/ko/events${eventId ? `/${eventId}` : ''}`}
        >
          참가자 화면
        </Link>
        <Link
          className='font-semibold text-brand hover:underline'
          href={`/proto/console/events${eventId ? `/${eventId}` : ''}`}
        >
          운영진 화면
        </Link>
        <Button size='sm' variant='tertiary' onClick={() => setOpen(true)}>
          예시 초기화
        </Button>
      </div>
      {warning && (
        <p role='alert' className='mb-4 type-body-sm text-danger-fg'>
          {warning}
        </p>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title='행사 예시를 초기화할까요?'
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setOpen(false)}>
              유지하기
            </Button>
            <Button
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              초기화
            </Button>
          </>
        }
      >
        <p className='type-body-md'>이 브라우저에서 작성한 행사, 신청 내역과 메일 예시가 기본 예시로 돌아갑니다.</p>
      </Modal>
    </>
  );
}
