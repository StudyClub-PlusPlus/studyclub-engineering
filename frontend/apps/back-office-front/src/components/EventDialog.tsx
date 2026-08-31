'use client';

import { useEffect, useState } from 'react';

import type { StudyclubEvent } from '@studyclub/mock';
import { Button, Modal } from '@studyclub/ui';

import {
  EMPTY_EVENT,
  EventForm,
  eventToForm,
  validateEventForm,
  type EventFormErrors,
  type EventFormValues,
} from '@/components/EventForm';

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
  const [form, setForm] = useState<EventFormValues>(EMPTY_EVENT);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<false | 'saved' | 'deleted'>(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(event ? eventToForm(event) : EMPTY_EVENT);
    setErrors({});
    setDone(false);
    setConfirmDelete(false);
  }, [open, event]);

  function close() {
    setForm(EMPTY_EVENT);
    setErrors({});
    setDone(false);
    setConfirmDelete(false);
    onClose();
  }

  async function handleSubmit() {
    const e = validateEventForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setDone('saved');
  }

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
              <button
                type='button'
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className='mr-auto h-10 text-sm font-semibold text-error-600 underline-offset-4 hover:underline disabled:opacity-50'
              >
                행사 삭제
              </button>
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
        <p className='py-6 text-center text-sm text-fg-muted'>삭제되었습니다.</p>
      ) : done === 'saved' ? (
        <p className='py-6 text-center text-sm text-fg-muted'>
          {editing ? '저장되었습니다.' : '등록되었습니다. 사이트에 바로 공개됩니다.'}
        </p>
      ) : confirmDelete ? (
        <div className='py-6 text-center'>
          <p className='text-sm font-semibold text-fg'>‘{form.title}’ 행사를 삭제합니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>사이트에서 즉시 사라지며 되돌릴 수 없습니다.</p>
        </div>
      ) : (
        <EventForm value={form} errors={errors} onChange={setForm} />
      )}
    </Modal>
  );
}
