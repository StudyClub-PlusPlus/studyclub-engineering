'use client';

import { useEffect } from 'react';

import { Button } from '@studyclub/ui';

import { ApplicationFormEditor } from './ApplicationFormEditor';
import { useApplicationForm, useSaveApplicationForm } from './queries';
import { toFormValues } from './schema';
import type { ApiStudyDetail } from '@/features/studies/types';
import { ApiError } from '@/lib/http';

export function ApplicationFormTab({
  study,
  onSavingChange,
}: {
  study: ApiStudyDetail;
  onSavingChange: (saving: boolean) => void;
}) {
  const query = useApplicationForm(study.id);
  const mutation = useSaveApplicationForm(study.id);
  const status = mutation.error instanceof ApiError ? mutation.error.status : undefined;
  const readOnly = status === 403 || status === 409;

  useEffect(() => {
    onSavingChange(mutation.isPending);
    return () => onSavingChange(false);
  }, [mutation.isPending, onSavingChange]);

  if (query.isPending)
    return (
      <p role='status' className='py-10 text-center text-sm text-fg-muted'>
        불러오는 중
      </p>
    );
  if (query.error) {
    const code = query.error instanceof ApiError ? query.error.status : undefined;
    const message =
      code === 403
        ? '이 스터디의 신청 폼을 볼 권한이 없습니다.'
        : code === 404
          ? '스터디를 찾을 수 없습니다.'
          : '신청 폼을 불러오지 못했습니다. 다시 시도해 주세요.';
    return (
      <div className='py-10 text-center'>
        <p role='alert' className='text-sm text-fg-secondary'>
          {message}
        </p>
        {code !== 403 && code !== 404 && code !== 401 && (
          <Button type='button' variant='secondary' className='mt-3' onClick={() => void query.refetch()}>
            다시 시도
          </Button>
        )}
      </div>
    );
  }
  const message =
    status === 403
      ? '이 스터디의 신청 폼을 고칠 권한이 없습니다.'
      : status === 409
        ? mutation.error?.message
        : mutation.isError && status !== 401
          ? '저장하지 못했습니다. 다시 시도해 주세요.'
          : undefined;

  return (
    <ApplicationFormEditor
      initialValues={toFormValues(query.data, { title: study.title, description: study.oneLineSummary })}
      title={study.title}
      summary={study.oneLineSummary}
      saving={mutation.isPending}
      readOnly={readOnly}
      saved={mutation.isSuccess}
      message={message}
      onSave={async (values) => {
        await mutation.mutateAsync(values);
      }}
    />
  );
}
