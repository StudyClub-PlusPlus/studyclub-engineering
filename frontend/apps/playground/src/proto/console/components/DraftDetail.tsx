'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Study } from '@studyclub/types';
import { Switch, toast } from '@studyclub/ui';
import { todayISO } from '@studyclub/utils';

import { ApplicationFormTab } from './ApplicationFormTab';
import { readReusedDrafts, updateReusedDraft } from '../lib/reused-drafts';

export function DraftDetail({ id }: { id: string }) {
  const [study, setStudy] = useState<Study | null>();
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
      <p>{study.summary.ko}</p>
      <Switch
        label='사이트 공개'
        checked={Boolean(study.published)}
        aria-disabled={blocked}
        onClick={() => {
          if (blocked) toast('신청 폼을 먼저 연결하세요.');
        }}
        onCheckedChange={(published) => save({ published, publish_at: published ? todayISO() : undefined })}
      />
      <h2 className='type-title-md'>신청 폼</h2>
      <ApplicationFormTab study={study} onSave={save} />
    </div>
  );
}
