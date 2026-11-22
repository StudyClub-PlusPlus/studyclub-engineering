'use client';

import { useRouter } from 'next/navigation';

import { Modal } from '@studyclub/ui';

import { EventEditor } from '@/features/events/EventEditor';
import { isUnknownOutcome, useCreateEvent, useIdempotencyKey } from '@/features/events/queries';
import type { EventPayload } from '@/features/events/types';

/** 행사 등록. 저장하면 바로 크루 행사 목록에 공개되고 상세로 이동한다. */
export function EventCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const create = useCreateEvent();
  const idempotency = useIdempotencyKey();

  function submit(payload: EventPayload) {
    create.mutate(
      { payload, key: idempotency.current(JSON.stringify(payload)) },
      {
        onSuccess: (detail) => {
          idempotency.clear();
          onClose();
          router.push(`/events/${detail.eventId}`);
        },
        // 응답을 못 받았으면 같은 키로 다시 보낸다. 서버가 거절한 요청은 새 시도다
        onError: (error) => {
          if (!isUnknownOutcome(error)) idempotency.clear();
        },
      },
    );
  }

  function close() {
    create.reset();
    idempotency.clear();
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title='행사 등록' size='lg'>
      <p className='mb-4 type-body-sm text-fg-muted'>저장하면 크루 행사 목록에 바로 공개됩니다.</p>
      <EventEditor submitting={create.isPending} serverError={create.error} onSubmit={submit} onCancel={close} />
    </Modal>
  );
}
