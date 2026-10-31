'use client';

import { useEffect, useState } from 'react';

import { Button, Modal } from '@studyclub/ui';

import {
  EMPTY_NOTICE,
  SiteNoticeForm,
  serverErrorToNoticeField,
  validateSiteNoticeForm,
  type SiteNoticeFormErrors,
} from '@/features/site-notices/components/SiteNoticeForm';
import {
  useCreateSiteNotice,
  useDeleteSiteNotice,
  useSiteNotice,
  useUpdateSiteNotice,
} from '@/features/site-notices/queries';
import type { ApiSiteNoticeDetail, SiteNoticePayload } from '@/features/site-notices/types';

/**
 * 공지 등록·편집 팝업 — 스터디 등록 팝업과 같은 폼 규칙.
 *
 * 공개 단계가 없다. 등록하면 곧 사이트 공지에 올라가고, 저장하면 바로 반영된다.
 * 편집은 목록 행에 본문이 없어 열릴 때 한 건을 받아 채운다. 삭제도 이 안에서 한다 — 목록 행에 두면 스치듯 눌러 지운다.
 */
export function SiteNoticeDialog({
  open,
  noticeId,
  onClose,
}: {
  open: boolean;
  /** 숫자면 그 공지 편집, null 이면 등록. */
  noticeId: number | null;
  onClose: () => void;
}) {
  const detail = useSiteNotice(noticeId);
  if (noticeId === null) return <SiteNoticeEditor open={open} onClose={onClose} />;
  const loading = detail.isPending || !detail.isFetchedAfterMount;
  if (loading || detail.isError) {
    let body: React.ReactNode;
    if (loading) {
      body = <p className='py-10 text-center text-sm text-fg-muted'>불러오는 중…</p>;
    } else if (detail.isError) {
      body = (
        <div>
          <p className='rounded-control bg-error-50 px-3 py-2 text-sm text-error-700'>{detail.error.message}</p>
          <Button variant='secondary' className='mt-3' onClick={() => void detail.refetch()}>
            다시 불러오기
          </Button>
        </div>
      );
    }
    return (
      <Modal open={open} onClose={onClose} title='공지 편집' size='lg'>
        {body}
      </Modal>
    );
  }
  return <SiteNoticeEditor open={open} onClose={onClose} notice={detail.data} />;
}

function SiteNoticeEditor({
  open,
  onClose,
  notice,
}: {
  open: boolean;
  onClose: () => void;
  /** 지정하면 편집, 없으면 등록. */
  notice?: ApiSiteNoticeDetail;
}) {
  const editing = Boolean(notice);
  const [form, setForm] = useState<SiteNoticePayload>(EMPTY_NOTICE);
  const [errors, setErrors] = useState<SiteNoticeFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<false | 'saved' | 'deleted'>(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = useCreateSiteNotice();
  const update = useUpdateSiteNotice(notice?.noticeId ?? 0);
  const remove = useDeleteSiteNotice(notice?.noticeId ?? 0);
  const saving = create.isPending || update.isPending || remove.isPending;

  useEffect(() => {
    if (!open) return;
    let initial = EMPTY_NOTICE;
    if (notice) initial = { title: notice.title, body: notice.body };
    setForm(initial);
    setErrors({});
    setFailure(null);
    setDone(false);
    setConfirmDelete(false);
    // 열릴 때 한 번만 채운다 — 한 건이 다시 읽혀도 쓰던 값을 덮지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notice?.noticeId]);

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit() {
    if (saving) return;
    const e = validateSiteNoticeForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setFailure(null);
    try {
      if (editing) await update.mutateAsync(form);
      else await create.mutateAsync(form);
      setDone('saved');
    } catch (err) {
      // 서버가 `필드: 사유` 로 주면 그 칸에 붙이고, 아니면 입력값을 그대로 둔 채 위에 알린다
      let message = '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      if (err instanceof Error && err.message) message = err.message;
      const fieldError = serverErrorToNoticeField(message);
      if (fieldError) setErrors(fieldError);
      else setFailure(message);
    }
  }

  async function handleDelete() {
    if (saving) return;
    setFailure(null);
    try {
      await remove.mutateAsync();
      setDone('deleted');
    } catch (err) {
      let message = '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      if (err instanceof Error && err.message) message = err.message;
      setFailure(message);
      setConfirmDelete(false);
    }
  }

  let title = '공지 등록';
  let submitLabel = '등록';
  let savedText = '등록되었습니다. 사이트 공지에 바로 올라갑니다.';
  if (editing) {
    title = '공지 편집';
    submitLabel = '저장';
    savedText = '저장되었습니다. 사이트 공지에 바로 반영됩니다.';
  }

  let footer: React.ReactNode;
  if (done) {
    footer = <Button onClick={close}>확인</Button>;
  } else if (confirmDelete) {
    footer = (
      <>
        {/* 결정을 묻는 단계 — 안전한 쪽이 기본 포커스 (POL-0008) */}
        <Button variant='secondary' data-autofocus onClick={() => setConfirmDelete(false)} disabled={saving}>
          취소
        </Button>
        <Button variant='destructive' onClick={handleDelete} loading={remove.isPending}>
          삭제
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 사이트에서 바로 내려간다 */}
        {editing && (
          <button
            type='button'
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
            className='mr-auto h-10 text-sm font-semibold text-error-600 underline-offset-4 hover:underline disabled:opacity-50'
          >
            공지 삭제
          </button>
        )}
        {/* 입력·설정 모달이라 취소를 두지 않는다 — 닫는 길은 X 와 Esc 다 (POL-0008) */}
        <Button onClick={handleSubmit} loading={create.isPending || update.isPending} disabled={saving}>
          {submitLabel}
        </Button>
      </>
    );
  }

  let body: React.ReactNode;
  if (done === 'deleted') {
    body = <p className='py-6 text-center text-sm text-fg-muted'>삭제되었습니다. 사이트 공지에서 내려갔습니다.</p>;
  } else if (done === 'saved') {
    body = <p className='py-6 text-center text-sm text-fg-muted'>{savedText}</p>;
  } else if (confirmDelete) {
    body = (
      <div className='py-6 text-center'>
        {/* 지워지는 건 저장된 공지다 — 고치다 만 제목이 아니라 저장된 제목을 묻는다 */}
        <p className='text-sm font-semibold text-fg'>‘{notice?.title}’ 공지를 삭제합니다.</p>
        <p className='mt-1.5 text-sm text-fg-muted'>사이트 공지와 이 목록에서 바로 사라지며 되돌릴 수 없습니다.</p>
      </div>
    );
  } else {
    body = (
      <>
        {failure && <p className='mb-3 rounded-control bg-error-50 px-3 py-2 text-sm text-error-700'>{failure}</p>}
        <fieldset disabled={saving} className='min-w-0'>
          <SiteNoticeForm value={form} errors={errors} onChange={setForm} />
        </fieldset>
      </>
    );
  }

  return (
    <Modal open={open} onClose={close} title={title} size='lg' footer={footer}>
      {body}
    </Modal>
  );
}
