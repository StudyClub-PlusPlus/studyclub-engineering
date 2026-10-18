'use client';

import { useEffect, useState } from 'react';

import {
  EMPTY_NOTICE,
  NoticeForm,
  noticeToForm,
  validateNoticeForm,
  type NoticeFormErrors,
  type NoticeFormValues,
} from '@console/components/NoticeForm';
import type { Notice } from '@console/lib/notices';
import { Button, Modal } from '@studyclub/ui';

/**
 * 공지 등록·편집 팝업 — 스터디 등록 팝업과 같은 폼 규칙.
 *
 * **공개 단계가 없다.** 등록하면 곧 사이트 공지에 올라가고, 저장하면 바로 반영된다.
 * 목록에서 제목을 누르면 값이 채워진 채 열린다. **삭제도 이 안에서 한다** — 목록 행에 두면 스치듯 눌러 지운다.
 *
 * TODO(api): POST /api/admin/notices · PATCH·DELETE /api/admin/notices/{id}
 */
export function NoticeDialog({
  open,
  onClose,
  notice,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  /** 지정하면 편집 모드. 없으면 등록 모드. */
  notice?: Notice;
  onSave: (values: NoticeFormValues) => void;
  onDelete: (id: string) => void;
}) {
  const editing = Boolean(notice);
  const [form, setForm] = useState<NoticeFormValues>(EMPTY_NOTICE);
  const [errors, setErrors] = useState<NoticeFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<false | 'saved' | 'deleted'>(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(notice ? noticeToForm(notice) : EMPTY_NOTICE);
    setErrors({});
    setDone(false);
    setConfirmDelete(false);
  }, [open, notice]);

  function close() {
    setForm(EMPTY_NOTICE);
    setErrors({});
    setDone(false);
    setConfirmDelete(false);
    onClose();
  }

  async function handleSubmit() {
    const e = validateNoticeForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    onSave(form);
    setSaving(false);
    setDone('saved');
  }

  async function handleDelete() {
    if (!notice) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    onDelete(notice.id);
    setSaving(false);
    setDone('deleted');
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? '공지 편집' : '공지 등록'}
      size='lg'
      footer={
        done ? (
          <Button onClick={close}>확인</Button>
        ) : confirmDelete ? (
          <>
            {/* 결정을 묻는 단계 — 안전한 쪽이 기본 포커스 (POL-0008) */}
            <Button variant='secondary' data-autofocus onClick={() => setConfirmDelete(false)} disabled={saving}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleDelete} loading={saving}>
              삭제
            </Button>
          </>
        ) : (
          <>
            {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 사이트에서 바로 내려간다 */}
            {editing && (
              <button
                type='button'
                data-anno='notice:2-6'
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className='mr-auto h-10 text-sm font-semibold text-error-600 underline-offset-4 hover:underline disabled:opacity-50'
              >
                공지 삭제
              </button>
            )}
            {/* 입력·설정 모달이라 취소를 두지 않는다 — 닫는 길은 X 와 Esc 다 (POL-0008) */}
            <Button data-anno='notice:2-5' onClick={handleSubmit} loading={saving}>
              {editing ? '저장' : '등록'}
            </Button>
          </>
        )
      }
    >
      {done === 'deleted' ? (
        <p className='py-6 text-center text-sm text-fg-muted'>삭제되었습니다. 사이트 공지에서 내려갔습니다.</p>
      ) : done === 'saved' ? (
        <p className='py-6 text-center text-sm text-fg-muted'>
          {editing ? '저장되었습니다. 사이트 공지에 바로 반영됩니다.' : '등록되었습니다. 사이트 공지에 바로 올라갑니다.'}
        </p>
      ) : confirmDelete ? (
        <div className='py-6 text-center'>
          <p className='text-sm font-semibold text-fg'>‘{notice?.title}’ 공지를 삭제합니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>사이트 공지와 이 목록에서 바로 사라지며 되돌릴 수 없습니다.</p>
        </div>
      ) : (
        <NoticeForm value={form} errors={errors} onChange={setForm} />
      )}
    </Modal>
  );
}
