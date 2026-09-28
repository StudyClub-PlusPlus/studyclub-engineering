'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button, Modal } from '@studyclub/ui';

import {
  StudyForm,
  detailToForm,
  formToPayload,
  serverErrorToField,
  validateStudyForm,
  type StudyFormErrors,
  type StudyFormValues,
} from '@/components/StudyForm';
import { useDeleteStudy, useUpdateStudy } from '@/features/studies/queries';
import type { ApiStudyDetail } from '@/features/studies/types';

/**
 * 정보 탭.
 *
 * **등록 팝업과 같은 폼을 그대로 편다.** 읽기 화면을 따로 두고 "수정" 버튼으로 팝업을 띄우면,
 * 운영자는 같은 정보를 두 가지 모양으로 보게 되고 어디를 눌러야 뭐가 바뀌는지 매번 확인해야 한다.
 * 여기서는 보이는 칸이 곧 고치는 칸이다.
 */
export function StudyInfoTab({ detail }: { detail: ApiStudyDetail }) {
  const router = useRouter();
  const initial = useMemo(() => detailToForm(detail), [detail]);
  const [form, setForm] = useState<StudyFormValues>(initial);
  const [errors, setErrors] = useState<StudyFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = useUpdateStudy(detail.id);
  const remove = useDeleteStudy(detail.id);

  // 저장 뒤 서버 값을 다시 받으면 그 값으로 폼을 맞춘다 — 서버가 다듬은 값(공백 제거 등)을 보여 준다
  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial]);

  const dirty = (Object.keys(initial) as (keyof StudyFormValues)[]).some((k) => form[k] !== initial[k]);

  function change(next: StudyFormValues) {
    setForm(next);
    setSaved(false);
    setSaveError(null);
  }

  function save() {
    const e = validateStudyForm(form);
    setErrors(e);
    setSaveError(null);
    if (Object.keys(e).length > 0) return;

    update.mutate(formToPayload(form, initial), {
      onSuccess: () => setSaved(true),
      onError: (err) => {
        const fieldError = serverErrorToField(err.message);
        if (fieldError) setErrors(fieldError);
        else setSaveError(err.message);
      },
    });
  }

  function confirmRemove() {
    remove.mutate(undefined, {
      onSuccess: () => router.push('/studies'),
    });
  }

  return (
    <div className='card px-6 py-5'>
      <StudyForm value={form} errors={errors} onChange={change} />

      <div className='mt-6 flex items-center gap-3 border-t border-border pt-4'>
        {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 되돌릴 수 없다 */}
        <button
          type='button'
          onClick={() => setConfirmDelete(true)}
          disabled={update.isPending}
          className='h-10 text-sm font-semibold text-error-600 underline-offset-4 hover:underline disabled:opacity-50'
        >
          스터디 삭제
        </button>
        <div className='ml-auto flex items-center gap-3'>
          {saveError && <span className='text-sm font-medium text-error-600'>{saveError}</span>}
          {saved && !dirty && <span className='text-sm font-medium text-success-700'>저장되었습니다.</span>}
          <Button onClick={save} loading={update.isPending} disabled={!dirty}>
            저장
          </Button>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => {
          if (remove.isPending) return;
          setConfirmDelete(false);
          remove.reset();
        }}
        title='스터디 삭제'
        footer={
          <>
            <Button
              variant='secondary'
              disabled={remove.isPending}
              onClick={() => {
                setConfirmDelete(false);
                remove.reset();
              }}
            >
              취소
            </Button>
            <Button variant='destructive' loading={remove.isPending} onClick={confirmRemove}>
              삭제
            </Button>
          </>
        }
      >
        <div className='py-6 text-center'>
          <p className='text-sm font-semibold text-fg'>‘{detail.title}’ 스터디를 삭제합니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>크루 명단과 출석 기록도 함께 사라지며 되돌릴 수 없습니다.</p>
          {remove.error && <p className='mt-3 text-sm font-medium text-error-600'>{remove.error.message}</p>}
        </div>
      </Modal>
    </div>
  );
}
