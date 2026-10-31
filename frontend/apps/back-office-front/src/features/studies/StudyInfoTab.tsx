'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button, Modal } from '@studyclub/ui';

import { detailToForm, formToPayload, serverErrorToField, type StudyFormValues } from '@/features/studies/form-schema';
import { studiesListHref } from '@/features/studies/list-return';
import { useDeleteStudy, useUpdateStudy } from '@/features/studies/queries';
import { StudyDiscordLinkDialog } from '@/features/studies/StudyDiscordLinkDialog';
import { StudyForm, useStudyForm } from '@/features/studies/StudyForm';
import type { ApiStudyDetail } from '@/features/studies/types';

/**
 * 정보 탭.
 *
 * **등록 팝업과 같은 폼을 그대로 편다.** 읽기 화면을 따로 두고 "수정" 버튼으로 팝업을 띄우면,
 * 운영자는 같은 정보를 두 가지 모양으로 보게 되고 어디를 눌러야 뭐가 바뀌는지 매번 확인해야 한다.
 * 여기서는 보이는 칸이 곧 고치는 칸이다.
 */
export function StudyInfoTab({
  detail,
  onSavingChange,
}: {
  detail: ApiStudyDetail;
  onSavingChange?: (saving: boolean) => void;
}) {
  const router = useRouter();
  const initial = useMemo(() => detailToForm(detail), [detail]);
  const {
    value: form,
    errors,
    isDirty: dirty,
    change: setForm,
    reset,
    handleSubmit: submitForm,
    setServerErrors,
  } = useStudyForm(initial);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDiscordLink, setShowDiscordLink] = useState(false);
  const [uploading, setUploading] = useState(false);

  const update = useUpdateStudy(detail.id);
  const remove = useDeleteStudy(detail.id);
  const busy = uploading || update.isPending || remove.isPending;

  useEffect(() => {
    onSavingChange?.(busy);
    return () => onSavingChange?.(false);
  }, [busy, onSavingChange]);

  // 직접 연결 성공과 다른 운영자의 선행 연결 모두, 확인된 연결 상태를 기준으로 창을 닫는다.
  useEffect(() => {
    if (detail.discordLinked) setShowDiscordLink(false);
  }, [detail.discordLinked]);

  // 저장 뒤 서버 값을 다시 받으면 그 값으로 폼을 맞춘다 — 서버가 다듬은 값(공백 제거 등)을 보여 준다
  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  function change(next: StudyFormValues) {
    setForm(next);
    setSaved(false);
    setSaveError(null);
  }

  const save = submitForm((form) => {
    if (busy || !dirty) return;
    setSaveError(null);

    update.mutate(formToPayload(form, initial), {
      onSuccess: () => {
        setSaved(true);
        // 상세는 React Query, 목록은 서버 컴포넌트이므로 양쪽 캐시를 갱신한다.
        router.refresh();
      },
      onError: (err) => {
        const fieldError = serverErrorToField(err.message);
        if (fieldError) setServerErrors(fieldError);
        else setSaveError(err.message);
      },
    });
  });

  function confirmRemove() {
    if (busy) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        // 걸어 둔 필터 · 페이지로 돌아간다
        router.replace(studiesListHref());
        router.refresh();
      },
    });
  }

  return (
    <div className='card px-6 py-5'>
      <section
        aria-label='디스코드 연결'
        className='mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4'
      >
        <span className='type-label-lg'>디스코드 연결</span>
        <span role='status' className='type-body-sm text-fg-muted'>
          {detail.discordLinked ? '연결됨' : '미연결'}
        </span>
        {detail.discordLinked === false && (
          <Button variant='secondary' disabled={busy || dirty} onClick={() => setShowDiscordLink(true)}>
            다시 연결
          </Button>
        )}
        {detail.discordLinked === false && dirty && (
          <p className='type-body-sm text-fg-muted'>변경 사항을 저장한 뒤 다시 연결해 주세요.</p>
        )}
      </section>
      <fieldset disabled={busy} className='min-w-0' aria-label='스터디 정보'>
        <StudyForm mode='edit' value={form} errors={errors} onChange={change} onUploadingChange={setUploading} />
      </fieldset>

      <div className='mt-6 flex items-center gap-3 border-t border-border pt-4'>
        {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 되돌릴 수 없다 */}
        <button
          type='button'
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          className='h-10 type-label-lg text-error-600 underline-offset-4 hover:underline disabled:opacity-50'
        >
          스터디 삭제
        </button>
        <div className='ml-auto flex items-center gap-3'>
          {uploading && (
            <span role='status' className='type-body-sm text-fg-muted'>
              썸네일 업로드 중입니다.
            </span>
          )}
          {saveError && <span className='type-label-lg text-error-600'>{saveError}</span>}
          {saved && !dirty && <span className='type-label-lg text-success-700'>저장되었습니다.</span>}
          <Button onClick={save} loading={update.isPending} disabled={!dirty || busy}>
            저장
          </Button>
        </div>
      </div>

      {showDiscordLink && (
        <StudyDiscordLinkDialog studyId={detail.id} title={detail.title} onClose={() => setShowDiscordLink(false)} />
      )}
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
              data-autofocus
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
          <p className='type-label-lg text-fg'>‘{detail.title}’ 스터디를 삭제합니다.</p>
          <p className='mt-1.5 type-body-sm text-fg-muted'>크루 명단과 출석 기록도 함께 사라지며 되돌릴 수 없습니다.</p>
          {remove.error && <p className='mt-3 type-label-lg text-error-600'>{remove.error.message}</p>}
        </div>
      </Modal>
    </div>
  );
}
