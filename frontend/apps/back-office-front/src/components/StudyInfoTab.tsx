'use client';

import { useEffect, useState } from 'react';

import type { Study } from '@studyclub/mock';
import { Button, Modal } from '@studyclub/ui';

import {
  StudyForm,
  studyToForm,
  validateStudyForm,
  type StudyFormErrors,
  type StudyFormValues,
} from '@/components/StudyForm';

/**
 * 정보 탭.
 *
 * **등록 팝업과 같은 폼을 그대로 편다.** 읽기 화면을 따로 두고 "수정" 버튼으로 팝업을 띄우면,
 * 운영자는 같은 정보를 두 가지 모양으로 보게 되고 어디를 눌러야 뭐가 바뀌는지 매번 확인해야 한다.
 * 여기서는 보이는 칸이 곧 고치는 칸이다.
 *
 * TODO(api): PATCH /api/studies/{id} · DELETE /api/studies/{id}
 */
export function StudyInfoTab({ study }: { study: Study }) {
  const [form, setForm] = useState<StudyFormValues>(() => studyToForm(study));
  const [errors, setErrors] = useState<StudyFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(studyToForm(study));
    setErrors({});
    setSaved(false);
  }, [study]);

  function change(next: StudyFormValues) {
    setForm(next);
    setSaved(false);
  }

  async function save() {
    const e = validateStudyForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    // TODO(api): PATCH /api/studies/{id}
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className='card px-6 py-5'>
      <StudyForm value={form} errors={errors} onChange={change} />

      <div className='mt-6 flex items-center gap-3 border-t border-border pt-4'>
        {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 되돌릴 수 없다 */}
        <button
          type='button'
          onClick={() => setConfirmDelete(true)}
          disabled={saving}
          className='h-10 text-sm font-semibold text-error-600 underline-offset-4 hover:underline disabled:opacity-50'
        >
          스터디 삭제
        </button>
        <div className='ml-auto flex items-center gap-3'>
          {saved && <span className='text-sm font-medium text-success-700'>저장되었습니다.</span>}
          <Button onClick={save} loading={saving}>
            저장
          </Button>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title='스터디 삭제'
        footer={
          <>
            <Button variant='secondary' onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button variant='destructive' onClick={() => setConfirmDelete(false)}>
              삭제
            </Button>
          </>
        }
      >
        <div className='py-6 text-center'>
          <p className='text-sm font-semibold text-fg'>‘{form.title}’ 스터디를 삭제합니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>크루 명단과 출석 기록도 함께 사라지며 되돌릴 수 없습니다.</p>
        </div>
      </Modal>
    </div>
  );
}
