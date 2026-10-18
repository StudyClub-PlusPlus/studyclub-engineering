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
 * 공지 등록·편집 팝업 — 스터디 등록 팝업과 같은 규칙.
 *
 * **등록은 늘 미공개로 끝난다.** 초안 저장과 공개를 나눈다 — 공개는 목록의 공개 칸에서 확인을 거쳐 켠다.
 * 목록에서 제목을 누르면 값이 채워진 채 열린다.
 *
 * TODO(api): POST /api/admin/notices · PATCH /api/admin/notices/{id}
 */
export function NoticeDialog({
  open,
  onClose,
  notice,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** 지정하면 편집 모드. 없으면 등록 모드. */
  notice?: Notice;
  onSave: (values: NoticeFormValues) => void;
}) {
  const editing = Boolean(notice);
  const [form, setForm] = useState<NoticeFormValues>(EMPTY_NOTICE);
  const [errors, setErrors] = useState<NoticeFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(notice ? noticeToForm(notice) : EMPTY_NOTICE);
    setErrors({});
    setDone(false);
  }, [open, notice]);

  function close() {
    setForm(EMPTY_NOTICE);
    setErrors({});
    setDone(false);
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
    setDone(true);
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
        ) : (
          /* 입력·설정 모달이라 취소를 두지 않는다 — 닫는 길은 X 와 Esc 다 (POL-0008) */
          <Button data-anno='notice:2-5' onClick={handleSubmit} loading={saving}>
            {editing ? '저장' : '등록'}
          </Button>
        )
      }
    >
      {done ? (
        <p className='py-6 text-center text-sm text-fg-muted'>
          {editing
            ? notice?.publishedAt
              ? '저장되었습니다. 사이트에 바로 반영됩니다.'
              : '저장되었습니다.'
            : '등록되었습니다. 아직 사이트에 보이지 않습니다 — 목록에서 공개를 켜세요.'}
        </p>
      ) : (
        <NoticeForm value={form} errors={errors} onChange={setForm} />
      )}
    </Modal>
  );
}
