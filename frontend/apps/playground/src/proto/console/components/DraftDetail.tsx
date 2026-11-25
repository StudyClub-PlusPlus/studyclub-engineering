'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Study } from '@studyclub/types';
import { Button, Input, Switch, toast } from '@studyclub/ui';

import { ApplicationFormTab } from './ApplicationFormTab';
import { ThumbnailField, studyToForm, validateStudyForm } from './StudyForm';
import { persistThumbnail, readReusedDrafts, reusedDraftVisibility, updateReusedDraft } from '../lib/reused-drafts';

export function DraftDetail({ id }: { id: string }) {
  const [study, setStudy] = useState<Study | null>();
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [titleError, setTitleError] = useState('');
  useEffect(() => {
    setStudy(readReusedDrafts().find((candidate) => String(candidate.study_id) === id) ?? null);
  }, [id]);
  if (study === undefined) return null;
  if (!study) notFound();
  const current = study;
  function save(patch: Partial<Study>) {
    const updated = { ...current, ...patch };
    updateReusedDraft(updated);
    setStudy(updated);
  }
  const blocked = !study.published && !study.applicationForm?.length;
  return (
    <div className='flex flex-col gap-4'>
      <Link href='/proto/console/studies'>← 스터디 관리</Link>
      <h1 className='type-headline-md'>{study.title.ko}</h1>
      {titleInput === null ? (
        <Button
          variant='secondary'
          onClick={() => {
            setTitleInput(study.title.ko);
            setTitleError('');
          }}
        >
          제목 수정
        </Button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const title = titleInput.trim();
            const error = validateStudyForm({ ...studyToForm(current), title }).title;
            if (error) {
              setTitleError(error);
              return;
            }
            try {
              save({ title: { ...current.title, ko: title } });
              setTitleInput(null);
              toast.success('저장되었습니다');
            } catch {
              setTitleError('저장하지 못했어요. 다시 시도해 주세요.');
            }
          }}
        >
          <Input
            label='스터디 제목'
            value={titleInput}
            error={titleError}
            onChange={(e) => setTitleInput(e.target.value)}
          />
          <Button type='button' variant='secondary' onClick={() => setTitleInput(null)}>
            취소
          </Button>
          <Button type='submit'>제목 저장</Button>
        </form>
      )}
      <p>{study.summary.ko}</p>
      <ThumbnailField
        value={study.image ?? ''}
        onChange={async (preview) => {
          try {
            const image = await persistThumbnail(preview);
            const latest = readReusedDrafts().find((draft) => draft.id === current.id);
            if (latest) {
              const updated = { ...latest, image };
              updateReusedDraft(updated);
              setStudy(updated);
            }
          } catch {
            toast.error('이미지를 저장하지 못했어요.');
          } finally {
            if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
          }
        }}
      />
      <Switch
        label='사이트 공개'
        checked={Boolean(study.published)}
        aria-disabled={blocked}
        onClick={() => {
          if (blocked) toast('신청 폼을 먼저 연결하세요.');
        }}
        onCheckedChange={(published) => save(reusedDraftVisibility(current, published))}
      />
      <h2 className='type-title-md'>신청 폼</h2>
      <ApplicationFormTab study={study} onSave={save} />
    </div>
  );
}
