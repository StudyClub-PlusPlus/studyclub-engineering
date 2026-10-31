'use client';

import { useEffect, useState } from 'react';

import { Button, Modal } from '@studyclub/ui';

import {
  EMPTY_FORM,
  formToCreatePayload,
  serverErrorToField,
  type FormMode,
  type StudyFormValues,
} from '@/features/studies/form-schema';
import { useCreateStudy } from '@/features/studies/queries';
import { StudyForm, useStudyForm } from '@/features/studies/StudyForm';

/**
 * 스터디 등록 팝업.
 *
 * 폼 본체는 `StudyForm` 이며 **정보 탭이 같은 것을 쓴다.** 등록과 수정에서 보이는 칸이 달라지면
 * 운영자가 화면마다 다른 것을 외워야 한다. 다른 점은 프로그램 칸뿐이다 — 등록에서만 고를 수 있어
 * `mode` 로 가른다.
 */
export function StudyCreateDialog({
  open,
  onClose,
  onConfirmed,
  initial = EMPTY_FORM,
  mode = 'create',
  title = '스터디 등록',
}: {
  open: boolean;
  onClose: () => void;
  onConfirmed?: () => void;
  /** 열 때 채워 둘 값 — 클럽의 「다음 기수 만들기」는 그 클럽 · 최신 기수 값으로 연다 */
  initial?: StudyFormValues;
  /** next 면 프로그램 칸이 읽기 전용이다 */
  mode?: Extract<FormMode, 'create' | 'next'>;
  title?: string;
}) {
  const {
    value: form,
    errors,
    change: setForm,
    reset,
    handleSubmit: submitForm,
    setServerErrors,
  } = useStudyForm(initial);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const create = useCreateStudy();
  const saving = create.isPending;
  const busy = saving || uploading;

  useEffect(() => {
    if (!open) return;
    reset(initial);
    setFailure(null);
    setDone(false);
  }, [open, initial, reset]);

  function close() {
    if (busy) return;
    reset(EMPTY_FORM);
    setFailure(null);
    setDone(false);
    onClose();
  }

  const handleSubmit = submitForm(async (form) => {
    if (busy) return;

    setFailure(null);
    try {
      await create.mutateAsync(formToCreatePayload(form));
      setDone(true);
    } catch (err) {
      // 서버가 `필드: 사유` 로 주면 그 칸에 붙이고, 아니면 입력값을 그대로 둔 채 위에 알린다
      const message = err instanceof Error ? err.message : '등록하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      const fieldError = serverErrorToField(message);
      if (fieldError) setServerErrors(fieldError);
      else setFailure(message);
    }
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size='lg'
      footer={
        done ? (
          <Button
            onClick={() => {
              close();
              onConfirmed?.();
            }}
          >
            확인
          </Button>
        ) : (
          <>
            <Button variant='secondary' onClick={close} disabled={busy}>
              취소
            </Button>
            <Button onClick={handleSubmit} loading={saving} disabled={busy}>
              등록
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className='py-6 text-center type-body-sm text-fg-muted'>
          등록되었습니다. 비공개 상태로 만들어지며, 모집을 시작하면 사이트에 공개됩니다.
        </p>
      ) : (
        <>
          {failure && (
            <p className='mb-3 rounded-control bg-error-50 px-3 py-2 type-body-sm text-error-700'>{failure}</p>
          )}
          {uploading && (
            <p role='status' className='mb-3 type-body-sm text-fg-muted'>
              썸네일 업로드 중입니다.
            </p>
          )}
          <fieldset disabled={busy} className='min-w-0'>
            <StudyForm mode={mode} value={form} errors={errors} onChange={setForm} onUploadingChange={setUploading} />
          </fieldset>
        </>
      )}
    </Modal>
  );
}
