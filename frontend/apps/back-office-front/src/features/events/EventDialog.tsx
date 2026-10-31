'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { StudyclubEvent } from '@studyclub/types';
import { Button, Modal } from '@studyclub/ui';
import { useForm } from 'react-hook-form';

import { EMPTY_EVENT, EventForm, eventToForm } from '@/features/events/EventForm';
import { eventFormSchema, type EventFormValues } from '@/features/events/form-schema';

/**
 * 행사 등록·편집 팝업 — 스터디 팝업과 같은 규칙.
 *
 * **등록 폼이 곧 편집 폼이다.** 목록에서 행사명을 누르면 값이 채워진 채 열린다.
 * 삭제도 이 안에서 한다 — 목록 행에 삭제 버튼을 두면 스치듯 눌러 지우는 사고가 난다.
 *
 * TODO(api): POST/PATCH/DELETE /api/events
 */
export function EventDialog({
  open,
  onClose,
  event,
}: {
  open: boolean;
  onClose: () => void;
  /** 지정하면 편집 모드. 없으면 등록 모드. */
  event?: StudyclubEvent;
}) {
  const editing = Boolean(event);
  const {
    watch,
    setValue,
    reset,
    handleSubmit: submitForm,
    formState,
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: EMPTY_EVENT,
    reValidateMode: 'onSubmit',
  });
  const form = watch();
  const errors = Object.fromEntries(Object.entries(formState.errors).map(([key, error]) => [key, error?.message]));
  function setForm(next: EventFormValues) {
    for (const key of Object.keys(next) as (keyof EventFormValues)[]) {
      setValue(key, next[key], { shouldDirty: true });
    }
  }
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<false | 'saved' | 'deleted'>(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    reset(event ? eventToForm(event) : EMPTY_EVENT);
    setDone(false);
    setConfirmDelete(false);
  }, [open, event, reset]);

  function close() {
    reset(EMPTY_EVENT);
    setDone(false);
    setConfirmDelete(false);
    onClose();
  }

  const handleSubmit = submitForm(async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setDone('saved');
  });

  async function handleDelete() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setDone('deleted');
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? '행사 편집' : '행사 등록'}
      size='lg'
      footer={
        done ? (
          <Button onClick={close}>확인</Button>
        ) : confirmDelete ? (
          <>
            <Button variant='secondary' onClick={() => setConfirmDelete(false)} disabled={saving}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleDelete} loading={saving}>
              삭제
            </Button>
          </>
        ) : (
          <>
            {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 되돌릴 수 없다 */}
            {editing && (
              <Button
                type='button'
                variant='danger'
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className='mr-auto'
              >
                행사 삭제
              </Button>
            )}
            <Button variant='secondary' onClick={close} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? '저장' : '등록'}
            </Button>
          </>
        )
      }
    >
      {done === 'deleted' ? (
        <p className='py-6 text-center type-body-sm text-fg-muted'>삭제되었습니다.</p>
      ) : done === 'saved' ? (
        <p className='py-6 text-center type-body-sm text-fg-muted'>
          {editing ? '저장되었습니다.' : '등록되었습니다. 사이트에 바로 공개됩니다.'}
        </p>
      ) : confirmDelete ? (
        <div className='py-6 text-center'>
          <p className='type-label-lg text-fg'>‘{form.title}’ 행사를 삭제합니다.</p>
          <p className='mt-1.5 type-body-sm text-fg-muted'>사이트에서 즉시 사라지며 되돌릴 수 없습니다.</p>
        </div>
      ) : (
        <EventForm value={form} errors={errors} onChange={setForm} />
      )}
    </Modal>
  );
}
