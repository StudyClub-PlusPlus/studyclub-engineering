'use client';

import { useEffect, useState } from 'react';

import { Button, Modal } from '@studyclub/ui';

import {
  EMPTY_FORM,
  StudyForm,
  formToCreatePayload,
  serverErrorToField,
  validateStudyForm,
  type StudyFormErrors,
  type StudyFormValues,
} from '@/components/StudyForm';
import { useCreateStudy } from '@/features/studies/queries';

/**
 * 스터디 등록 팝업.
 *
 * 폼 본체는 `StudyForm` 이며 **정보 탭이 같은 것을 쓴다.** 등록과 수정에서 보이는 칸이 달라지면
 * 운영자가 화면마다 다른 것을 외워야 한다. 다른 점은 프로그램 칸뿐이다 — 등록에서만 고를 수 있어
 * `mode` 로 가른다.
 */
export function StudyCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<StudyFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<StudyFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const create = useCreateStudy();
  const saving = create.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setErrors({});
    setFailure(null);
    setDone(false);
  }, [open]);

  function close() {
    setForm(EMPTY_FORM);
    setErrors({});
    setFailure(null);
    setDone(false);
    onClose();
  }

  async function handleSubmit() {
    const e = validateStudyForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setFailure(null);
    try {
      await create.mutateAsync(formToCreatePayload(form));
      setDone(true);
    } catch (err) {
      // 서버가 `필드: 사유` 로 주면 그 칸에 붙이고, 아니면 입력값을 그대로 둔 채 위에 알린다
      const message = err instanceof Error ? err.message : '등록하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      const fieldError = serverErrorToField(message);
      if (fieldError) setErrors(fieldError);
      else setFailure(message);
    }
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
        <>
          {failure && (
            <p className='mb-3 rounded-control bg-error-50 px-3 py-2 text-sm text-error-700'>{failure}</p>
          )}
          <StudyForm mode='create' value={form} errors={errors} onChange={setForm} />
        </>
      )}
    </Modal>
  );
}
