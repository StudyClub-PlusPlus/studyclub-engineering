'use client';

import { useEffect, useState } from 'react';

import { Button, Modal } from '@studyclub/ui';

import {
  EMPTY_FORM,
  StudyForm,
  validateStudyForm,
  type StudyFormErrors,
  type StudyFormValues,
} from '@/components/StudyForm';

/**
 * 스터디 등록 팝업.
 *
 * 폼 본체는 `StudyForm` 이며 **정보 탭이 같은 것을 쓴다.** 등록과 수정에서 보이는 칸이 달라지면
 * 운영자가 화면마다 다른 것을 외워야 한다.
 *
 * TODO(api): POST /api/admin/studies — 아직 화면 상태로만 처리한다.
 */
export function StudyCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<StudyFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<StudyFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setErrors({});
    setDone(false);
  }, [open]);

  function close() {
    setForm(EMPTY_FORM);
    setErrors({});
    setDone(false);
    onClose();
  }

  async function handleSubmit() {
    const e = validateStudyForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setDone(true);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title='스터디 등록'
      size='lg'
      footer={
        done ? (
          <Button onClick={close}>확인</Button>
        ) : (
          <>
            <Button variant='secondary' onClick={close} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              등록
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className='py-6 text-center text-sm text-fg-muted'>
          등록되었습니다. 비공개 상태로 만들어지며, 모집을 시작하면 사이트에 공개됩니다.
        </p>
      ) : (
        <StudyForm value={form} errors={errors} onChange={setForm} />
      )}
    </Modal>
  );
}
